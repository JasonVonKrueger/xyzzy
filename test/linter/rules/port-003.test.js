import { runRuleTests } from '../helpers.js';

runRuleTests('PORT-003', {
  valid: [
    { name: 'servlet URI property', code: "var link = gs.getProperty('glide.servlet.uri') + 'incident.do?sys_id=' + id;" },
    { name: 'relative link', context: 'client_script', code: "function onLoad() { var link = '/incident.do?sys_id=' + id; }" },
    { name: 'docs link is not an instance', code: "var help = 'https://docs.servicenow.com/bundle';" }
  ],
  invalid: [
    {
      name: 'instance link in an email script',
      code: "var link = 'https://acme.service-now.com/incident.do?sys_id=' + current.sys_id;",
      findings: [{ line: 1, severity: 'WARNING', message: /^Hardcoded instance host acme\.service-now\.com\.$/, recommendation: /glide\.servlet\.uri/ }]
    },
    {
      name: 'government cloud host in a template',
      code: 'var url = `https://agency.servicenowservices.com/api/${path}`;',
      findings: [{ message: /agency\.servicenowservices\.com/ }]
    },
    {
      name: 'client recommendation',
      context: 'client_script',
      code: "function onLoad() { top.location = 'https://acmedev.service-now.com/home.do'; }",
      findings: [{ recommendation: /relative URL/ }]
    }
  ]
});
