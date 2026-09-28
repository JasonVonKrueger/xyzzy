import { runRuleTests } from '../helpers.js';

runRuleTests('INT-003', {
  valid: [
    { name: 'timeout set', code: "var r = new sn_ws.RESTMessageV2('Jira', 'get');\nr.setHttpTimeout(15000);\nvar response = r.execute();" },
    { name: 'executeAsync', code: "var r = new sn_ws.RESTMessageV2('Jira', 'get');\nr.executeAsync();" },
    { name: 'configured by a helper', code: "var r = new sn_ws.RESTMessageV2('Jira', 'get');\nconfigure(r);\nr.execute();" }
  ],
  invalid: [
    {
      name: 'no timeout',
      code: "var r = new sn_ws.RESTMessageV2('Jira', 'get');\nvar response = r.execute();",
      findings: [{ line: 2, severity: 'INFO', message: /r\.execute\(\) has no setHttpTimeout\(\)/ }]
    },
    {
      name: 'timeout set after execute does not count',
      code: "var r = new sn_ws.RESTMessageV2('Jira', 'get');\nr.execute();\nr.setHttpTimeout(1000);",
      findings: [{ line: 2 }]
    }
  ]
});
