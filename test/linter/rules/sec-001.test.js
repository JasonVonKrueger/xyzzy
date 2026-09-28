import { runRuleTests } from '../helpers.js';

runRuleTests('SEC-001', {
  valid: [
    { name: 'JSON.parse of a payload', code: 'var data = JSON.parse(request.body.dataString);' },
    { name: 'setTimeout with a function', code: 'setTimeout(function () { g_form.save(); }, 100);' },
    { name: 'method that happens to be named eval', code: 'var result = calculator.eval(expression);' },
    { name: 'GlideScopedEvaluator is not flagged', code: 'var evaluator = new GlideScopedEvaluator();\nevaluator.evaluateScript(gr, "script");' }
  ],
  invalid: [
    {
      name: 'eval of runtime data is an ERROR',
      code: 'var value = eval(current.u_expression);',
      findings: [{ line: 1, column: 13, severity: 'ERROR', confidence: 1, message: /eval\(\)/ }]
    },
    {
      name: 'eval of a constant string is downgraded to WARNING (low confidence)',
      code: "var config = eval('({ retries: 3 })');",
      findings: [{ severity: 'WARNING', confidence: 0.6 }]
    },
    {
      name: 'Function constructor',
      code: 'var fn = new Function("a", "return a + " + userInput);',
      findings: [{ severity: 'ERROR', message: /Function constructor/ }]
    },
    {
      name: 'string timer',
      code: 'setTimeout("doWork(" + id + ")", 50);',
      findings: [{ severity: 'ERROR', message: /setTimeout\(\) with a string/ }]
    },
    {
      name: 'window.eval in client code',
      code: 'function onLoad() { window.eval(g_form.getValue("u_script")); }',
      findings: [{ line: 1, severity: 'ERROR' }]
    },
    {
      name: 'GlideEvaluator.evaluateString',
      code: 'GlideEvaluator.evaluateString(current.u_script);',
      findings: [{ severity: 'ERROR', message: /GlideEvaluator\.evaluateString/ }]
    },
    {
      name: 'severity configured as warning is respected',
      code: 'eval(input);',
      severity: 'warning',
      findings: [{ severity: 'WARNING' }]
    }
  ]
});
