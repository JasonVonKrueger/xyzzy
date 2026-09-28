import { runRuleTests } from '../helpers.js';

runRuleTests('SN-CLIENT-006', {
  valid: [
    { name: 'standard guard', context: 'client_script', code: "function onChange(control, oldValue, newValue, isLoading) {\n  if (isLoading || newValue === '') { return; }\n  g_form.setValue('u_x', newValue);\n}" },
    { name: 'renamed parameter used', context: 'client_script', code: "function onChange(c, o, n, loading) {\n  if (!loading) { g_form.setValue('u_x', n); }\n}" },
    { name: 'empty template body is JS-FUNC-001', context: 'client_script', code: 'function onChange(control, oldValue, newValue, isLoading) {}' },
    { name: 'onLoad is unaffected', context: 'client_script', code: "function onLoad() { g_form.setValue('u_x', 1); }" },
    { name: 'nested onChange is not the entry point', context: 'client_script', code: "function onLoad() { function onChange(a, b, c, d) { go(); } onChange(); }" }
  ],
  invalid: [
    {
      name: 'isLoading ignored',
      context: 'client_script',
      code: "function onChange(control, oldValue, newValue, isLoading) {\n  g_form.clearValue('assigned_to');\n}",
      findings: [{ line: 1, column: 10, severity: 'WARNING', message: /onChange never checks isLoading/, recommendation: /if \(isLoading \|\| newValue === ''\)/ }]
    },
    {
      name: 'isLoading not declared',
      context: 'catalog_client_script',
      code: "function onChange(control, oldValue, newValue) {\n  g_form.clearValue('u_x');\n}",
      findings: [{ message: /does not declare or check isLoading/ }]
    }
  ]
});
