import { runRuleTests } from '../helpers.js';

runRuleTests('INT-002', {
  valid: [
    { name: 'both inside try', code: "try {\n  var r = new sn_ws.RESTMessageV2('Jira', 'get');\n  var response = r.execute();\n  var data = JSON.parse(response.getBody());\n} catch (e) {\n  gs.error('Jira call failed: ' + e.message, 'Jira');\n}" },
    { name: 'parsing something else', code: 'var cfg = JSON.parse(gs.getProperty("x_app.config"));' },
    { name: 'try without catch does not count, but parse of non-body is fine', code: "try { var x = JSON.parse(text); } finally { done(); }" }
  ],
  invalid: [
    {
      name: 'execute outside try',
      code: "var r = new sn_ws.RESTMessageV2('Jira', 'get');\nvar response = r.execute();",
      findings: [{ line: 2, severity: 'INFO', message: /^r\.execute\(\) is not inside try\/catch\.$/ }]
    },
    {
      name: 'parse of a body variable outside try',
      code: "try {\n  var r = new sn_ws.RESTMessageV2('Jira', 'get');\n  var response = r.execute();\n} catch (e) { gs.error(e.message); }\nvar body = response.getBody();\nvar data = JSON.parse(body);",
      findings: [{ line: 6, severity: 'WARNING', message: /JSON\.parse\(\) of a response body outside try\/catch/ }]
    },
    {
      name: 'try/finally is not error handling',
      code: "var r = new sn_ws.RESTMessageV2('Jira', 'get');\ntry { var response = r.execute(); } finally { cleanup(); }",
      findings: [{ line: 2, severity: 'INFO' }]
    },
    {
      name: 'try in an outer function does not cover a callback',
      code: "try {\n  items.forEach(function (i) { JSON.parse(i.response.getBody()); });\n} catch (e) { gs.error(e.message); }",
      findings: [{ line: 2 }]
    }
  ]
});
