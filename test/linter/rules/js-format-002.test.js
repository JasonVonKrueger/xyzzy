import assert from 'node:assert/strict';
import test from 'node:test';

import { lintText } from '../../../src/linter/index.js';
import { runRuleTests } from '../helpers.js';

runRuleTests('JS-FORMAT-002', {
  valid: [
    { name: 'single quotes', code: "var a = 'x';" },
    { name: 'double quote would need escaping', code: 'var a = "it\'s";\nvar b = "don\'t";' },
    { name: 'escaped quote kept as written', code: 'var a = "say \\"hi\\"";' },
    { name: 'directive', code: '"use strict";\nvar a = 1;' },
    { name: 'template literals are not quotes', code: 'var a = `x`;' },
    { name: 'double style option', config: { rules: { 'JS-FORMAT-002': ['info', { style: 'double' }] } }, code: 'var a = "x";' }
  ],
  invalid: [
    {
      name: 'double quotes in single style',
      code: 'var a = "x";\nvar b = "y";',
      findings: [{ line: 1, column: 9, severity: 'INFO', fixable: true, message: /^2 strings use double quotes \(first on line 1\); the configured style is single\.$/ }]
    },
    {
      name: 'single quotes in double style',
      config: { rules: { 'JS-FORMAT-002': ['info', { style: 'double' }] } },
      code: "var a = 'x';",
      findings: [{ message: /^String uses single quotes; the configured style is double\.$/ }]
    }
  ]
});

test('JS-FORMAT-002 --fix swaps delimiters and keeps values', () => {
  const result = lintText('var a = "x";\nvar b = "it\'s";\nvar c = "tab\\t";', { fix: true, config: { rules: { 'JS-FORMAT-003': 'off' } } });

  assert.equal(result.output, "var a = 'x';\nvar b = \"it's\";\nvar c = 'tab\\t';");
  assert.equal(result.fixRejected, null);
});
