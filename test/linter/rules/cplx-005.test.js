import { runRuleTests } from '../helpers.js';

runRuleTests('CPLX-005', {
  valid: [
    { name: 'at the limit', code: 'function f(a, b, c, d, e) { return a + b + c + d + e; }' },
    { name: 'platform entry point', config: { thresholds: { maxParameters: 2 } }, code: 'function onChange(control, oldValue, newValue, isLoading, isTemplate) { if (isLoading) return; }' },
    { name: 'options object', code: 'function run(options) { return options.table; }' }
  ],
  invalid: [
    {
      name: 'six parameters',
      code: 'function createTask(table, group, user, priority, notify, due) {\n  return [table, group, user, priority, notify, due];\n}',
      findings: [{ line: 1, column: 1, severity: 'INFO', message: /^Function createTask\(\) takes 6 parameters \(maximum 5\)\.$/, recommendation: /options object/ }]
    },
    {
      name: 'method with a configured limit',
      config: { thresholds: { maxParameters: 1 } },
      code: 'var U = Class.create();\nU.prototype = { add: function (a, b) { return a + b; }, type: "U" };',
      findings: [{ line: 2, message: /Function add\(\) takes 2 parameters/ }]
    }
  ]
});
