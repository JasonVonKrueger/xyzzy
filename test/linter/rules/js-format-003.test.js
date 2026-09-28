import assert from 'node:assert/strict';
import test from 'node:test';

import { lintText } from '../../../src/linter/index.js';
import { runRuleTests } from '../helpers.js';

runRuleTests('JS-FORMAT-003', {
  valid: [
    { name: 'terminated statements', code: "var a = 1;\ncall();\nfunction f() { return a; }\nfor (var i = 0; i < 2; i++) {}\nfor (var k in obj) {}\ndo { a++; } while (a < 3);" },
    { name: 'blocks and declarations need none', code: 'function f() {}\nif (a) {}\nwhile (b) {}\ntry {} catch (e) {}' }
  ],
  invalid: [
    {
      name: 'several statements',
      code: "var a = 1\ncall()\nfunction f() {\n  return a\n}",
      findings: [{ line: 1, column: 10, severity: 'INFO', fixable: true, message: /^Missing semicolons on 3 statements \(first on line 1\)\.$/ }]
    },
    {
      name: 'single statement',
      code: 'throw new Error("x")',
      findings: [{ message: /^Missing semicolon\.$/ }]
    }
  ]
});

test('JS-FORMAT-003 --fix inserts semicolons without changing the AST', () => {
  const code = "var a = 1\nif (a) b()\nelse c()\nwhile (x) { x-- }\nreturn_value = a // note\n";
  const result = lintText(code, { fix: true, config: { rules: { 'JS-FORMAT-002': 'off' } } });

  assert.equal(result.output, "var a = 1;\nif (a) b();\nelse c();\nwhile (x) { x--; }\nreturn_value = a; // note\n");
  assert.equal(result.fixRejected, null);
});
