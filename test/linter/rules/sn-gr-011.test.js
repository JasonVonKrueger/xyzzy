import { runRuleTests } from '../helpers.js';

runRuleTests('SN-GR-011', {
  valid: [
    { name: 'setValue', code: "var gr = new GlideRecord('incident');\ngr.addActiveQuery();\ngr.setValue('state', 7);\ngr.updateMultiple();" },
    { name: 'assignment in a next loop with update()', code: "var gr = new GlideRecord('incident');\ngr.addActiveQuery();\ngr.query();\nwhile (gr.next()) { gr.state = 7; gr.update(); }" },
    { name: 'assignment without updateMultiple', code: "var gr = new GlideRecord('incident');\ngr.initialize();\ngr.short_description = 'x';\ngr.insert();" },
    { name: 'assignment after updateMultiple', code: "var gr = new GlideRecord('incident');\ngr.addActiveQuery();\ngr.setValue('state', 7);\ngr.updateMultiple();\ngr.state = 1;" }
  ],
  invalid: [
    {
      name: 'direct assignment',
      code: "var gr = new GlideRecord('incident');\ngr.addQuery('active', true);\ngr.state = 7;\ngr.updateMultiple();",
      findings: [{ line: 3, severity: 'WARNING', message: /gr\.state is assigned directly before gr\.updateMultiple\(\)/, recommendation: /gr\.setValue\('state', 7\)/ }]
    }
  ]
});
