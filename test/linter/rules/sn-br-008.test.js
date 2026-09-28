import { runRuleTests } from '../helpers.js';

const br = (body) => `(function executeRule(current, previous) {\n${body}\n})(current, previous);`;
const ABORT = "if (!current.short_description) {\n  gs.addErrorMessage('Required');\n  current.setAbortAction(true);\n}";

runRuleTests('SN-BR-008', {
  valid: [
    { name: 'before rule', context: 'business_rule', record: { when: 'before' }, code: br(ABORT) },
    { name: 'timing unknown', context: 'business_rule', code: br(ABORT) }
  ],
  invalid: [
    {
      name: 'after rule',
      context: 'business_rule',
      record: { when: 'after' },
      code: br(ABORT),
      findings: [{ line: 4, severity: 'ERROR', message: /^current\.setAbortAction\(\) in an after Business Rule cannot stop the operation\.$/, explanation: /^An after Business Rule runs after/ }]
    },
    {
      name: 'display rule',
      context: 'business_rule',
      record: { when: 'display' },
      code: br('current.setAbortAction(true);'),
      findings: [{ explanation: /form loads/ }]
    }
  ]
});
