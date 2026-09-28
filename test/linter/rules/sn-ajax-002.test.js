import { runRuleTests } from '../helpers.js';

runRuleTests('SN-AJAX-002', {
  valid: [
    { name: 'sysparm_name set', context: 'client_script', code: "function onLoad() {\n  var ga = new GlideAjax('Utils');\n  ga.addParam('sysparm_name', 'getX');\n  ga.getXMLAnswer(function (a) {});\n}" },
    { name: 'parameter name from a variable', context: 'client_script', code: "function onLoad() {\n  var ga = new GlideAjax('Utils');\n  ga.addParam(NAME, 'getX');\n  ga.getXMLAnswer(function (a) {});\n}" },
    { name: 'object handed to a helper first', context: 'client_script', code: "function onLoad() {\n  var ga = new GlideAjax('Utils');\n  configure(ga);\n  ga.getXMLAnswer(function (a) {});\n}" },
    { name: 'no request sent', context: 'client_script', code: "function onLoad() { var ga = new GlideAjax('Utils'); }" }
  ],
  invalid: [
    {
      name: 'missing sysparm_name',
      context: 'client_script',
      code: "function onLoad() {\n  var ga = new GlideAjax('Utils');\n  ga.addParam('sysparm_id', g_form.getUniqueValue());\n  ga.getXMLAnswer(function (a) {});\n}",
      findings: [{ line: 4, severity: 'ERROR', message: /GlideAjax request to 'Utils' without addParam\('sysparm_name', \.\.\.\)/ }]
    },
    {
      name: 'sysparm_name added after the request',
      context: 'client_script',
      code: "function onLoad() {\n  var ga = new GlideAjax('Utils');\n  ga.getXML(cb);\n  ga.addParam('sysparm_name', 'x');\n}\nfunction cb(r) {}",
      findings: [{ line: 3 }]
    },
    {
      name: 'chained request',
      context: 'client_script',
      code: "function onLoad() { new GlideAjax('Utils').getXMLAnswer(function (a) {}); }",
      findings: [{ message: /to 'Utils'/ }]
    }
  ]
});
