import { runRuleTests } from '../helpers.js';

const br = (body) => `(function executeRule(current, previous) {\n${body}\n})(current, previous);`;

runRuleTests('SN-BR-006', {
  valid: [
    { name: 'before rule', context: 'business_rule', record: { when: 'before' }, code: br('current.state = 7;') },
    { name: 'timing unknown', context: 'business_rule', code: br('current.state = 7;') },
    { name: 'after rule with current.update() is SN-BR-001', context: 'business_rule', record: { when: 'after' }, code: br('current.state = 7;\ncurrent.update();') },
    { name: 'after rule changing another record', context: 'business_rule', record: { when: 'after' }, code: br("var gr = new GlideRecord('task');\ngr.get(current.parent);\ngr.state = 3;\ngr.update();") },
    { name: 'comparison is not a change', context: 'business_rule', record: { when: 'after' }, code: br("if (current.state == 7) { gs.eventQueue('x', current); }") }
  ],
  invalid: [
    {
      name: 'assignment in an after rule',
      context: 'business_rule',
      record: { when: 'after' },
      code: br("current.state = 7;\ncurrent.setValue('priority', 1);\ncurrent.assigned_to.setValue(gs.getUserID());"),
      findings: [{ line: 2, severity: 'WARNING', confidence: 0.9, message: /^current\.state in an after Business Rule is never saved \(and 2 more changes\)\.$/ }]
    },
    {
      name: 'setValue in an async rule',
      context: 'business_rule',
      record: { when: 'async' },
      code: br("current.setValue('state', 7);"),
      findings: [{ message: /current\.setValue\(\) in an async Business Rule/ }]
    }
  ]
});
