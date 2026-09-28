import { runRuleTests } from '../helpers.js';

runRuleTests('SN-CLIENT-003', {
  valid: [
    { name: 'inline callback', context: 'client_script', code: "function onLoad() { g_form.getReference('caller_id', function (caller) { alert(caller.email); }); }" },
    { name: 'named callback', context: 'client_script', code: "function onLoad() { g_form.getReference('caller_id', showEmail); }\nfunction showEmail(caller) { alert(caller.email); }" },
    { name: 'callback held in a variable property', context: 'client_script', code: "function onLoad() { g_form.getReference('caller_id', handlers.caller); }" },
    { name: 'local g_form object', context: 'client_script', code: "function onLoad() { var g_form = fake(); g_form.getReference('x'); }" }
  ],
  invalid: [
    { name: 'no callback', context: 'client_script', code: "function onLoad() {\n  var caller = g_form.getReference('caller_id');\n  alert(caller.email);\n}", findings: [{ line: 2, severity: 'WARNING', message: /g_form\.getReference\('caller_id'\) without a callback/, recommendation: /g_form\.getReference\('caller_id', function \(ref\)/ }] },
    { name: 'portal client script', context: 'catalog_client_script', code: "function onLoad() { var caller = g_form.getReference('requested_for'); }", findings: [{ severity: 'ERROR' }] }
  ]
});
