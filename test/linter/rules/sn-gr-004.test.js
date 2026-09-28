import { runRuleTests } from '../helpers.js';

runRuleTests('SN-GR-004', {
  valid: [
    { name: 'filtered', code: "var gr = new GlideRecord('incident');\ngr.addActiveQuery();\ngr.query();" },
    { name: 'limited', code: "var gr = new GlideRecord('incident');\ngr.setLimit(10);\ngr.query();" },
    { name: 'GlideAggregate counts the table', code: "var ga = new GlideAggregate('incident');\nga.addAggregate('COUNT');\nga.query();" },
    { name: 'weak filter is not reported', code: "var gr = new GlideRecord('incident');\ngr.addEncodedQuery(q);\ngr.query();" },
    { name: 'escaped before query', code: "var gr = new GlideRecord('incident');\nfilter(gr);\ngr.query();" },
    {
      name: 'allowUnfilteredTables option',
      config: { rules: { 'SN-GR-004': ['warning', { allowUnfilteredTables: ['u_settings'] }] } },
      code: "var gr = new GlideRecord('u_settings');\ngr.query();"
    },
    { name: 'client-side code is out of scope', context: 'client_script', code: "function onLoad() { var gr = new GlideRecord('incident'); gr.query(); }" }
  ],
  invalid: [
    {
      name: 'unfiltered query',
      code: "var gr = new GlideRecord('incident');\ngr.query();\nwhile (gr.next()) { gs.info(gr.number); }",
      findings: [{ line: 2, severity: 'WARNING', message: /gr\.query\(\) on 'incident' has no conditions and no setLimit\(\)/ }]
    },
    {
      name: 'option lists other tables only',
      config: { rules: { 'SN-GR-004': ['warning', { allowUnfilteredTables: ['u_settings'] }] } },
      code: "var gr = new GlideRecord('task');\ngr.query();",
      findings: [{ line: 2 }]
    },
    {
      name: 'table from a variable',
      code: 'var gr = new GlideRecord(tableName);\ngr.query();',
      findings: [{ message: /on the table/ }]
    }
  ]
});
