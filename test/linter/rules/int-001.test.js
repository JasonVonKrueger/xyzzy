import { runRuleTests } from '../helpers.js';

runRuleTests('INT-001', {
  valid: [
    { name: 'status checked', code: "var r = new sn_ws.RESTMessageV2('Jira', 'get');\nvar response = r.execute();\nif (response.getStatusCode() == 200) { use(response.getBody()); }" },
    { name: 'haveError checked', code: "var r = new sn_ws.RESTMessageV2('Jira', 'get');\nvar response = r.execute();\nif (!response.haveError()) { use(response.getBody()); }" },
    { name: 'response returned to the caller', code: "function call() {\n  var r = new sn_ws.RESTMessageV2('Jira', 'get');\n  var response = r.execute();\n  return response;\n}" },
    { name: 'body never read', code: "var r = new sn_ws.RESTMessageV2('Jira', 'post');\nvar response = r.execute();\ngs.info(response.getHeader('x'));" },
    { name: 'client code is out of scope', context: 'client_script', code: "function onLoad() { var r = new sn_ws.RESTMessageV2(); var x = r.execute(); x.getBody(); }" }
  ],
  invalid: [
    {
      name: 'body without status',
      code: "var r = new sn_ws.RESTMessageV2('Jira', 'get');\nvar response = r.execute();\nvar data = JSON.parse(response.getBody());",
      findings: [{ line: 3, column: 23, severity: 'WARNING', message: /^response\.getBody\(\) is used without checking the HTTP status\.$/ }]
    },
    {
      name: 'chained',
      code: "var r = new RESTMessageV2('Jira', 'get');\nvar body = r.execute().getBody();",
      findings: [{ message: /^r\.execute\(\)\.getBody\(\)/ }]
    },
    {
      name: 'async response and SOAP',
      code: "var s = new sn_ws.SOAPMessageV2('Svc', 'op');\nvar res = s.executeAsync();\nres.waitForResponse(30);\nuse(res.getBody());",
      findings: [{ line: 4, message: /res\.getBody\(\)/ }]
    }
  ]
});
