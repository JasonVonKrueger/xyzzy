import assert from 'node:assert/strict';
import test from 'node:test';

import { lintText } from '../../../src/linter/index.js';
import { runRuleTests } from '../helpers.js';

runRuleTests('JS-FORMAT-004', {
  valid: [
    { name: 'spaces only', code: 'if (a) {\n    go();\n}' },
    { name: 'tabs only', code: 'if (a) {\n\tif (b) {\n\t\tgo();\n\t}\n}' },
    { name: 'tabs plus alignment spaces', code: 'if (a) {\n\tcall(x,\n\t     y);\n}' },
    { name: 'template literal content', code: 'var s = `a\n\t  b\n  \tc`;' }
  ],
  invalid: [
    {
      name: 'tab in a spaces file',
      code: 'if (a) {\n    go();\n    stop();\n\tagain();\n}',
      findings: [{ line: 4, column: 1, severity: 'INFO', fixable: true, message: /^Indentation does not use spaces consistently\.$/ }]
    },
    {
      name: 'space before tab',
      code: 'if (a) {\n  \tgo();\n}',
      findings: [{ line: 2, message: /spaces/ }]
    },
    {
      name: 'explicit tabs style',
      config: { rules: { 'JS-FORMAT-004': ['info', { style: 'tabs' }] } },
      code: 'if (a) {\n    go();\n    stop();\n}',
      findings: [{ message: /^2 lines are indented with a mix of tabs and spaces \(first on line 2\); this file uses tabs\.$/ }]
    }
  ]
});

test('JS-FORMAT-004 --fix expands tabs to tab stops', () => {
  const code = 'if (a) {\n    go();\n  \tstop();\n\t\tdeep();\n}';
  const result = lintText(code, { fix: true });

  assert.equal(result.output, 'if (a) {\n    go();\n    stop();\n        deep();\n}');
});

test('JS-FORMAT-004 --fix with tabs style and tabWidth 2', () => {
  const code = 'if (a) {\n  go();\n     odd();\n}';
  const result = lintText(code, { fix: true, config: { rules: { 'JS-FORMAT-004': ['info', { style: 'tabs', tabWidth: 2 }] } } });

  assert.equal(result.output, 'if (a) {\n\tgo();\n\t\t odd();\n}');
});
