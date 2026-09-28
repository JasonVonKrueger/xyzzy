import { runRuleTests } from '../helpers.js';

runRuleTests('JS-UNUSED-001', {
  valid: [
    { name: 'top-level declarations are the script\'s public surface', code: 'var IncidentUtils = Class.create();\nfunction onLoad() {}\nvar unusedTopLevel = 1;' },
    {
      name: 'Business Rule entry-point parameters may be unused',
      code: "(function executeRule(current, previous) {\n  gs.info('hi');\n})(current, previous);"
    },
    {
      name: 'onChange parameters may be unused',
      code: 'function onChange(control, oldValue, newValue, isLoading, isTemplate) {\n  if (isLoading) return;\n}'
    },
    { name: 'params before a used param', code: 'function f() { return [1].map(function (item, index) { return index; }); }' },
    { name: 'underscore-prefixed names', code: 'function f(_unused) { var _ignored = 1; return 2; }' },
    { name: 'catch parameter', code: 'function f() { try { g(); } catch (e) { return 1; } }\nfunction g() {}' },
    { name: 'used in a nested closure', code: 'function f() { var total = 0; return function () { return total; }; }' },
    { name: 'hoisted function used before declaration', code: 'function f() { return helper(); function helper() { return 1; } }' },
    { name: 'read inside compound assignment that is used', code: 'function f() { var n = 1; var m = (n += 1); return m; }' }
  ],
  invalid: [
    {
      name: 'unused local in a Business Rule',
      code: "(function executeRule(current, previous) {\n  var grUser = new GlideRecord('sys_user');\n  gs.info('done');\n})(current, previous);",
      findings: [{ line: 2, column: 7, severity: 'WARNING', message: /'grUser' is assigned a value but never read/ }]
    },
    {
      name: 'declared but never used',
      code: 'function f() {\n  var pending;\n  return 1;\n}',
      findings: [{ line: 2, message: /'pending' is declared but never used/ }]
    },
    {
      name: 'only incremented is not a use',
      code: 'function f() {\n  var count = 0;\n  count++;\n  count += 2;\n}',
      findings: [{ line: 2, message: /'count' is assigned a value but never read/ }]
    },
    {
      name: 'unused inner function',
      code: 'function f() {\n  function helper() {}\n  return 1;\n}',
      findings: [{ line: 2, message: /Function 'helper' is defined but never called/ }]
    },
    {
      name: 'trailing unused parameters are INFO',
      code: 'var Util = Class.create();\nUtil.prototype = {\n  close: function (days, limit, reason) {\n    return days;\n  }\n};',
      findings: [
        { line: 3, severity: 'INFO', message: /Parameter 'limit' is never used/ },
        { line: 3, severity: 'INFO', message: /Parameter 'reason' is never used/ }
      ]
    },
    {
      name: 'parameters can be skipped via options',
      code: 'function f() { return function (a, b) { var unused = 1; return 1; }; }',
      config: { rules: { 'JS-UNUSED-001': ['warning', { args: 'none' }] } },
      findings: [{ message: /'unused'/ }]
    }
  ]
});
