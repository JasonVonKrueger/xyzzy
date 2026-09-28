import { runRuleTests } from '../helpers.js';

runRuleTests('SN-CLIENT-004', {
  valid: [
    { name: 'GlideAjax instead', context: 'client_script', code: "function onLoad() { var ga = new GlideAjax('X'); ga.addParam('sysparm_name', 'y'); ga.getXMLAnswer(function (a) {}); }" },
    { name: 'server code is out of scope', context: 'business_rule', code: "var gr = new GlideRecord('sys_user'); gr.query();" },
    { name: 'UI Actions have a server half', context: 'ui_action', code: "var gr = new GlideRecord('sys_user'); gr.query();" }
  ],
  invalid: [
    {
      name: 'synchronous query',
      context: 'client_script',
      code: "function onLoad() {\n  var gr = new GlideRecord('sys_user');\n  gr.addQuery('sys_id', g_user.userID);\n  gr.query();\n}",
      findings: [{ line: 2, severity: 'WARNING', message: /GlideRecord on 'sys_user' in client-side code, with a synchronous query\(\)/ }]
    },
    {
      name: 'asynchronous query is still reported, without the synchronous note',
      context: 'client_script',
      code: "function onLoad() {\n  var gr = new GlideRecord('sys_user');\n  gr.query(function (rows) {});\n}",
      findings: [{ message: /^GlideRecord on 'sys_user' in client-side code\.$/ }]
    },
    {
      name: 'portal note',
      context: 'catalog_client_script',
      code: "function onLoad() { var gr = new GlideRecord('sys_user'); gr.get(id); }",
      findings: [{ message: /synchronous get\(\)/, explanation: /Service Portal only supports/ }]
    }
  ]
});
