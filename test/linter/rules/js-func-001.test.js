import { runRuleTests } from '../helpers.js';

runRuleTests('JS-FUNC-001', {
  valid: [
    { name: 'Script Include initialize', code: "var U = Class.create();\nU.prototype = {\n  initialize: function () {},\n  type: 'U'\n};" },
    { name: 'no-op callback argument', code: "ga.getXMLAnswer(function () {});\narr.forEach(() => {});" },
    { name: 'documented empty function', code: 'function onSubmit() {\n  // intentionally empty: validation moved to a UI Policy\n}' },
    { name: 'function with a body', code: 'function f() { return 1; }' },
    { name: 'arrow with expression body', code: 'var noop = () => undefined;' }
  ],
  invalid: [
    {
      name: 'empty onLoad client script',
      code: 'function onLoad() {\n}',
      findings: [{ line: 1, column: 1, severity: 'INFO', message: /Empty onLoad\(\) client script/, recommendation: /Deactivate or delete/ }]
    },
    {
      name: 'empty Script Include method',
      code: "var U = Class.create();\nU.prototype = {\n  processRecord: function (gr) {},\n  type: 'U'\n};",
      findings: [{ line: 3, message: /Function 'processRecord' is empty/ }]
    },
    {
      name: 'empty function assigned to a variable',
      code: 'var handler = function () {};',
      findings: [{ message: /'handler'/ }]
    }
  ]
});
