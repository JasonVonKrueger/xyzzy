import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultRegistry, lintText } from '../../src/linter/index.js';
import { RULE_CATEGORIES } from '../../src/linter/rule-registry.js';

const registry = createDefaultRegistry();

// Lints `code` with only `ruleId` enabled (every other rule off) at its default severity, unless
// `options.severity` says otherwise, and returns its findings.
export function lintWithRule(ruleId, code, options = {}) {
  const result = lintText(code, {
    ...options,
    config: {
      ...options.config,
      categories: Object.fromEntries([...RULE_CATEGORIES].map((category) => [category, 'off'])),
      rules: { [ruleId]: options.severity ?? registry.get(ruleId).severity, ...options.config?.rules }
    }
  });
  assert.deepEqual(result.errors, [], `rule ${ruleId} threw: ${JSON.stringify(result.errors)}`);
  return result.findings.filter((finding) => finding.ruleId === ruleId);
}

// Table-driven rule tests. Each case: { name, code, context?, file?, config? }. Invalid cases also take
// `findings`: an array of partial findings ({ line, column, severity, message: RegExp, ... }) matched in
// order.
export function runRuleTests(ruleId, { valid = [], invalid = [] }) {
  for (const testCase of valid) {
    test(`${ruleId} valid: ${testCase.name}`, () => {
      const findings = lintWithRule(ruleId, testCase.code, testCase);
      assert.deepEqual(findings, [], `expected no ${ruleId} findings`);
    });
  }

  for (const testCase of invalid) {
    test(`${ruleId} invalid: ${testCase.name}`, () => {
      const findings = lintWithRule(ruleId, testCase.code, testCase);
      assert.equal(findings.length, testCase.findings.length, JSON.stringify(findings, null, 2));

      testCase.findings.forEach((expected, index) => {
        for (const [key, value] of Object.entries(expected)) {
          if (value instanceof RegExp) {
            assert.match(findings[index][key], value);
          } else {
            assert.equal(findings[index][key], value, `finding ${index} ${key}`);
          }
        }
      });
    });
  }
}
