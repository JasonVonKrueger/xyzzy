import { runRuleTests } from '../helpers.js';

runRuleTests('JS-DUP-002', {
  valid: [
    { name: 'distinct keys', code: "var o = { a: 1, b: 2, 'c-d': 3 };" },
    { name: 'getter and setter pair', code: 'var o = { get name() { return this._n; }, set name(v) { this._n = v; } };' },
    { name: 'computed keys are not compared', code: 'var o = { [a]: 1, [a]: 2 };' },
    { name: 'same key in different objects', code: 'var a = { x: 1 }, b = { x: 2 };' }
  ],
  invalid: [
    {
      name: 'duplicate Script Include method',
      code: "var IncidentUtils = Class.create();\nIncidentUtils.prototype = {\n  initialize: function () {},\n  closeStale: function () { return 1; },\n  closeStale: function () { return 2; },\n  type: 'IncidentUtils'\n};",
      findings: [{ line: 5, column: 3, severity: 'ERROR', message: /Script Include method 'closeStale' is defined twice; the definition on line 4 is never used/ }]
    },
    {
      name: 'duplicate method in a client-callable Script Include',
      code: "var Ajax = Class.create();\nAjax.prototype = Object.extendsObject(AbstractAjaxProcessor, {\n  getUser: function () {},\n  getUser: function () {}\n});",
      findings: [{ line: 4, message: /Script Include method 'getUser'/ }]
    },
    {
      name: 'quoted and unquoted keys are the same key',
      code: "var payload = {\n  state: 1,\n  'state': 2\n};",
      findings: [{ line: 3, message: /Duplicate key 'state'; the value on line 2/ }]
    },
    {
      name: 'numeric keys',
      code: 'var map = { 1: "New", 2: "In Progress", 1: "Closed" };',
      findings: [{ message: /Duplicate key '1'/ }]
    }
  ]
});
