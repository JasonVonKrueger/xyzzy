import { runRuleTests } from '../helpers.js';

runRuleTests('SN-GR-002', {
  valid: [
    { name: 'static condition', code: "var gr = new GlideRecord('u_staging');\ngr.addQuery('sys_created_on', '<', cutoff);\ngr.deleteMultiple();" },
    { name: 'null query is a condition', code: "var gr = new GlideRecord('u_staging');\ngr.addNullQuery('u_parent');\ngr.deleteMultiple();" },
    { name: 'single-argument addQuery with a literal encoded query', code: "var gr = new GlideRecord('u_staging');\ngr.addQuery('active=false');\ngr.deleteMultiple();" },
    { name: 'updateMultiple is a different rule', code: "var gr = new GlideRecord('u_staging');\ngr.updateMultiple();" },
    { name: 'client-side code is out of scope', context: 'client', code: "var gr = new GlideRecord('u_staging'); gr.deleteMultiple();" }
  ],
  invalid: [
    {
      name: 'no conditions',
      code: "var gr = new GlideRecord('u_staging');\ngr.deleteMultiple();",
      findings: [{ line: 2, column: 1, severity: 'ERROR', message: /deletes every record in 'u_staging'/, explanation: /cascading deletes/ }]
    },
    {
      name: 'query() alone is not a condition',
      code: "var gr = new GlideRecord('u_staging');\ngr.query();\ngr.deleteMultiple();",
      findings: [{ line: 3, severity: 'ERROR' }]
    },
    {
      name: 'single-argument addQuery with a variable is weak',
      code: "var gr = new GlideRecord('u_staging');\ngr.addQuery(filter);\ngr.deleteMultiple();",
      findings: [{ severity: 'WARNING', confidence: 0.6 }]
    },
    {
      name: 'filter inside a callback does not count',
      code: "var gr = new GlideRecord('u_staging');\nids.forEach(function (id) { gr.addQuery('sys_id', id); });\ngr.deleteMultiple();",
      findings: [{ severity: 'WARNING' }]
    },
    {
      name: 'unknown context still checked',
      code: "var gr = new global.GlideRecord('u_staging'); gr.deleteMultiple();",
      findings: [{ severity: 'ERROR' }]
    }
  ]
});
