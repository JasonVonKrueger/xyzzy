import { runRuleTests } from '../helpers.js';

runRuleTests('SN-GR-007', {
  valid: [
    { name: 'setLimit(1)', code: "var gr = new GlideRecord('incident');\ngr.addQuery('caller_id', id);\ngr.setLimit(1);\ngr.query();\nif (gr.next()) { use(gr); }" },
    { name: 'loop over results', code: "var gr = new GlideRecord('incident');\ngr.addQuery('caller_id', id);\ngr.query();\nwhile (gr.next()) { use(gr); }" },
    { name: 'sys_id lookup', code: "var gr = new GlideRecord('incident');\ngr.addQuery('sys_id', id);\ngr.query();\nif (gr.next()) { use(gr); }" },
    { name: 'GlideAggregate', code: "var ga = new GlideAggregate('incident');\nga.addQuery('active', true);\nga.addAggregate('COUNT');\nga.query();\nif (ga.next()) { count = ga.getAggregate('COUNT'); }" },
    { name: 'unfiltered is left to SN-GR-004', code: "var gr = new GlideRecord('incident');\ngr.query();\nif (gr.next()) { use(gr); }" },
    { name: 'next() inside a for loop reads several rows', code: "var gr = new GlideRecord('incident');\ngr.addActiveQuery();\ngr.query();\nfor (var i = 0; i < 5; i++) { if (gr.next()) { use(gr); } }" },
    { name: 'hasNext() only checks existence', code: "var gr = new GlideRecord('incident');\ngr.addActiveQuery();\ngr.query();\nreturn gr.hasNext();" }
  ],
  invalid: [
    {
      name: 'if (gr.next())',
      code: "var gr = new GlideRecord('incident');\ngr.addQuery('caller_id', id);\ngr.query();\nif (gr.next()) { use(gr); }",
      findings: [{ line: 3, severity: 'INFO', message: /gr reads only the first matching record/ }]
    },
    {
      name: 'single read per outer loop iteration',
      code: "for (var i = 0; i < ids.length; i++) {\n  var gr = new GlideRecord('incident');\n  gr.addQuery('caller_id', ids[i]);\n  gr.query();\n  if (gr.next()) { use(gr); }\n}",
      findings: [{ line: 4 }]
    }
  ]
});
