import { runRuleTests } from '../helpers.js';

const resource = (body) => `(function process(request, response) {\n${body}\n})(request, response);`;

runRuleTests('SEC-006', {
  valid: [
    { name: 'read only', context: 'scripted_rest', code: resource("  var gr = new GlideRecord('incident');\n  gr.get(request.pathParams.id);\n  response.setBody({ number: gr.getValue('number') });") },
    { name: 'role check', context: 'scripted_rest', code: resource("  if (!gs.hasRole('itil')) { throw new sn_ws_err.ForbiddenError('no'); }\n  var gr = new GlideRecord('incident');\n  gr.initialize();\n  gr.insert();") },
    { name: 'GlideRecordSecure', context: 'scripted_rest', code: resource("  var gr = new GlideRecordSecure('incident');\n  gr.initialize();\n  gr.insert();") },
    { name: 'canWrite', context: 'scripted_rest', code: resource("  var gr = new GlideRecord('incident');\n  gr.get(id);\n  if (gr.canWrite()) { gr.update(); }") },
    { name: 'other contexts are out of scope', context: 'script_include', code: "var gr = new GlideRecord('incident'); gr.insert();" }
  ],
  invalid: [
    {
      name: 'unchecked insert',
      context: 'scripted_rest',
      code: resource("  var gr = new GlideRecord('incident');\n  gr.initialize();\n  gr.short_description = request.body.data.text;\n  gr.insert();"),
      findings: [{ line: 5, severity: 'WARNING', confidence: 0.6, message: /gr\.insert\(\) writes 'incident' from a Scripted REST resource/ }]
    }
  ]
});
