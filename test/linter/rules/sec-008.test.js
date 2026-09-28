import { runRuleTests } from '../helpers.js';

runRuleTests('SEC-008', {
  valid: [
    { name: 'constant HTML', context: 'client_script', code: "function onLoad() { el.innerHTML = '<b>' + 'Note' + '</b>'; }" },
    { name: 'text instead of HTML', context: 'client_script', code: 'function onLoad() { el.textContent = name; $j(el).text(name); }' },
    { name: 'escaped value', context: 'portal_client', code: 'api.controller = function () { el.innerHTML = escapeHtml(name); };' },
    { name: 'html() getter', context: 'client_script', code: 'function onLoad() { var h = $j(el).html(); }' },
    { name: 'html() on a non-jQuery object', context: 'client_script', code: 'function onLoad() { report.html(data); }' },
    { name: 'append assignment is not innerHTML', context: 'client_script', code: 'function onLoad() { el.innerHTML += ""; }' }
  ],
  invalid: [
    {
      name: 'innerHTML with a field value',
      context: 'client_script',
      code: "function onLoad() {\n  el.innerHTML = '<b>' + g_form.getValue('short_description') + '</b>';\n}",
      findings: [{ line: 2, severity: 'WARNING', confidence: 0.7, message: /^innerHTML receives a dynamic value/ }]
    },
    {
      name: 'jQuery html()',
      context: 'client_script',
      code: "function onLoad() { $j('#note').html(answer); }",
      findings: [{ message: /\$j\(\.\.\.\)\.html\(\) receives a dynamic value \(answer\)/ }]
    },
    {
      name: 'trustAsHtml in a portal widget',
      context: 'portal_client',
      code: 'api.controller = function ($sce) { c.html = $sce.trustAsHtml(c.data.description); };',
      findings: [{ message: /\$sce\.trustAsHtml\(\)/ }]
    },
    {
      name: 'document.write and insertAdjacentHTML',
      context: 'client_script',
      code: "function onLoad() {\n  document.write(msg);\n  el.insertAdjacentHTML('beforeend', msg);\n}",
      findings: [{ line: 2 }, { line: 3, message: /insertAdjacentHTML/ }]
    }
  ]
});
