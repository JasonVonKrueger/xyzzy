import { runRuleTests } from '../helpers.js';

const br = (body) => `(function executeRule(current, previous) {\n${body}\n})(current, previous);`;

runRuleTests('SN-BR-007', {
  valid: [
    { name: 'after rule', context: 'business_rule', record: { when: 'after' }, code: br('if (previous.state != current.state) { notify(); }') },
    { name: 'timing unknown', context: 'business_rule', code: br('gs.info(previous.state);') },
    { name: 'guarded', context: 'business_rule', record: { when: 'async' }, code: br('if (previous && previous.state != current.state) { notify(); }') },
    { name: 'local variable named previous', context: 'business_rule', record: { when: 'async' }, code: br("var list = [];\nfor (var i = 0; i < 3; i++) { var previous = list[i]; gs.info(previous.x); }") }
  ],
  invalid: [
    {
      name: 'previous read in an async rule',
      context: 'business_rule',
      record: { when: 'async' },
      code: br('if (previous.state != current.state) {\n  gs.info(previous.state);\n}'),
      findings: [{ line: 2, severity: 'ERROR', confidence: 0.9, message: /previous is null in an async Business Rule \(2 uses\)/ }]
    },
    {
      name: 'async_always counts as async',
      context: 'business_rule',
      record: { when: 'async_always' },
      code: br('gs.info(previous.state);'),
      findings: [{ severity: 'ERROR' }]
    }
  ]
});
