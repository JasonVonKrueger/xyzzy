import { runRuleTests } from '../helpers.js';

runRuleTests('SN-AJAX-003', {
  valid: [
    { name: 'prefixed names', context: 'client_script', code: "function onLoad() {\n  var ga = new GlideAjax('Utils');\n  ga.addParam('sysparm_name', 'x');\n  ga.addParam('sysparm_user', g_user.userID);\n}" },
    { name: 'name from a variable', context: 'client_script', code: "function onLoad() { var ga = new GlideAjax('Utils'); ga.addParam(key, 1); }" },
    { name: 'addParam on something else', context: 'client_script', code: "function onLoad() { url.addParam('user', 1); }" }
  ],
  invalid: [
    {
      name: 'missing prefix',
      context: 'client_script',
      code: "function onLoad() {\n  var ga = new GlideAjax('Utils');\n  ga.addParam('sysparm_name', 'x');\n  ga.addParam('user_id', g_user.userID);\n}",
      findings: [{ line: 4, column: 15, severity: 'ERROR', message: /'user_id' does not start with sysparm_/, recommendation: /'sysparm_user_id'/ }]
    }
  ]
});
