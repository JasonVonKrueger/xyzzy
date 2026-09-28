import { runRuleTests } from '../helpers.js';

runRuleTests('PORT-004', {
  valid: [
    { name: 'role check', code: "if (gs.hasRole('admin')) { run(); }" },
    { name: 'comparing with a field', code: 'if (gs.getUserID() == current.assigned_to) { notify(); }' },
    { name: 'other string comparisons', code: "if (current.state == '7') { close(); }" }
  ],
  invalid: [
    {
      name: 'user name',
      code: "if (gs.getUserName() == 'admin') { run(); }",
      findings: [{ line: 1, column: 5, severity: 'WARNING', message: /^gs\.getUserName\(\) compared with 'admin'/ }]
    },
    {
      name: 'getUser().getName() reversed',
      code: "if ('john.smith' === gs.getUser().getName()) { run(); }",
      findings: [{ message: /gs\.getUser\(\)\.getName\(\) compared with 'john\.smith'/ }]
    },
    {
      name: 'client g_user',
      context: 'client_script',
      code: "function onLoad() { if (g_user.userName != 'svc_integration') { g_form.setReadOnly('u_x', true); } }",
      findings: [{ message: /g_user\.userName/ }]
    }
  ]
});
