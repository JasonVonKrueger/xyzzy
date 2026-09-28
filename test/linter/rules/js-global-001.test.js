import { runRuleTests } from '../helpers.js';

runRuleTests('JS-GLOBAL-001', {
  valid: [
    { name: 'declared variable', code: 'function f() { var count = 0; count = 1; return count; }' },
    { name: 'answer in a condition script', code: "answer = current.active == true;" },
    { name: 'transform map ignore/error', code: 'if (!source.u_id) { ignore = true; error = true; error_message = "missing id"; }' },
    { name: 'portal server data object', code: 'data.items = []; data = data || {};' },
    { name: 'property writes are not variable writes', code: "g_scratchpad.isManager = true;\ncurrent.state = 2;" },
    { name: 'writable configured global', code: 'sharedCache = {};', config: { globals: { sharedCache: 'writable' } } }
  ],
  invalid: [
    {
      name: 'missing var inside a Business Rule function (server explanation)',
      code: "(function executeRule(current, previous) {\n  grTask = new GlideRecord('task');\n  grTask.query();\n})(current, previous);",
      findings: [{ line: 2, column: 3, severity: 'WARNING', message: /'grTask' is assigned without being declared/, explanation: /Rhino global scope/ }]
    },
    {
      name: 'client script (window explanation)',
      code: "function onLoad() {\n  lastValue = g_form.getValue('state');\n}",
      findings: [{ line: 2, explanation: /property on window/ }]
    },
    {
      name: 'for-in over an undeclared name',
      code: 'function f(obj) { for (key in obj) { gs.info(key); } }',
      findings: [{ message: /'key'/ }]
    },
    {
      name: 'readonly configured global is still reported when assigned',
      code: 'helperConfig = 1;',
      config: { globals: ['helperConfig'] },
      findings: [{ message: /'helperConfig'/ }]
    }
  ]
});
