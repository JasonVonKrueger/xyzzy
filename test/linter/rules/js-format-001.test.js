import assert from 'node:assert/strict';
import test from 'node:test';

import { lintText } from '../../../src/linter/index.js';
import { runRuleTests } from '../helpers.js';

runRuleTests('JS-FORMAT-001', {
  valid: [
    { name: 'clean code', code: 'var a = 1;\nvar b = 2;\n' },
    { name: 'whitespace inside a multi-line template literal', code: 'var s = `line one   \nline two`;' },
    { name: 'whitespace inside a line-continued string', code: "var s = 'a \\\n   b';" }
  ],
  invalid: [
    {
      name: 'one finding for the whole file',
      code: 'var a = 1;  \nvar b = 2;\t\nvar c = 3;\n',
      severity: 'info',
      findings: [{ line: 1, column: 11, severity: 'INFO', fixable: true, message: /2 lines \(first on line 1\)/ }]
    },
    {
      name: 'CRLF line endings',
      code: 'var a = 1; \r\nvar b = 2;\r\n',
      findings: [{ line: 1, message: /^Trailing whitespace\.$/ }]
    }
  ]
});

test('JS-FORMAT-001 --fix removes trailing whitespace but keeps template literal content', () => {
  const code = 'var a = 1;  \nvar s = `keep   \nthis`;\t\n';
  const result = lintText(code, { fix: true });

  assert.equal(result.output, 'var a = 1;\nvar s = `keep   \nthis`;\n');
  assert.equal(result.fixesApplied, 2);
  assert.equal(result.findings.filter((finding) => finding.ruleId === 'JS-FORMAT-001').length, 0);
});
