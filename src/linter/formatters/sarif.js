import path from 'node:path';

import { FINGERPRINT_KEY } from '../fingerprint.js';
import { TOOL_NAME, TOOL_VERSION } from '../version.js';

import { displayPath } from './stylish.js';

const SARIF_LEVELS = { ERROR: 'error', WARNING: 'warning', INFO: 'note' };
// GitHub code scanning orders alerts by security-severity (0-10) for rules tagged "security".
const SECURITY_SEVERITY = { error: '8.0', warning: '5.0', info: '2.0' };

function toUri(file, cwd) {
  return displayPath(file, cwd).split(path.sep).join('/');
}

function describeRule(rule) {
  const tags = [rule.category, rule.fixable ? 'AUTO_FIXABLE' : 'MANUAL_REVIEW'];
  if (rule.category === 'security') {
    tags.push('security');
  }

  const properties = { category: rule.category, contexts: rule.contexts, fixable: rule.fixable, tags };
  if (rule.category === 'security') {
    properties['security-severity'] = SECURITY_SEVERITY[rule.severity];
  }

  return {
    id: rule.id,
    name: rule.name.replace(/[^A-Za-z0-9]+(.)?/g, (_, next) => (next ? next.toUpperCase() : '')),
    shortDescription: { text: rule.name },
    fullDescription: { text: rule.description },
    defaultConfiguration: { level: SARIF_LEVELS[rule.severity.toUpperCase()] },
    properties
  };
}

// SARIF 2.1.0, consumable by GitHub code scanning (upload-sarif) and most CI dashboards.
export function formatSarif(results, { registry, cwd = process.cwd() } = {}) {
  const rules = registry.all();
  const ruleIndex = new Map(rules.map((rule, index) => [rule.id, index]));

  const sarifResults = results.flatMap((result) =>
    result.findings.map((finding) => ({
      ruleId: finding.ruleId,
      ruleIndex: ruleIndex.get(finding.ruleId),
      level: SARIF_LEVELS[finding.severity],
      message: {
        text: [finding.message, finding.explanation, finding.recommendation && `Recommendation: ${finding.recommendation}`]
          .filter(Boolean)
          .join('\n\n')
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: toUri(finding.file, cwd) },
            region: {
              startLine: finding.line,
              startColumn: finding.column,
              endLine: finding.endLine,
              endColumn: finding.endColumn,
              snippet: { text: finding.code }
            }
          }
        }
      ],
      // Lets GitHub code scanning track an alert across commits even when its line number changes.
      partialFingerprints: { [FINGERPRINT_KEY]: finding.fingerprint },
      properties: {
        confidence: finding.confidence,
        fixable: finding.fixable,
        executionContext: result.executionContext.type
      }
    }))
  );

  const log = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: TOOL_NAME,
            version: TOOL_VERSION,
            informationUri: 'https://github.com/JasonVonKrueger/spie',
            rules: rules.map(describeRule)
          }
        },
        columnKind: 'utf16CodeUnits',
        results: sarifResults
      }
    ]
  };

  return `${JSON.stringify(log, null, 2)}\n`;
}
