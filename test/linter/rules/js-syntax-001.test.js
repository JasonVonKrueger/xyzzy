import assert from 'node:assert/strict';
import test from 'node:test';

import { lintText } from '../../../src/linter/index.js';
import { runRuleTests } from '../helpers.js';

runRuleTests('JS-SYNTAX-001', {
  valid: [
    { name: 'ES5 global-scope script', code: 'var gr = new GlideRecord("incident");\ngr.query();' },
    { name: 'ES2021 scoped-app syntax', code: 'const total = items?.reduce((sum, item) => sum + (item.qty ?? 0), 0);' },
    { name: 'return outside a function (script fields)', code: 'if (!current.active) return;\nanswer = true;' },
    { name: 'ES module (ServiceNow SDK)', code: "import { gs } from '@servicenow/glide';\nexport function run() { gs.info('x'); }" }
  ],
  invalid: [
    {
      name: 'unexpected token',
      code: 'var a = 1;\nvar b = ;',
      findings: [{ line: 2, column: 9, severity: 'ERROR', code: 'var b = ;', message: /Unexpected token/ }]
    },
    {
      name: 'unterminated block',
      code: 'function onLoad() {\n  g_form.setValue("a", 1);\n',
      findings: [{ line: 3, severity: 'ERROR' }]
    }
  ]
});

test('JS-SYNTAX-001 is the only finding when the script cannot be parsed', () => {
  const result = lintText('eval(x);\nvar b = ;  ');

  assert.deepEqual(
    result.findings.map((finding) => finding.ruleId),
    ['JS-SYNTAX-001']
  );
  assert.equal(result.metrics, null);
});

test('JS-SYNTAX-001 honours the configured ecmaVersion', () => {
  const result = lintText('const a = () => 1;', { config: { ecmaVersion: 5 } });

  assert.equal(result.findings[0]?.ruleId, 'JS-SYNTAX-001');
});
