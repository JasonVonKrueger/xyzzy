import { runRuleTests } from '../helpers.js';

runRuleTests('SN-AJAX-004', {
  valid: [
    { name: 'synchronous return false', context: 'client_script', code: "function onSubmit() {\n  if (!g_form.getValue('short_description')) { return false; }\n}" },
    { name: 'resubmit pattern', context: 'client_script', code: "function onSubmit() {\n  if (g_scratchpad.valid) { return true; }\n  var ga = new GlideAjax('Validator');\n  ga.addParam('sysparm_name', 'check');\n  ga.getXMLAnswer(function (answer) {\n    if (answer == 'true') { g_scratchpad.valid = true; g_form.submit(); }\n  });\n  return false;\n}" },
    { name: 'return false in a nested helper, not the callback', context: 'client_script', code: "function onSubmit() {\n  ga.getXMLAnswer(function (a) { [1].some(function (x) { return false; }); });\n}" },
    { name: 'onLoad is not affected', context: 'client_script', code: "function onLoad() { ga.getXMLAnswer(function (a) { return false; }); }" }
  ],
  invalid: [
    {
      name: 'return false in the GlideAjax callback',
      context: 'client_script',
      code: "function onSubmit() {\n  var ga = new GlideAjax('Validator');\n  ga.addParam('sysparm_name', 'check');\n  ga.getXMLAnswer(function (answer) {\n    if (answer == 'false') {\n      return false;\n    }\n  });\n}",
      findings: [{ line: 6, severity: 'ERROR', message: /return false inside the getXMLAnswer\(\) callback cannot cancel the submit/ }]
    },
    {
      name: 'named getReference callback',
      context: 'catalog_client_script',
      code: "function onSubmit() {\n  g_form.getReference('requested_for', check);\n}\nfunction check(user) {\n  if (!user.active) return false;\n}",
      findings: [{ line: 5, message: /getReference\(\) callback/ }]
    }
  ]
});
