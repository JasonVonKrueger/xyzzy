import { runRuleTests } from '../helpers.js';

runRuleTests('SN-BR-003', {
  valid: [
    { name: 'commented use', code: "var gr = new GlideRecord('incident');\ngr.addQuery('state', 6);\ngr.query();\nwhile (gr.next()) {\n  // Data fix: closing old records must not send notifications.\n  gr.setWorkflow(false);\n  gr.update();\n}" },
    { name: 'comment on the same line', code: "var gr = new GlideRecord('u_log');\ngr.setWorkflow(false); // bulk cleanup, no rules on u_log\ngr.deleteMultiple();" },
    { name: 'setWorkflow(true)', code: "var gr = new GlideRecord('incident');\ngr.setWorkflow(true);" },
    { name: 'object handed to a helper that writes', code: "var gr = new GlideRecord('incident');\n// quiet save\ngr.setWorkflow(false);\nsaveQuietly(gr);" },
    { name: 'client code is out of scope', context: 'client_script', code: "function onLoad() { var gr = new GlideRecord('incident'); gr.setWorkflow(false); }" }
  ],
  invalid: [
    {
      name: 'no write follows',
      code: "var gr = new GlideRecord('incident');\ngr.get(id);\ngr.setWorkflow(false);\ngs.info(gr.number);",
      findings: [{ line: 3, severity: 'WARNING', message: /gr\.setWorkflow\(false\) has no effect/ }]
    },
    {
      name: 'write only before it',
      code: "var gr = new GlideRecord('incident');\ngr.get(id);\ngr.update();\ngr.setWorkflow(false);",
      findings: [{ line: 4, severity: 'WARNING' }]
    },
    {
      name: 'uncommented use',
      code: "var gr = new GlideRecord('incident');\ngr.get(id);\ngr.setWorkflow(false);\ngr.update();",
      findings: [{ line: 3, severity: 'INFO', message: /skips all Business Rules and notifications/ }]
    },
    {
      name: 'on current in a Business Rule',
      context: 'business_rule',
      code: "(function executeRule(current, previous) {\n  current.setWorkflow(false);\n})(current, previous);",
      findings: [{ line: 2, severity: 'INFO', message: /^current\.setWorkflow/ }]
    }
  ]
});
