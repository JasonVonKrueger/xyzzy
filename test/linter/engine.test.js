import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import test from 'node:test';

import { LintConfigError, lintText, RuleRegistry } from '../../src/linter/index.js';
import { BUILT_IN_RULES } from '../../src/linter/rules/index.js';
import { RULE_CATEGORIES, RuleDefinitionError } from '../../src/linter/rule-registry.js';

function testRule(overrides) {
  return {
    id: 'TEST-001',
    name: 'Test rule',
    category: 'correctness',
    severity: 'error',
    description: 'Reports every call expression.',
    contexts: ['any'],
    fixable: false,
    create(context) {
      return { CallExpression: (node) => context.report({ node, message: 'call' }) };
    },
    ...overrides
  };
}

function lintWith(rules, code, options = {}) {
  return lintText(code, { registry: new RuleRegistry(rules), ...options });
}

test('every built-in rule has its own test file', () => {
  const testFiles = new Set(readdirSync(new URL('./rules/', import.meta.url)));

  for (const rule of BUILT_IN_RULES) {
    assert.ok(testFiles.has(`${rule.id.toLowerCase()}.test.js`), `missing test/linter/rules/${rule.id.toLowerCase()}.test.js`);
  }
});

test('findings carry the documented shape', () => {
  const [finding] = lintWith([testRule()], '\n  doThing(1);').findings;

  assert.deepEqual(finding, {
    ruleId: 'TEST-001',
    severity: 'ERROR',
    category: 'correctness',
    message: 'call',
    file: '<input>',
    line: 2,
    column: 3,
    endLine: 2,
    endColumn: 13,
    code: 'doThing(1);',
    explanation: 'Reports every call expression.',
    recommendation: '',
    fixable: false,
    confidence: 1,
    fingerprint: finding.fingerprint
  });
  assert.match(finding.fingerprint, /^[0-9a-f]{32}$/);
});

test('rules can be turned off or re-leveled by id or by category', () => {
  const code = 'a();';

  assert.equal(lintWith([testRule()], code, { config: { rules: { 'TEST-001': 'off' } } }).findings.length, 0);
  assert.equal(lintWith([testRule()], code, { config: { rules: { 'TEST-001': 'warn' } } }).findings[0].severity, 'WARNING');
  assert.equal(lintWith([testRule()], code, { config: { categories: { correctness: 'info' } } }).findings[0].severity, 'INFO');
  // A rule setting beats a category setting.
  const both = { categories: { correctness: 'off' }, rules: { 'TEST-001': ['warning', {}] } };
  assert.equal(lintWith([testRule()], code, { config: both }).findings[0].severity, 'WARNING');
});

test('rule options from configuration reach the rule', () => {
  let seen;
  const rule = testRule({
    create(context) {
      seen = { options: context.options, thresholds: context.thresholds };
      return {};
    }
  });

  lintWith([rule], 'a();', {
    config: { rules: { 'TEST-001': { severity: 'warning', options: { allow: ['x'] } } }, thresholds: { maxComplexity: 7 } }
  });

  assert.deepEqual(seen.options, { allow: ['x'] });
  assert.equal(seen.thresholds.maxComplexity, 7);
  assert.equal(seen.thresholds.maxNestingDepth, 4);
});

test('invalid configuration is rejected and unknown ids become warnings', () => {
  assert.throws(() => lintWith([testRule()], 'a();', { config: { rules: { 'TEST-001': 'loud' } } }), LintConfigError);
  assert.throws(() => lintWith([testRule()], 'a();', { config: { thresholds: { maxComplexity: 'ten' } } }), LintConfigError);
  assert.throws(() => lintWith([testRule()], 'a();', { config: { context: 'workflow' } }), LintConfigError);
  assert.throws(() => lintWith([testRule()], 'a();', { config: { globals: 'helper' } }), LintConfigError);
  assert.throws(() => lintWith([testRule()], 'a();', { config: { globals: { helper: 'yes' } } }), LintConfigError);
});

