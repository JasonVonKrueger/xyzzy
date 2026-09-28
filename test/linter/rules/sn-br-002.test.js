import { runRuleTests } from '../helpers.js';

const br = (body) => `(function executeRule(current, previous) {\n${body}\n})(current, previous);`;

runRuleTests('SN-BR-002', {
  valid: [
    { name: 'loads the parent record', context: 'business_rule', code: br("var gr = new GlideRecord('task');\ngr.get(current.parent);\ngr.update();") },
    { name: 'reads the same record without writing', context: 'business_rule', code: br("var gr = new GlideRecord('incident');\ngr.get(current.sys_id);\ngs.info(gr.number);") },
    { name: 'same table with setWorkflow(false)', context: 'business_rule', record: { table: 'incident' }, code: br("var gr = new GlideRecord('incident');\ngr.initialize();\ngr.setWorkflow(false);\ngr.insert();") },
    { name: 'same table unknown without metadata', context: 'business_rule', code: br("var gr = new GlideRecord('incident');\ngr.initialize();\ngr.insert();") },
    { name: 'other table', context: 'business_rule', record: { table: 'incident' }, code: br("var gr = new GlideRecord('task');\ngr.initialize();\ngr.insert();") }
  ],
  invalid: [
    {
      name: 'get(current.sys_id) then update',
      context: 'business_rule',
      code: br("var gr = new GlideRecord('incident');\ngr.get(current.sys_id);\ngr.state = 7;\ngr.update();"),
      findings: [{ line: 5, severity: 'ERROR', confidence: 0.85, message: /gr\.update\(\) writes the record this Business Rule is processing/ }]
    },
    {
      name: 'addQuery sys_id with getUniqueValue then deleteRecord',
      context: 'business_rule',
      code: br("var gr = new GlideRecord('task');\ngr.addQuery('sys_id', current.getUniqueValue());\ngr.query();\nif (gr.next()) { gr.deleteRecord(); }"),
      findings: [{ message: /gr\.deleteRecord\(\)/, explanation: /no longer exists/ }]
    },
    {
      name: 'get by field name',
      context: 'business_rule',
      code: br("var gr = new GlideRecord('incident');\ngr.get('sys_id', current.getValue('sys_id'));\ngr.update();"),
      findings: [{ severity: 'ERROR' }]
    },
    {
      name: 'same record with setWorkflow(false) is a warning',
      context: 'business_rule',
      code: br("var gr = new GlideRecord('incident');\ngr.get(current.sys_id);\ngr.setWorkflow(false);\ngr.update();"),
      findings: [{ severity: 'WARNING', confidence: 0.6 }]
    },
    {
      name: 'writes to its own table',
      context: 'business_rule',
      record: { table: 'incident', when: 'after' },
      code: br("var gr = new GlideRecord('incident');\ngr.initialize();\ngr.parent_incident = current.sys_id;\ngr.insert();"),
      findings: [{ line: 5, severity: 'WARNING', confidence: 0.6, message: /writes to 'incident', the table this Business Rule runs on/ }]
    }
  ]
});
