import { runRuleTests } from '../helpers.js';

const body = (lines) => Array.from({ length: lines }, (_, i) => `  step${i}();`).join('\n');

runRuleTests('CPLX-001', {
  valid: [
    { name: 'within the default limit', code: `function short() {\n${body(70)}\n}` },
    { name: 'top-level code is CPLX-002', config: { thresholds: { maxFunctionLength: 3 } }, code: body(10) },
    { name: 'exactly at the limit', config: { thresholds: { maxFunctionLength: 5 } }, code: `function f() {\n${body(3)}\n}` }
  ],
  invalid: [
    {
      name: 'declaration over the default limit',
      code: `function longOne() {\n${body(80)}\n}`,
      findings: [{ line: 1, column: 1, severity: 'INFO', message: /^Function longOne\(\) is 82 lines long \(maximum 75\)\.$/ }]
    },
    {
      name: 'Script Include method with a configured limit',
      config: { thresholds: { maxFunctionLength: 3 } },
      code: `var U = Class.create();\nU.prototype = {\n  run: function () {\n${body(4)}\n  },\n  type: 'U'\n};`,
      findings: [{ line: 3, column: 8, message: /^Function run\(\) is 6 lines long \(maximum 3\)\.$/ }]
    },
    {
      name: 'anonymous function',
      config: { thresholds: { maxFunctionLength: 2 } },
      code: `items.forEach(function () {\n${body(3)}\n});`,
      findings: [{ message: /^Anonymous function \(line 1\) is 5 lines long/ }]
    }
  ]
});