test('low-confidence ERROR findings are reported as WARNING and minConfidence drops them', () => {
  const rule = testRule({
    create: (context) => ({ CallExpression: (node) => context.report({ node, message: 'maybe', confidence: 0.5 }) })
  });

  assert.equal(lintWith([rule], 'a();').findings[0].severity, 'WARNING');
  assert.equal(lintWith([rule], 'a();', { config: { errorConfidenceThreshold: 0.4 } }).findings[0].severity, 'ERROR');
  assert.equal(lintWith([rule], 'a();', { config: { minConfidence: 0.6 } }).findings.length, 0);
});

test('a report can lower but never raise the configured severity', () => {
  const rule = testRule({
    create: (context) => ({
      CallExpression: (node) => context.report({ node, message: node.callee.name, severity: node.callee.name === 'low' ? 'info' : 'error' })
    })
  });
  const findings = lintWith([rule], 'low(); high();', { config: { rules: { 'TEST-001': 'warning' } } }).findings;

  assert.deepEqual(
    findings.map((finding) => [finding.message, finding.severity]),
    [['low', 'INFO'], ['high', 'WARNING']]
  );
});

test('rules only run in matching execution contexts', () => {
  const serverRule = testRule({ id: 'TEST-002', contexts: ['server'] });
  const brRule = testRule({ id: 'TEST-003', contexts: ['business_rule'] });
  const code = 'doWork();';

  const asClient = lintWith([serverRule, brRule], code, { context: 'client_script' }).findings;
  const asServer = lintWith([serverRule, brRule], code, { context: 'script_include' }).findings;
  const asBr = lintWith([serverRule, brRule], code, { context: 'business_rule' }).findings;

  assert.deepEqual(asClient.map((f) => f.ruleId), []);
  assert.deepEqual(asServer.map((f) => f.ruleId), ['TEST-002']);
  assert.deepEqual(asBr.map((f) => f.ruleId).sort(), ['TEST-002', 'TEST-003']);
});

test('excludeContexts removes a rule from matching contexts', () => {
  const rule = testRule({ id: 'TEST-004', contexts: ['any'], excludeContexts: ['client'] });
  const code = 'doWork();';

  assert.deepEqual(lintWith([rule], code, { context: 'client_script' }).findings, []);
  assert.equal(lintWith([rule], code, { context: 'business_rule' }).findings.length, 1);
  assert.equal(lintWith([rule], code, { context: 'unknown' }).findings.length, 1);
  assert.throws(() => new RuleRegistry([testRule({ excludeContexts: ['mainframe'] })]), /unknown excluded context/);
  assert.throws(() => new RuleRegistry([testRule({ excludeContexts: 'client' })]), /must be an array/);
});

test('the GlideRecord analysis is computed once per pass and shared by rules', () => {
  const seen = [];
  const makeRule = (id) =>
    testRule({
      id,
      create: (context) => ({ 'Program:exit': () => seen.push(context.glideRecords) })
    });
  lintWith([makeRule('TEST-005'), makeRule('TEST-006')], "var gr = new GlideRecord('incident'); gr.query();");

  assert.equal(seen.length, 2);
  assert.equal(seen[0], seen[1]);
  assert.deepEqual(seen[0].instances.map((instance) => [instance.table, instance.calls.map((call) => call.method)]), [
    ['incident', ['query']]
  ]);
});

test('record metadata reaches rules as execution.record', () => {
  let seen = null;
  const rule = testRule({ id: 'TEST-007', create: (context) => ({ Program: () => { seen = context.execution.record; } }) });

  lintWith([rule], 'x();');
  assert.deepEqual(seen, { table: null, when: null });

  lintWith([rule], 'x();', { record: { table: 'incident', when: 'async_always' } });
  assert.deepEqual(seen, { table: 'incident', when: 'async' });

  assert.throws(() => lintWith([rule], 'x();', { record: { when: 'later' } }), LintConfigError);
  assert.throws(() => lintWith([rule], 'x();', { record: { table: 42 } }), /record\.table/);
});

test('metrics read by rules are the same object reported in the result', () => {
  let seen = null;
  const rule = testRule({ id: 'TEST-008', create: (context) => ({ 'Program:exit': () => { seen = context.metrics; } }) });
  const result = lintWith([rule], 'function f(a) { if (a) { return 1; } }');

  assert.equal(result.metrics, seen);
  assert.equal(seen.functions[1].complexity, 2);
});

