import { runRuleTests } from '../helpers.js';

runRuleTests('SN-CLIENT-005', {
  valid: [
    { name: 'g_form API', context: 'client_script', code: "function onLoad() { g_form.setDisplay('u_notes', false); g_form.flash('number', '#FFFACD', 0); }" },
    { name: 'typeof guard', context: 'client_script', code: "function onLoad() { if (typeof document === 'undefined') { return; } }" },
    { name: 'gsftSubmit template in a UI Action', context: 'ui_action', code: "function resolve() {\n  gsftSubmit(null, g_form.getFormElement(), 'resolve_incident');\n}\nif (typeof window == 'undefined') { serverResolve(); }\nfunction serverResolve() { current.state = 6; current.update(); }" },
    { name: 'local $ variable', context: 'client_script', code: "function onLoad() { var $ = function (x) { return x; }; $('a'); }" },
    { name: 'server code is out of scope', context: 'business_rule', code: 'var d = document;' }
  ],
  invalid: [
    {
      name: 'several DOM APIs reported once',
      context: 'client_script',
      code: "function onLoad() {\n  gel('incident.number').style.color = 'red';\n  document.getElementById('x').focus();\n  $j('#y').hide();\n  g_form.getControl('state').disabled = true;\n}",
      findings: [{ line: 2, severity: 'WARNING', message: /^Direct DOM access \(gel\(\), document, \$j\(\), g_form\.getControl\(\)\) in this Client Script, 4 uses\.$/, explanation: /Isolate script/ }]
    },
    {
      name: 'portal controller',
      context: 'portal_client',
      code: "api.controller = function () { document.title = 'x'; };",
      findings: [{ message: /document/ }]
    }
  ]
});
