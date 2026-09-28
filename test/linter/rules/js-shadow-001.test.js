import { runRuleTests } from '../helpers.js';

runRuleTests('JS-SHADOW-001', {
  valid: [
    { name: 'current and previous as parameters', code: '(function executeRule(current, previous) {})(current, previous);\nfunction helper(current) { return current.number; }' },
    { name: 'ordinary names', code: 'var grIncident = new GlideRecord("incident");' },
    { name: 'generic browser names are not protected', code: 'function f() { var document = getDoc(); return document; }' },
    { name: 'server globals do not exist in client scripts', code: "function onLoad() { var current = g_form.getValue('state'); alert(current); }" },
    { name: 'code of unknown origin (current/previous are just words)', code: 'function walk(node) { for (var current = node; current; current = current.parent) {} }' }
  ],
  invalid: [
    {
      name: 'var current inside a Business Rule',
      code: "(function executeRule(current, previous) {\n  var gr = new GlideRecord('task');\n  gr.get(current.parent);\n  var current = gr;\n})(current, previous);",
      findings: [{ line: 4, column: 7, severity: 'WARNING', message: /'current' hides the ServiceNow global current/ }]
    },
    {
      name: 'local gs in a Script Include',
      code: 'function f() { var gs = {}; return gs; }',
      context: 'script_include',
      findings: [{ message: /GlideSystem \(gs\)/ }]
    },
    {
      name: 'g_form redeclared in a client script',
      code: "function onLoad() {\n  var g_form = window.g_form;\n}",
      findings: [{ line: 2, message: /GlideForm \(g_form\)/ }]
    },
    {
      name: 'restricted JavaScript name as a parameter',
      code: 'function f(undefined) { return undefined; }',
      findings: [{ message: /'undefined' is a built-in JavaScript name/ }]
    }
  ]
});
