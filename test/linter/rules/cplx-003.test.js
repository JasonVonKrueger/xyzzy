import { runRuleTests } from '../helpers.js';

const ifs = (count) => Array.from({ length: count }, (_, i) => `  if (x == ${i}) { go(${i}); }`).join('\n');

runRuleTests('CPLX-003', {
  valid: [
    { name: 'at the default limit', code: `function f(x) {\n${ifs(9)}\n}` },
    { name: 'complexity counted per function', code: `function a(x) {\n${ifs(6)}\n}\nfunction b(x) {\n${ifs(6)}\n}` }
  ],
  invalid: [
    {
      name: 'over the default limit',
      code: `function route(x) {\n${ifs(10)}\n}`,
      findings: [{ line: 1, column: 1, severity: 'WARNING', message: /^Function route\(\) has a cyclomatic complexity of 11 \(maximum 10\)\.$/ }]
    },
    {
      name: 'top-level code of a fix script',
      config: { thresholds: { maxComplexity: 2 } },
      code: 'if (a && b) { run(); }\nwhile (c) { step(); }',
      findings: [{ line: 1, message: /^Top-level code has a cyclomatic complexity of 4/ }]
    },
    {
      name: 'nested function does not add to its parent',
      config: { thresholds: { maxComplexity: 2 } },
      code: 'function outer() {\n  return function inner(x) { return x ? (x > 1 ? 2 : 1) : 0; };\n}',
      findings: [{ line: 2, message: /Function inner\(\) has a cyclomatic complexity of 3/ }]
    }
  ]
});
