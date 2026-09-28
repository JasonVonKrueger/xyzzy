import assert from 'node:assert/strict';
import test from 'node:test';

import { lintText } from '../../../src/linter/index.js';
import { runRuleTests } from '../helpers.js';

runRuleTests('JS-FORMAT-005', {
  valid: [
    { name: 'two blank lines', code: 'a();\n\n\nb();' },
    { name: 'blank lines inside a template literal', code: 'var s = `a\n\n\n\n\nb`;' },
    { name: 'blank lines at the end of the file', code: 'a();\n\n\n\n\n' },
    { name: 'option max 4', config: { rules: { 'JS-FORMAT-005': ['info', { max: 4 }] } }, code: 'a();\n\n\n\n\nb();' }
  ],
  invalid: [
    {
      name: 'four blank lines',
      code: 'a();\n\n\n\n\nb();',
      findings: [{ line: 4, column: 1, severity: 'INFO', fixable: true, message: /^4 consecutive blank lines \(maximum 2\)\.$/ }]
    },
    {
      name: 'several places',
      config: { rules: { 'JS-FORMAT-005': ['info', { max: 0 }] } },
      code: 'a();\n\nb();\n\nc();',
      findings: [{ line: 2, message: /^2 places with more than 0 consecutive blank lines/ }]
    }
  ]
});

test('JS-FORMAT-005 --fix collapses runs, including CRLF files', () => {
  assert.equal(lintText('a();\n\n\n\n\nb();\n', { fix: true }).output, 'a();\n\n\nb();\n');
  assert.equal(lintText('a();\r\n\r\n\r\n\r\nb();\r\n', { fix: true }).output, 'a();\r\n\r\n\r\nb();\r\n');
});
