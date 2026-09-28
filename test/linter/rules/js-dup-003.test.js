import { runRuleTests } from '../helpers.js';

runRuleTests('JS-DUP-003', {
  valid: [
    { name: 'distinct cases', code: "switch (state) {\n  case 1: a(); break;\n  case 2: b(); break;\n  default: c();\n}" },
    { name: 'number and string with the same text are different values', code: "switch (x) {\n  case 1: a(); break;\n  case '1': b(); break;\n}" }
  ],
  invalid: [
    {
      name: 'repeated literal',
      code: "switch (current.state + '') {\n  case '6': resolve(); break;\n  case '7': close(); break;\n  case '6': reopen(); break;\n}",
      findings: [{ line: 4, column: 8, severity: 'WARNING', message: /Duplicate case '6'; the case on line 2/ }]
    },
    {
      name: 'repeated expression ignoring whitespace',
      code: 'switch (true) {\n  case a > 1: x(); break;\n  case a>1: y(); break;\n}',
      findings: [{ line: 3 }]
    }
  ]
});
