import { runRuleTests } from '../helpers.js';

const call = (name) => `var ${name} = new GlideAjax('Utils');\n${name}.addParam('sysparm_name', '${name}');\n${name}.getXMLAnswer(function (a) { g_form.setValue('u_${name}', a); });\n`;

runRuleTests('SN-AJAX-001', {
  valid: [
    { name: 'one request', context: 'client_script', code: `function onLoad() {\n${call('a')}}` },
    { name: 'two requests is within the default limit', context: 'client_script', code: `function onLoad() {\n${call('a')}${call('b')}}` },
    { name: 'requests in separate functions', context: 'client_script', code: `function onLoad() {\n${call('a')}${call('b')}}\nfunction later() {\n${call('c')}}` },
    { name: 'limit raised by option', context: 'client_script', config: { rules: { 'SN-AJAX-001': ['warning', { maxRequests: 3 }] } }, code: `function onLoad() {\n${call('a')}${call('b')}${call('c')}}` }
  ],
  invalid: [
    {
      name: 'GlideAjax in a loop',
      context: 'client_script',
      code: "function onLoad() {\n  for (var i = 0; i < ids.length; i++) {\n    var ga = new GlideAjax('Utils');\n    ga.addParam('sysparm_name', 'lookup');\n    ga.getXMLAnswer(show);\n  }\n}\nfunction show(a) {}",
      findings: [{ line: 5, severity: 'WARNING', message: /GlideAjax getXMLAnswer\(\) inside a loop \(line 2\)/ }]
    },
    {
      name: 'getReference in forEach',
      context: 'client_script',
      code: "function onLoad() {\n  fields.forEach(function (f) {\n    g_form.getReference(f, show);\n  });\n}",
      findings: [{ line: 3, message: /g_form\.getReference\(\) inside a loop/ }]
    },
    {
      name: 'three requests in one function',
      context: 'client_script',
      code: `function onLoad() {\n${call('a')}${call('b')}${call('c')}}`,
      findings: [{ line: 10, severity: 'INFO', message: /^3 GlideAjax requests in one function/ }]
    }
  ]
});
