import { runRuleTests } from '../helpers.js';

runRuleTests('SN-BR-005', {
  valid: [
    { name: 'executeRule template', context: 'business_rule', code: "(function executeRule(current, previous) {\n  var count = 0;\n})(current, previous);" },
    { name: 'legacy onBefore template', context: 'business_rule', code: "onBefore();\nfunction onBefore() {\n  var count = 0;\n}" },
    { name: 'negated IIFE', context: 'business_rule', code: '!function () { var x = 1; }();' },
    { name: 'script include is out of scope', context: 'script_include', code: 'var MyUtil = Class.create();' }
  ],
  invalid: [
    {
      name: 'bare script',
      context: 'business_rule',
      code: "var gr = new GlideRecord('task');\ngr.addQuery('parent', current.sys_id);\ngr.query();",
      findings: [{ line: 1, severity: 'WARNING', message: /^3 top-level statements outside a function \(1 variable declaration\)\.$/ }]
    },
    {
      name: 'variable next to the IIFE',
      context: 'business_rule',
      code: "var cache = {};\n(function executeRule(current, previous) {\n  cache[current.sys_id] = true;\n})(current, previous);",
      findings: [{ line: 1, message: /^1 top-level statement outside a function/ }]
    }
  ]
});
