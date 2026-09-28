import { runRuleTests } from '../helpers.js';

runRuleTests('PORT-001', {
  valid: [
    { name: 'REST Message record', code: "var r = new sn_ws.RESTMessageV2('Jira', 'post');" },
    { name: 'endpoint from a property', code: "r.setEndpoint(gs.getProperty('x_app.jira.url') + '/issue');" },
    { name: 'REST Message variable substitution', code: "r.setEndpoint('https://${host}/api/issue');" },
    { name: 'instance URLs are PORT-003', code: "r.setEndpoint('https://acme.service-now.com/api/now/table/incident');" },
    { name: 'relative path', code: "r.setEndpoint('/api/now/table/incident');" }
  ],
  invalid: [
    {
      name: 'literal endpoint',
      code: "r.setEndpoint('https://acme.atlassian.net/rest/api/2/issue');",
      findings: [{ line: 1, column: 15, severity: 'WARNING', message: /^Hardcoded endpoint https:\/\/acme\.atlassian\.net in setEndpoint\(\)\.$/ }]
    },
    {
      name: 'concatenated endpoint',
      code: "r.setEndpoint('https://api.example.com/v1/users/' + id);",
      findings: [{ message: /https:\/\/api\.example\.com/ }]
    },
    {
      name: 'GlideHTTPRequest',
      code: "var req = new GlideHTTPRequest(`http://10.0.0.5:8080/status`);",
      findings: [{ message: /http:\/\/10\.0\.0\.5:8080 in new GlideHTTPRequest\(\)/ }]
    }
  ]
});
