import { runRuleTests } from '../helpers.js';

runRuleTests('SEC-005', {
  valid: [
    { name: 'parameter used as a value', context: 'script_include', code: "var gr = new GlideRecord('incident');\ngr.addQuery('caller_id', this.getParameter('sysparm_user'));\ngr.get(this.getParameter('sysparm_id'));" },
    { name: 'allowlist lookup through a validator', context: 'script_include', code: "var table = validateTable(this.getParameter('sysparm_table'));\nvar gr = new GlideRecord(table);" },
    { name: 'constant table', context: 'scripted_rest', code: "(function process(request, response) {\n  var gr = new GlideRecord('incident');\n  gr.addQuery('number', request.queryParams.number);\n  gr.query();\n})(request, response);" },
    { name: 'input outside portal is just a variable name', context: 'script_include', code: 'var gr = new GlideRecord(input);' },
    { name: 'client code is out of scope', context: 'client_script', code: "function onLoad() { var gr = new GlideRecord(g_form.getParameter('x')); }" }
  ],
  invalid: [
    {
      name: 'table from getParameter through a variable',
      context: 'script_include',
      code: "var table = this.getParameter('sysparm_table');\nvar gr = new GlideRecord(table);\ngr.query();",
      findings: [{ line: 2, column: 26, severity: 'ERROR', confidence: 0.9, message: /^The table name of new GlideRecord\(\) comes from the request \(table\)\.$/ }]
    },
    {
      name: 'encoded query from Scripted REST body',
      context: 'scripted_rest',
      code: "(function process(request, response) {\n  var q = request.body.data.query;\n  var gr = new GlideRecord('incident');\n  gr.addEncodedQuery(q);\n  gr.query();\n})(request, response);",
      findings: [{ line: 4, severity: 'WARNING', confidence: 0.85, message: /encoded query passed to addEncodedQuery\(\)/ }]
    },
    {
      name: 'field name via propagation',
      context: 'script_include',
      code: "var raw = this.getParameter('sysparm_field');\nvar field = raw.trim();\ngr.setValue(field, 'x');",
      findings: [{ line: 3, message: /field name passed to setValue\(\)/ }]
    },
    {
      name: 'checked value is low confidence',
      context: 'script_include',
      code: "var table = this.getParameter('sysparm_table');\nif (ALLOWED.indexOf(table) < 0) { return; }\nvar gr = new GlideRecord(table);",
      findings: [{ severity: 'WARNING', confidence: 0.5 }]
    },
    {
      name: 'GlideRecordSecure is a warning',
      context: 'script_include',
      code: "var gr = new GlideRecordSecure(this.getParameter('sysparm_table'));",
      findings: [{ severity: 'WARNING', confidence: 0.6, explanation: /still enforces ACLs/ }]
    },
    {
      name: 'portal input',
      context: 'portal_server',
      code: "(function () {\n  var gr = new GlideRecord(input.table);\n})();",
      findings: [{ message: /\(input\.table\)/ }]
    }
  ]
});
