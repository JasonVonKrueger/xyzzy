import { runRuleTests } from '../helpers.js';

const br = (body) => `(function executeRule(current, previous) {\n${body}\n})(current, previous);`;
const REST = "var r = new sn_ws.RESTMessageV2('Jira', 'post');\nr.setRequestBody(body);\nvar response = r.execute();";

runRuleTests('SN-BR-004', {
  valid: [
    { name: 'async Business Rule', context: 'business_rule', record: { when: 'async' }, code: br(REST) },
    { name: 'executeAsync without waiting', context: 'business_rule', code: br("var r = new sn_ws.RESTMessageV2('Jira', 'post');\nr.executeAsync();") },
    { name: 'event instead of a call', context: 'business_rule', code: br("gs.eventQueue('x.sync', current);") },
    { name: 'unrelated execute()', context: 'business_rule', code: br("var job = new MyJob();\njob.execute();") },
    { name: 'script include is out of scope', context: 'script_include', code: REST }
  ],
  invalid: [
    {
      name: 'RESTMessageV2.execute() with unknown timing',
      context: 'business_rule',
      code: br(REST),
      findings: [{ line: 4, severity: 'WARNING', confidence: 0.75, message: /RESTMessageV2\.execute\(\) waits for a remote system inside a Business Rule/ }]
    },
    {
      name: 'known synchronous timing',
      context: 'business_rule',
      record: { when: 'before' },
      code: br(REST),
      findings: [{ confidence: 0.9, message: /inside a before Business Rule/ }]
    },
    {
      name: 'waitForResponse after executeAsync',
      context: 'business_rule',
      code: br("var r = new sn_ws.RESTMessageV2('Jira', 'post');\nvar response = r.executeAsync();\nresponse.waitForResponse(60);"),
      findings: [{ line: 4, message: /waitForResponse\(\)/ }]
    },
    {
      name: 'chained SOAP call and GlideHTTPRequest',
      context: 'business_rule',
      code: br("var res = new SOAPMessageV2('Svc', 'op').execute();\nvar http = new GlideHTTPRequest(url);\nhttp.post(body);"),
      findings: [{ line: 2, message: /SOAPMessageV2\.execute/ }, { line: 4, message: /GlideHTTPRequest\.post/ }]
    }
  ]
});
