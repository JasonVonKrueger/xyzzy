import { runRuleTests } from '../helpers.js';

runRuleTests('SN-GR-010', {
  valid: [
    { name: 'correct order', code: "var gr = new GlideRecord('incident');\ngr.addActiveQuery();\ngr.orderBy('number');\ngr.query();\nwhile (gr.next()) { use(gr); }" },
    { name: 'get() then next is fine', code: "var gr = new GlideRecord('incident');\nif (gr.get(id)) { use(gr); }" },
    { name: 'query in another helper after escape', code: "var gr = new GlideRecord('incident');\nrunQuery(gr);\nwhile (gr.next()) { use(gr); }" },
    { name: 'next() in a callback runs later', code: "var gr = new GlideRecord('incident');\nvar read = function () { return gr.next(); };\ngr.query();\nread();" },
    { name: 'filter then query again', code: "var gr = new GlideRecord('incident');\ngr.query();\ngr.addQuery('active', true);\ngr.query();" },
    { name: 'filter before a later deleteMultiple', code: "var gr = new GlideRecord('u_log');\ngr.addQuery('x', 1);\ngr.query();\ngr.addQuery('y', 2);\ngr.deleteMultiple();" },
    { name: 'filter in a loop that also queries', code: "var gr = new GlideRecord('task');\nfor (var i = 0; i < ids.length; i++) {\n  gr.query();\n  gr.addQuery('parent', ids[i]);\n}" },
    { name: 'query later in the same loop body', code: "var gr = new GlideRecord('task');\nwhile (gr.next() || first) {\n  first = false;\n  gr.query();\n}" },
    { name: 'escape after the late filter', code: "var gr = new GlideRecord('task');\ngr.query();\ngr.addQuery('active', true);\nrun(gr);" }
  ],
  invalid: [
    {
      name: 'next() before query()',
      code: "var gr = new GlideRecord('incident');\ngr.addActiveQuery();\nwhile (gr.next()) { use(gr); }",
      findings: [{ line: 3, severity: 'ERROR', message: /gr\.next\(\) is called before gr\.query\(\)/ }]
    },
    {
      name: 'filter after last query',
      code: "var gr = new GlideRecord('incident');\ngr.query();\ngr.addQuery('active', true);\nwhile (gr.next()) { use(gr); }",
      findings: [{ line: 3, severity: 'WARNING', message: /gr\.addQuery\(\) comes after the last query\(\) \(line 2\) and has no effect/ }]
    },
    {
      name: 'setLimit after query',
      code: "var gr = new GlideRecord('incident');\ngr.addActiveQuery();\ngr.query();\ngr.setLimit(1);",
      findings: [{ severity: 'WARNING', message: /setLimit/ }]
    }
  ]
});
