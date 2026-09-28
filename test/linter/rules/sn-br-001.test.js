import { runRuleTests } from '../helpers.js';

const br = (body) => `(function executeRule(current, previous) {\n${body}\n})(current, previous);`;

runRuleTests('SN-BR-001', {
  valid: [
    { name: 'field change without update', context: 'business_rule', code: br("current.state = 7;") },
    { name: 'update on another record', context: 'business_rule', code: br("var gr = new GlideRecord('task');\ngr.get(current.parent);\ngr.update();") },
    { name: 'local variable named current', context: 'business_rule', code: br("var save = function () {\n  var current = new GlideRecord('task');\n  current.update();\n};") },
    { name: 'UI Actions may call current.update()', context: 'ui_action', code: "current.state = 7;\ncurrent.update();\naction.setRedirectURL(current);" },
    { name: 'script include is out of scope', context: 'script_include', code: 'function f() { current.update(); }' }
  ],
  invalid: [
    {
      name: 'update with unknown timing',
      context: 'business_rule',
      code: br('current.state = 7;\ncurrent.update();'),
      findings: [{ line: 3, severity: 'ERROR', confidence: 0.95, message: /^current\.update\(\) in a Business Rule\.$/, explanation: /runs every Business Rule on the table again/ }]
    },
    {
      name: 'before rule',
      context: 'business_rule',
      record: { when: 'before' },
      code: br('current.update();'),
      findings: [{ message: /in a before Business Rule/, explanation: /saved automatically/, recommendation: /^Remove current\.update\(\)/ }]
    },
    {
      name: 'after rule article',
      context: 'business_rule',
      record: { when: 'after' },
      code: br('current.update();'),
      findings: [{ message: /in an after Business Rule/ }]
    },
    {
      name: 'display rule',
      context: 'business_rule',
      record: { when: 'display' },
      code: br('current.update();'),
      findings: [{ explanation: /every time the form loads/ }]
    },
    {
      name: 'insert creates a duplicate',
      context: 'business_rule',
      code: br('current.insert();'),
      findings: [{ message: /current\.insert\(\)/, explanation: /duplicate/ }]
    },
    {
      name: 'after setWorkflow(false) is a warning',
      context: 'business_rule',
      code: br('current.setWorkflow(false);\ncurrent.update();'),
      findings: [{ line: 3, severity: 'WARNING', confidence: 0.6, message: /still saved twice/ }]
    },
    {
      name: 'setWorkflow(false) only in a branch does not count',
      context: 'business_rule',
      code: br('if (x) { current.setWorkflow(false); }\ncurrent.update();'),
      findings: [{ severity: 'ERROR' }]
    },
    {
      name: 'inferred from the executeRule signature',
      code: br('current.update();'),
      findings: [{ severity: 'ERROR', confidence: 0.95 }]
    }
  ]
});
