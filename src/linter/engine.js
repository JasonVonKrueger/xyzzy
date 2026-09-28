import { traverse } from './ast.js';
import { ensureResolvedConfig, getRuleSetting, LintConfigError } from './config.js';
import { BUSINESS_RULE_WHEN, NO_RECORD, resolveExecutionContext, ruleAppliesToContext } from './execution-context.js';
import { withFingerprints } from './fingerprint.js';
import { applyFixesSafely } from './fixer.js';
import { analyzeGlideAjax } from './glide-ajax.js';
import { analyzeGlideRecords } from './glide-record.js';
import { analyzeOutbound } from './outbound.js';
import { computeMetrics } from './metrics.js';
import { parseSource } from './parser.js';
import { SYNTAX_RULE_ID } from './rules/js-syntax-001.js';
import { createDefaultRegistry } from './rules/index.js';
import { lowerSeverity, severityRank } from './severity.js';
import { SourceCode } from './source-code.js';
import { analyzeScopes } from './scope.js';
import { parseSuppressions } from './suppressions.js';

function clampConfidence(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 1;
  }
  return Math.min(1, Math.max(0, value));
}

function round(value) {
  return Math.round(value * 100) / 100;
}

// Everything a rule sees. `report()` is the only way for a rule to produce a finding.
// `shared` holds analyses computed at most once per pass, on first use, and shared by every rule.
function createRuleContext({ rule, setting, file, sourceCode, execution, scopes, config, sink, shared }) {
  function analysis(key, analyze) {
    shared[key] ??= analyze(sourceCode.ast, scopes, sourceCode);
    return shared[key];
  }

  return {
    id: rule.id,
    file,
    sourceCode,
    execution,
    // { globalScope, scopes, scopeByNode, globalReferences } — see scope.js
    scopes,
    // Extra globals declared in configuration: Map name → { writable }
    configuredGlobals: config.globals,
    options: setting.options,
    thresholds: config.thresholds,

    // Data-flow analyses, computed on first use and shared by every rule. Read them from a visitor, not
    // from create().
    get glideRecords() {
      return analysis('glideRecords', analyzeGlideRecords); // glide-record.js
    },
    get glideAjax() {
      return analysis('glideAjax', analyzeGlideAjax); // glide-ajax.js
    },
    get outbound() {
      return analysis('outbound', analyzeOutbound); // outbound.js: RESTMessageV2/SOAPMessageV2 and responses
    },
    // Per-function and file metrics (metrics.js); the same object becomes the result's `metrics`.
    // Read it in 'Program:exit'.
    get metrics() {
      return analysis('metrics', (ast, _scopes, source) => computeMetrics(ast, source));
    },

    // descriptor: { node | loc, message, explanation, recommendation, confidence?, severity?, fix?, redact? }
    // `redact` is a node whose text is hidden in the finding's code snippet (e.g. a secret).
    // `severity` may only lower the configured severity, never raise it. `fix` is an edit or array of
    // edits ({ range: [start, end], text }) and is ignored unless the rule is fixable.
    report(descriptor) {
      sink.push({ rule, setting, descriptor });
    }
  };
}

function finalizeFinding({ rule, setting, descriptor }, { file, sourceCode, execution, config }) {
  const start = descriptor.loc?.start ?? descriptor.node?.loc.start;
  const end = descriptor.loc?.end ?? descriptor.node?.loc.end ?? start;

  let confidence = clampConfidence(descriptor.confidence);
  // A rule that only makes sense for one side is no more certain than our guess about that side.
  if (!rule.contexts.includes('any')) {
    confidence = Math.min(confidence, execution.confidence);
  }

  let severity = descriptor.severity ? lowerSeverity(setting.severity, descriptor.severity) : setting.severity;
  if (severity === 'error' && confidence < config.errorConfidenceThreshold) {
    severity = 'warning';
  }

  const fixes = rule.fixable && descriptor.fix ? [descriptor.fix].flat() : [];

  return {
    finding: {
      ruleId: rule.id,
      severity: severity.toUpperCase(),
      category: rule.category,
      message: descriptor.message,
      file,
      line: start.line,
      column: start.column + 1,
      endLine: end.line,
      endColumn: end.column + 1,
      code: sourceCode.getSnippet(start.line, descriptor.redact),
      explanation: descriptor.explanation ?? rule.description,
      recommendation: descriptor.recommendation ?? '',
      fixable: fixes.length > 0,
      confidence: round(confidence)
    },
    fixes
  };
}

