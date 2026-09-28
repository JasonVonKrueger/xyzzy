import { runRuleTests } from '../helpers.js';

const WAIT = "function onLoad() {\n  var ga = new GlideAjax('UserUtils');\n  ga.addParam('sysparm_name', 'getManager');\n  ga.getXMLWait();\n  g_form.setValue('u_manager', ga.getAnswer());\n}";

runRuleTests('SN-CLIENT-002', {
  valid: [
    { name: 'asynchronous getXMLAnswer', context: 'client_script', code: "function onLoad() {\n  var ga = new GlideAjax('UserUtils');\n  ga.addParam('sysparm_name', 'getManager');\n  ga.getXMLAnswer(function (answer) { g_form.setValue('u_manager', answer); });\n}" },
    { name: 'server code is out of scope', context: 'script_include', code: 'obj.getXMLWait();' }
  ],
  invalid: [
    { name: 'classic client script is a warning', context: 'client_script', code: WAIT, findings: [{ line: 4, severity: 'WARNING', message: /freezes the browser/ }] },
    { name: 'catalog client script is an error', context: 'catalog_client_script', code: WAIT, findings: [{ severity: 'ERROR', message: /not supported in Service Portal: this Catalog Client Script fails there/ }] },
    { name: 'chained call in a UI Action', context: 'ui_action', code: "function go() { var ga = new GlideAjax('X'); ga.addParam('sysparm_name', 'y'); ga.getXMLWait(); }", findings: [{ severity: 'WARNING' }] }
  ]
});
