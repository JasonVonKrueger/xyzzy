import { runRuleTests } from '../helpers.js';

runRuleTests('SN-GR-005', {
  valid: [
    { name: 'one query with IN', code: "var gr = new GlideRecord('sys_user');\ngr.addQuery('sys_id', 'IN', ids.join(','));\ngr.query();\nwhile (gr.next()) { names.push(gr.name); }" },
    { name: 'next() in the loop test is not a query', code: "var gr = new GlideRecord('incident');\ngr.addActiveQuery();\ngr.query();\nwhile (gr.next()) { gs.info(gr.caller_id.name); }" },
    { name: 'paging with chooseWindow', code: "var gr = new GlideRecord('u_log');\nfor (var page = 0; page < 10; page++) {\n  gr.chooseWindow(page * 100, page * 100 + 100);\n  gr.query();\n}" },
    { name: 'query in a function that is not a loop callback', code: "function lookup(id) {\n  var gr = new GlideRecord('sys_user');\n  gr.get(id);\n  return gr;\n}" },
    { name: 'for-in object is evaluated once', code: "var gr = new GlideRecord('incident');\ngr.addActiveQuery();\nfor (var key in loadMap(gr.query())) { use(key); }" }
  ],
  invalid: [
    {
      name: 'nested query in while(next)',
      code: "var gr = new GlideRecord('incident');\ngr.addActiveQuery();\ngr.query();\nwhile (gr.next()) {\n  var user = new GlideRecord('sys_user');\n  user.get(gr.caller_id);\n}",
      findings: [{ line: 6, severity: 'WARNING', message: /user\.get\(\) inside a loop \(line 4\)/ }]
    },
    {
      name: 'getRefRecord in a loop',
      code: "while (gr.next()) {\n  var caller = gr.caller_id.getRefRecord();\n}",
      findings: [{ line: 2, message: /getRefRecord\(\) inside a loop/ }]
    },
    {
      name: 'forEach callback',
      code: "ids.forEach(function (id) {\n  var gr = new GlideRecord('sys_user');\n  gr.addQuery('sys_id', id);\n  gr.query();\n});",
      findings: [{ line: 4, message: /forEach\(\) callback/ }]
    },
    {
      name: 'object created outside, queried inside',
      code: "var gr = new GlideRecord('task');\nfor (var i = 0; i < ids.length; i++) {\n  gr.initialize();\n  gr.addQuery('parent', ids[i]);\n  gr.query();\n}",
      findings: [{ line: 5 }]
    }
  ]
});
