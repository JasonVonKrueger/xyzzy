import { runRuleTests } from '../helpers.js';

runRuleTests('JS-DUP-001', {
  valid: [
    { name: 'repeated for-loop var is a common idiom', code: 'function f() {\n  for (var i = 0; i < 2; i++) {}\n  for (var i = 0; i < 3; i++) {}\n}' },
    { name: 'reusing a GlideRecord variable name', code: "function f() {\n  var gr = new GlideRecord('incident');\n  var gr = new GlideRecord('problem');\n  return gr;\n}" },
    { name: 'same name in different functions', code: 'function a() { var x = 1; return x; }\nfunction b() { var x = 2; return x; }' },
    { name: 'parameter redeclared without initializer', code: 'function f(value) { var value; return value; }' }
  ],
  invalid: [
    {
      name: 'function declared twice (global Business Rule)',
      code: 'function calculateRisk(task) { return 1; }\nfunction other() {}\nfunction calculateRisk(task) { return 2; }',
      findings: [{ line: 3, column: 10, severity: 'WARNING', message: /Function 'calculateRisk' is declared again; the declaration on line 1/ }]
    },
    {
      name: 'variable overwrites a function',
      code: 'function format(x) { return x; }\nvar format = null;',
      findings: [{ line: 2, message: /both a function and a variable \(first on line 1\)/ }]
    },
    {
      name: 'parameter overwritten by var with initializer',
      code: 'function close(state) {\n  var state = 7;\n  return state;\n}',
      findings: [{ line: 2, message: /redeclares the parameter on line 1/ }]
    }
  ]
});
