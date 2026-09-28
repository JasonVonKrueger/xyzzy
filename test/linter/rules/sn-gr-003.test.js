import { runRuleTests } from '../helpers.js';

runRuleTests('SN-GR-003', {
  valid: [
    { name: 'filtered loop', code: "var gr = new GlideRecord('incident');\ngr.addQuery('state', 6);\ngr.query();\nwhile (gr.next()) {\n  gr.state = 7;\n  gr.update();\n}" },
    { name: 'batched with setLimit', code: "var gr = new GlideRecord('u_log');\ngr.setLimit(500);\ngr.query();\nwhile (gr.next()) { gr.deleteRecord(); }" },
    { name: 'update outside the loop', code: "var gr = new GlideRecord('incident');\ngr.query();\nif (gr.next()) { gr.update(); }" },
    { name: 'update of a different record inside the loop', code: "var gr = new GlideRecord('incident');\ngr.addActiveQuery();\ngr.query();\nwhile (gr.next()) {\n  var task = new GlideRecord('task');\n  task.get(gr.parent);\n  task.update();\n}" },
    { name: 'escaped before query', code: "var gr = new GlideRecord('incident');\naddConditions(gr);\ngr.query();\nwhile (gr.next()) { gr.update(); }" }
  ],
  invalid: [
    {
      name: 'update every record',
      code: "var gr = new GlideRecord('sys_user');\ngr.query();\nwhile (gr.next()) {\n  gr.active = false;\n  gr.update();\n}",
      findings: [{ line: 5, severity: 'ERROR', confidence: 0.9, message: /gr\.update\(\) in a loop over an unfiltered query updates every record in 'sys_user'/, explanation: /line 2/ }]
    },
    {
      name: 'deleteRecord with weak filter',
      code: "var gr = new GlideRecord('u_log');\ngr.addEncodedQuery(q);\ngr.query();\nwhile (gr.next()) { gr.deleteRecord(); }",
      findings: [{ severity: 'WARNING', confidence: 0.6, message: /deletes every record/ }]
    },
    {
      name: 'reported once per object',
      code: "var gr = new GlideRecord('u_log');\ngr.query();\nwhile (gr.next()) { gr.update(); gr.deleteRecord(); }",
      findings: [{ message: /gr\.update\(\)/ }]
    }
  ]
});