function compareFindings(a, b) {
  return a.line - b.line || a.column - b.column || a.ruleId.localeCompare(b.ruleId);
}

function syntaxErrorResult({ file, cwd, sourceCode, syntaxError, execution, registry, config }) {
  const findings = [];
  const rule = registry.get(SYNTAX_RULE_ID);
  const { severity } = getRuleSetting(config, rule);

  if (severity !== 'off') {
    findings.push({
      ruleId: rule.id,
      severity: severity.toUpperCase(),
      category: rule.category,
      message: `Syntax error: ${syntaxError.message}.`,
      file,
      line: syntaxError.line,
      column: syntaxError.column,
      endLine: syntaxError.line,
      endColumn: syntaxError.column,
      code: sourceCode.getSnippet(syntaxError.line),
      explanation:
        'The script cannot be parsed, so ServiceNow will fail to save or run it and no other rules could be checked.',
      recommendation:
        'Fix the syntax error. If this script runs in the global scope (ES5), check for newer syntax such as arrow functions, classes, or template literals.',
      fixable: false,
      confidence: 1
    });
  }

  return {
    file,
    executionContext: execution,
    findings: withFingerprints(findings, file, cwd),
    suppressedCount: 0,
    metrics: null,
    errors: []
  };
}

function runPass(text, { file, cwd, explicitContext, record, registry, config }) {
  const { ast, comments, syntaxError } = parseSource(text, { ecmaVersion: config.ecmaVersion });
  const sourceCode = new SourceCode(text, ast, comments);

  if (!ast) {
    const execution = resolveExecutionContext({ explicit: explicitContext, file, ast: null, record });
    return { result: syntaxErrorResult({ file, cwd, sourceCode, syntaxError, execution, registry, config }), ast, fixes: [] };
  }

  const scopes = analyzeScopes(ast);
  const execution = resolveExecutionContext({
    explicit: explicitContext,
    record,
    file,
    ast,
    globalReferences: scopes.globalReferences
  });
  const suppressions = parseSuppressions(comments);

  // Build visitors for every enabled rule that applies to this context.
  const reports = [];
  const errors = [];
  const handlers = new Map();
  const failedRules = new Set();
  const shared = {};

  for (const rule of registry.all()) {
    if (rule.engine) {
      continue;
    }
    const setting = getRuleSetting(config, rule);
    if (setting.severity === 'off' || !ruleAppliesToContext(rule, execution)) {
      continue;
    }

    const context = createRuleContext({
      rule,
      setting,
      file,
      sourceCode,
      execution,
      scopes,
      config,
      sink: reports,
      shared
    });
    let visitors;
    try {
      visitors = rule.create(context) ?? {};
    } catch (error) {
      errors.push({ ruleId: rule.id, message: error.message });
      continue;
    }

    for (const [selector, handler] of Object.entries(visitors)) {
      if (!handlers.has(selector)) {
        handlers.set(selector, []);
      }
      handlers.get(selector).push({ rule, handler });
    }
  }

  // One traversal serves every rule. A rule that throws is disabled for the rest of the file and
  // reported as an internal error; it never takes the other rules down with it.
  function dispatch(selector, node) {
    for (const { rule, handler } of handlers.get(selector) ?? []) {
      if (failedRules.has(rule.id)) {
        continue;
      }
      try {
        handler(node);
      } catch (error) {
        failedRules.add(rule.id);
        errors.push({ ruleId: rule.id, message: error.message });
      }
    }
  }

  traverse(ast, {
    enter: (node) => dispatch(node.type, node),
    leave: (node) => dispatch(`${node.type}:exit`, node)
  });

  const findings = [];
  const fixes = [];
  let suppressedCount = 0;

  for (const report of reports) {
    if (failedRules.has(report.rule.id)) {
      continue;
    }
    const { finding, fixes: findingFixes } = finalizeFinding(report, { file, sourceCode, execution, config });
    if (finding.confidence < config.minConfidence) {
      continue;
    }
    if (suppressions.isSuppressed(finding.ruleId, finding.line)) {
      suppressedCount += 1;
      continue;
    }
    findings.push(finding);
    fixes.push(...findingFixes);
  }

  findings.sort(compareFindings);
  const fingerprinted = withFingerprints(findings, file, cwd);

  return {
    result: {
      file,
      executionContext: execution,
      findings: fingerprinted,
      suppressedCount,
      metrics: shared.metrics ?? computeMetrics(ast, sourceCode),
      errors
    },
    ast,
    fixes
  };
}

