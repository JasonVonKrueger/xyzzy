import { runRuleTests } from '../helpers.js';

const LOOKUP = (name) => `var ${name} = new GlideRecord('incident');\n${name}.addQuery('caller_id', current.caller_id);\n${name}.query();\n`;

runRuleTests('SN-GR-006', {
  valid: [
    { name: 'different conditions', code: LOOKUP('a') + "var b = new GlideRecord('incident');\nb.addQuery('caller_id', current.opened_by);\nb.query();" },
    { name: 'different tables', code: LOOKUP('a') + "var b = new GlideRecord('problem');\nb.addQuery('caller_id', current.caller_id);\nb.query();" },
    { name: 'table written in between', code: LOOKUP('a') + "var w = new GlideRecord('incident');\nw.initialize();\nw.insert();\n" + LOOKUP('b') },
    { name: 'mutually exclusive branches', code: `if (x) {\n${LOOKUP('a')}} else {\n${LOOKUP('b')}}` },
    { name: 'different functions', code: `function one() {\n${LOOKUP('a')}}\nfunction two() {\n${LOOKUP('b')}}` },
    { name: 'argument variable changes in between', code: "var id = first;\nvar a = new GlideRecord('incident');\na.addQuery('caller_id', id);\na.query();\nid = second;\nvar b = new GlideRecord('incident');\nb.addQuery('caller_id', id);\nb.query();" },
    { name: 'same object queried twice is not reported', code: "var a = new GlideRecord('incident');\na.addActiveQuery();\na.query();\na.query();" }
  ],
  invalid: [
    {
      name: 'identical lookup twice',
      code: LOOKUP('a') + LOOKUP('b'),
      findings: [{ line: 6, severity: 'WARNING', message: /The same query on 'incident' already ran on line 3/ }]
    },
    {
      name: 'whitespace differences do not matter',
      code: "var a = new GlideRecord('incident');\na.addQuery('active',true);\na.query();\nvar b = new GlideRecord('incident');\nb.addQuery('active', true);\nb.query();",
      findings: [{ line: 6 }]
    },
    {
      name: 'reassigned variable',
      code: "var gr = new GlideRecord('sys_user');\ngr.addQuery('user_name', 'admin');\ngr.query();\ngr = new GlideRecord('sys_user');\ngr.addQuery('user_name', 'admin');\ngr.query();",
      findings: [{ line: 6 }]
    }
  ]
});
