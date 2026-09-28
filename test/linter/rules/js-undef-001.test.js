import { runRuleTests } from '../helpers.js';

runRuleTests('JS-UNDEF-001', {
  valid: [
    {
      name: 'ServiceNow server globals in a Business Rule',
      code: "(function executeRule(current, previous) {\n  gs.info(current.number + ' ' + previous.state);\n})(current, previous);"
    },
    { name: 'client globals', code: "function onLoad() { g_form.setValue('a', g_user.userID); alert(getMessage('x')); }" },
    { name: 'PascalCase names are platform classes or Script Includes', code: 'var util = new IncidentUtils();\nvar arr = new ArrayUtil().unique([]);\nJSUtil.nil(util);' },
    { name: 'scoped app namespaces', code: "var r = new sn_ws.RESTMessageV2(); x_acme_app.Helper.run(r);" },
    { name: 'hoisted function declared later', code: 'run();\nfunction run() { return helper(); }\nfunction helper() { return 1; }' },
    { name: 'hoisted var declared later in the function', code: 'function f() { total = 1; var total; return total; }' },
    { name: 'typeof guard on an unknown name', code: "if (typeof customHelper !== 'undefined') { gs.info('ok'); }" },
    { name: 'configured globals', code: 'myGlobalHelper(1);', config: { globals: ['myGlobalHelper'] } },
    { name: 'transform map variables', code: "target.u_name = source.u_name;\nif (!source.u_email) { ignore = true; }\nlog.info(action);" },
    { name: 'catch parameter and destructuring', code: 'try { run(); } catch (err) { gs.error(err.message); }\nfunction run() { const { a, b: [c] } = obj(); return a + c; }\nfunction obj() { return {}; }' },
    { name: 'arguments inside a function', code: 'function f() { return arguments.length; }' },
    { name: 'assigned names are left to JS-GLOBAL-001', code: 'counter = 1;\ngs.info(counter);' }
  ],
  invalid: [
    {
      name: 'misspelled current gets a suggestion and stays an ERROR',
      code: "(function executeRule(current, previous) {\n  curent.update();\n})(current, previous);",
      findings: [{ line: 2, column: 3, severity: 'ERROR', confidence: 0.95, message: /'curent' is not defined\. Did you mean 'current'\?/ }]
    },
    {
      name: 'misspelled local variable',
      code: 'function f() {\n  var assignmentGroup = 1;\n  return asignmentGroup;\n}',
      findings: [{ line: 3, message: /Did you mean 'assignmentGroup'/ }]
    },
    {
      name: 'unknown lowercase variable',
      code: 'var total = price * quantity;',
      findings: [
        { line: 1, column: 13, severity: 'ERROR', confidence: 0.85, message: /'price' is not defined/ },
        { line: 1, column: 21, message: /'quantity' is not defined/ }
      ]
    },
    {
      name: 'unknown lowercase function is only a WARNING (may be a global Business Rule or UI Script)',
      code: 'calculateRisk(current);',
      findings: [{ severity: 'WARNING', confidence: 0.6, message: /'calculateRisk' is not defined/ }]
    },
    {
      name: 'reported once per name with a count',
      code: 'function f() { return widget + widget + widget; }',
      findings: [{ message: /'widget' is not defined \(3 uses\)/ }]
    },
    {
      name: 'block-scoped let is not visible outside its block',
      code: 'function f() {\n  if (a()) { let result = 1; }\n  return result;\n}\nfunction a() { return true; }',
      findings: [{ line: 3, message: /'result'/ }]
    }
  ]
});
