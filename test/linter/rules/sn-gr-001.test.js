import { runRuleTests } from '../helpers.js';

runRuleTests('SN-GR-001', {
  valid: [
    { name: 'static condition', code: "var gr = new GlideRecord('incident');\ngr.addQuery('active', false);\ngr.setValue('state', 7);\ngr.updateMultiple();" },
    { name: 'literal encoded query', code: "var gr = new GlideRecord('incident');\ngr.addEncodedQuery('active=false^state=6');\ngr.updateMultiple();" },
    { name: 'encoded query from a constant', code: "var QUERY = 'active=false';\nvar gr = new GlideRecord('incident');\ngr.addEncodedQuery(QUERY);\ngr.updateMultiple();" },
    { name: 'concatenated condition', code: "var gr = new GlideRecord('task');\ngr.addEncodedQuery('parent=' + current.sys_id);\ngr.updateMultiple();" },
    { name: 'one static filter among conditional ones', code: "var gr = new GlideRecord('task');\ngr.addActiveQuery();\nif (group) { gr.addQuery('assignment_group', group); }\ngr.updateMultiple();" },
    { name: 'object passed to a helper that may add conditions', code: "var gr = new GlideRecord('task');\napplyFilters(gr);\ngr.updateMultiple();" },
    { name: 'filter and update inside the same branch', code: "var gr = new GlideRecord('task');\nif (id) {\n  gr.addQuery('parent', id);\n  gr.updateMultiple();\n}" },
    { name: 'parameter of unknown origin is not tracked', code: 'function closeAll(gr) { gr.updateMultiple(); }' },
    { name: 'reassigned variable tracks the new object', code: "var gr = new GlideRecord('task');\ngr.addQuery('active', true);\ngr.query();\ngr = new GlideRecord('incident');\ngr.addQuery('state', 6);\ngr.updateMultiple();" },
    { name: 'client-side code is out of scope', context: 'client_script', code: "function onLoad() { var gr = new GlideRecord('incident'); gr.updateMultiple(); }" }
  ],
  invalid: [
    {
      name: 'no conditions',
      code: "var gr = new GlideRecord('incident');\ngr.setValue('state', 7);\ngr.updateMultiple();",
      findings: [{ line: 3, severity: 'ERROR', confidence: 0.95, message: /gr\.updateMultiple\(\) has no query conditions: it updates every record in 'incident'/ }]
    },
    {
      name: 'encoded query from a variable is weak',
      code: "var gr = new GlideRecord('incident');\ngr.addEncodedQuery(current.u_filter);\ngr.updateMultiple();",
      findings: [{ severity: 'WARNING', confidence: 0.6, message: /may run without conditions/ }]
    },
    {
      name: 'filter only inside a branch',
      code: "var gr = new GlideRecord('incident');\nif (group) { gr.addQuery('assignment_group', group); }\ngr.updateMultiple();",
      findings: [{ severity: 'WARNING', confidence: 0.6 }]
    },
    {
      name: 'encoded query with only ORDERBY',
      code: "var gr = new GlideRecord('incident');\ngr.addEncodedQuery('ORDERBYnumber');\ngr.updateMultiple();",
      findings: [{ severity: 'WARNING' }]
    },
    {
      name: 'empty encoded query literal',
      code: "var gr = new GlideRecord('incident');\ngr.addEncodedQuery('');\ngr.updateMultiple();",
      findings: [{ severity: 'WARNING' }]
    },
    {
      name: 'filter added after updateMultiple does not count',
      code: "var gr = new GlideRecord('incident');\ngr.updateMultiple();\ngr.addQuery('active', true);",
      findings: [{ line: 2, severity: 'ERROR' }]
    },
    {
      name: 'GlideRecordSecure and implicit global',
      code: "gr = new GlideRecordSecure('task');\ngr.updateMultiple();",
      findings: [{ severity: 'ERROR' }]
    },
    {
      name: 'runs in business rules',
      context: 'business_rule',
      code: "(function executeRule(current, previous) {\n  var gr = new GlideRecord('task');\n  gr.updateMultiple();\n})(current, previous);",
      findings: [{ line: 3, severity: 'ERROR' }]
    }
  ]
});