test('suppression comments hide findings and are counted', () => {
  const code = [
    'a(); // snlint-disable-line TEST-001 -- intentional',
    '// snlint-disable-next-line',
    'b();',
    'c(); // snlint-disable-line OTHER-001',
    'd();'
  ].join('\n');
  const result = lintWith([testRule()], code);

  assert.deepEqual(result.findings.map((f) => f.line), [4, 5]);
  assert.equal(result.suppressedCount, 2);

  const fileWide = lintWith([testRule()], `/* snlint-disable-file TEST-001 */\n${code}`);
  assert.equal(fileWide.findings.length, 0);
});

test('a rule that throws is isolated and reported as an internal error', () => {
  const broken = testRule({
    id: 'TEST-009',
    create: () => ({
      Identifier() {
        throw new Error('boom');
      }
    })
  });
  const result = lintWith([broken, testRule()], 'a(); b();');

  assert.deepEqual(result.errors, [{ ruleId: 'TEST-009', message: 'boom' }]);
  assert.deepEqual(result.findings.map((f) => f.ruleId), ['TEST-001', 'TEST-001']);
});

test('all formatting fixers together produce code with the same AST and no formatting findings', () => {
  const code = [
    "'use strict'",
    'var a = "hello"',
    'if (a) {',
    '\tvar c = "x"   ',
    '    \tdoIt(a)',
    '}',
    '',
    '',
    '',
    '',
    'var t = `keep "this"   ',
    '\t\tand this`',
    'do { a++ } while (a < 3)',
    ''
  ].join('\n');
  const onlyFormatting = { categories: Object.fromEntries([...RULE_CATEGORIES].filter((c) => c !== 'formatting').map((c) => [c, 'off'])) };
  const result = lintText(code, { fix: true, config: onlyFormatting });

  assert.equal(result.fixRejected, null);
  assert.equal(
    result.output,
    "'use strict';\nvar a = 'hello';\nif (a) {\n    var c = 'x';\n        doIt(a);\n}\n\n\nvar t = `keep \"this\"   \n\t\tand this`;\ndo { a++; } while (a < 3);\n"
  );
  assert.deepEqual(result.findings, []);
});

test('fixes that would change behavior are rejected as a whole', () => {
  const unsafeFormatter = testRule({
    id: 'TEST-004',
    category: 'formatting',
    fixable: true,
    create: (context) => ({
      Literal: (node) => context.report({ node, message: 'renumber', fix: { range: [node.start, node.end], text: '2' } })
    })
  });
  const result = lintWith([unsafeFormatter], 'var a = 1;', { fix: true });

  assert.equal(result.output, 'var a = 1;');
  assert.equal(result.fixesApplied, 0);
  assert.match(result.fixRejected, /changed the behavior/);
});

test('fixes from rules that are not fixable are ignored', () => {
  const rule = testRule({
    create: (context) => ({
      CallExpression: (node) => context.report({ node, message: 'x', fix: { range: [node.start, node.end], text: '' } })
    })
  });
  const result = lintWith([rule], 'a();', { fix: true });

  assert.equal(result.findings[0].fixable, false);
  assert.equal(result.output, 'a();');
});

test('the registry refuses invalid rules and auto-fixing outside safe categories', () => {
  assert.throws(() => new RuleRegistry([testRule({ id: 'bad id' })]), RuleDefinitionError);
  assert.throws(() => new RuleRegistry([testRule({ contexts: ['mainframe'] })]), /unknown context/);
  assert.throws(() => new RuleRegistry([testRule({ category: 'security', fixable: true })]), /cannot be auto-fixed/);
  assert.throws(() => new RuleRegistry([testRule(), testRule()]), /duplicate/);
  assert.throws(() => new RuleRegistry([testRule({ create: undefined })]), /create/);
});

test('findings are sorted by position', () => {
  const findings = lintWith([testRule()], 'b(); a();\nc();').findings;

  assert.deepEqual(findings.map((f) => [f.line, f.column]), [[1, 1], [1, 6], [2, 1]]);
});

test('very deep expressions do not overflow the stack', () => {
  const code = `var s = ${Array.from({ length: 20000 }, (_, i) => `'${i}'`).join(' + ')};`;
  const result = lintText(code);

  assert.deepEqual(result.errors, []);
});
