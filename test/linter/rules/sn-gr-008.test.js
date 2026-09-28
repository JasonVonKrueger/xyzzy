import { runRuleTests } from '../helpers.js';

runRuleTests('SN-GR-008', {
  valid: [
    { name: 'rows are also read', code: "var gr = new GlideRecord('incident');\ngr.addActiveQuery();\ngr.query();\ngs.info(gr.getRowCount());\nwhile (gr.next()) { use(gr); }" },
    { name: 'GlideAggregate', code: "var ga = new GlideAggregate('incident');\nga.addAggregate('COUNT');\nga.query();\nga.getRowCount();" },
    { name: 'object escapes', code: "var gr = new GlideRecord('incident');\ngr.query();\nvar n = gr.getRowCount();\nreturn gr;" }
  ],
  invalid: [
    {
      name: 'count only',
      code: "var gr = new GlideRecord('incident');\ngr.addActiveQuery();\ngr.query();\nvar count = gr.getRowCount();",
      findings: [{ line: 4, severity: 'WARNING', message: /gr\.getRowCount\(\) counts records by fetching all of them from 'incident'/, recommendation: /GlideAggregate/ }]
    },
    {
      name: 'count in a condition',
      code: "var gr = new GlideRecord('task');\ngr.addQuery('parent', id);\ngr.query();\nif (gr.getRowCount() > 0) { flag(); }",
      findings: [{ line: 4 }]
    }
  ]
});
