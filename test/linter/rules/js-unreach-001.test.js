import { runRuleTests } from '../helpers.js';

runRuleTests('JS-UNREACH-001', {
  valid: [
    { name: 'conditional return', code: 'function f(x) {\n  if (x) return 1;\n  return 2;\n}' },
    { name: 'hoisted function after return', code: 'function f() {\n  return helper();\n  function helper() { return 1; }\n}' },
    { name: 'var without initializer after return', code: 'function f() {\n  return x;\n  var x;\n}' },
    { name: 'break in a switch case', code: 'switch (a) {\n  case 1:\n    b();\n    break;\n  case 2:\n    c();\n}' },
    { name: 'if without else only returns sometimes', code: 'function f(x) {\n  if (x) { return 1; }\n  gs.info("x");\n}' },
    { name: 'try whose catch falls through', code: 'function f() {\n  try { return run(); } catch (e) { gs.error(e.message); }\n  return null;\n}' }
  ],
  invalid: [
    {
      name: 'code after return',
      code: 'function f() {\n  return 1;\n  gs.info("never");\n  current.update();\n}',
      findings: [{ line: 3, column: 3, endLine: 4, severity: 'WARNING', message: /after the return on line 2/ }]
    },
    {
      name: 'code after throw',
      code: 'function f() {\n  throw new Error("x");\n  cleanup();\n}',
      findings: [{ line: 3, message: /throw/ }]
    },
    {
      name: 'code after both branches return',
      code: 'function f(x) {\n  if (x) { return 1; } else { return 2; }\n  gs.info("dead");\n}',
      findings: [{ line: 3, message: /line 2, which always exits/ }]
    },
    {
      name: 'top-level return in a script field',
      code: 'if (!current.active) {}\nreturn;\ngs.info("dead");',
      findings: [{ line: 3 }]
    },
    {
      name: 'code after break in a loop body',
      code: 'while (gr.next()) {\n  break;\n  count++;\n}',
      findings: [{ line: 3, message: /break/ }]
    }
  ]
});
