import { runRuleTests } from '../helpers.js';

runRuleTests('SN-GR-009', {
  valid: [
    { name: 'get by sys_id', code: "var gr = new GlideRecord('incident');\ngr.get(id);" },
    { name: 'get by number', code: "var gr = new GlideRecord('incident');\ngr.get('number', 'INC0010001');" },
    { name: 'get by user_name', code: "var gr = new GlideRecord('sys_user');\ngr.get('user_name', 'admin');" },
    { name: 'field from a variable', code: "var gr = new GlideRecord('incident');\ngr.get(field, value);" },
    { name: 'untracked object', code: "cache.get('state', 1);" }
  ],
  invalid: [
    {
      name: 'get by state',
      code: "var gr = new GlideRecord('incident');\ngr.get('state', 7);",
      findings: [{ line: 2, severity: 'WARNING', message: /gr\.get\('state', \.\.\.\) matches many records in 'incident'/ }]
    },
    {
      name: 'get by assigned_to',
      code: "var gr = new GlideRecordSecure('task');\nif (gr.get('assigned_to', gs.getUserID())) { use(gr); }",
      findings: [{ message: /'assigned_to'/ }]
    }
  ]
});