// `async_always` is ServiceNow's variant of async; for linting purposes it behaves the same.
function normalizeRecord(record) {
  if (!record) {
    return NO_RECORD;
  }
  const when = record.when === 'async_always' ? 'async' : record.when ?? null;
  if (when !== null && !BUSINESS_RULE_WHEN.includes(when)) {
    throw new LintConfigError(`Unknown Business Rule "when" value "${record.when}". Use one of: ${BUSINESS_RULE_WHEN.join(', ')}.`);
  }
  if (record.table !== undefined && record.table !== null && typeof record.table !== 'string') {
    throw new LintConfigError('record.table must be a table name.');
  }
  return Object.freeze({ table: record.table || null, when });
}

// Lints one script. Options:
//   file      path used in findings and for folder-based context detection
//   context   explicit execution context (e.g. 'business_rule'); overrides config.context and inference
//   cwd       directory that finding fingerprints are relative to (default: process.cwd())
//   record    metadata of the record the script belongs to: { table, when } (when: before | after |
//             async | display). Available to rules as execution.record; unknown fields are null.
//   config    user configuration object (same shape as .snlintrc.json) or an already resolved config
//   registry  rule registry (defaults to the built-in rules)
//   fix       apply safe automatic fixes; the result then describes the fixed code and has `output`
export function lintText(text, options = {}) {
  const registry = options.registry ?? createDefaultRegistry();
  const config = ensureResolvedConfig(options.config, registry);
  const passOptions = {
    file: options.file ?? '<input>',
    cwd: options.cwd ?? process.cwd(),
    explicitContext: options.context ?? config.context,
    record: normalizeRecord(options.record),
    registry,
    config
  };

  const first = runPass(text, passOptions);
  if (!options.fix) {
    return first.result;
  }

  const fixed = applyFixesSafely(text, first.ast, first.fixes, { ecmaVersion: config.ecmaVersion });
  if (fixed.appliedCount === 0) {
    return { ...first.result, output: text, fixesApplied: 0, fixRejected: fixed.rejected };
  }

  const second = runPass(fixed.output, passOptions);
  return { ...second.result, output: fixed.output, fixesApplied: fixed.appliedCount, fixRejected: null };
}

export function summarize(results) {
  const summary = { files: results.length, error: 0, warning: 0, info: 0, fixable: 0, suppressed: 0, baselined: 0 };

  for (const result of results) {
    summary.suppressed += result.suppressedCount;
    summary.baselined += result.baselinedCount ?? 0;
    for (const finding of result.findings) {
      summary[finding.severity.toLowerCase()] += 1;
      if (finding.fixable) {
        summary.fixable += 1;
      }
    }
  }

  return summary;
}

export function highestSeverity(results) {
  let highest = null;
  for (const result of results) {
    for (const finding of result.findings) {
      if (!highest || severityRank(finding.severity) > severityRank(highest)) {
        highest = finding.severity;
      }
    }
  }
  return highest;
}
