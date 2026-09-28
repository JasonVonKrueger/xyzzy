import { runRuleTests } from '../helpers.js';

const lines = (count) => Array.from({ length: count }, (_, i) => `step${i}();`).join('\n');

runRuleTests('CPLX-002', {
  valid: [
    { name: 'short file', code: lines(20) },
    { name: 'at the configured limit', config: { thresholds: { maxFileLength: 10 } }, code: lines(10) }
  ],
  invalid: [
    {
      name: 'over the default limit',
      code: lines(501),
      findings: [{ line: 1, column: 1, severity: 'INFO', message: /^Script is 501 lines long \(maximum 500\), with 0 functions\.$/ }]
    },
    {
      name: 'configured limit',
      config: { thresholds: { maxFileLength: 3 } },
      code: 'function a() {}\nfunction b() {}\n\nstep();',
      findings: [{ message: /4 lines long \(maximum 3\), with 2 functions/ }]
    }
  ]
});
