import { runRuleTests } from '../helpers.js';

runRuleTests('CPLX-004', {
  valid: [
    { name: 'at the limit', code: 'function f() {\n  if (a) { while (b) { for (;;) { if (c) { go(); } } } }\n}' },
    { name: 'else-if chains do not nest', code: 'function f() {\n  if (a) { go(); } else if (b) { go(); } else if (c) { go(); } else if (d) { go(); } else if (e) { if (f) { go(); } }\n}' },
    { name: 'nested function starts again at zero', code: 'if (a) { if (b) { if (c) { list.forEach(function () { if (d) { if (e) { go(); } } }); } } }' }
  ],
  invalid: [
    {
      name: 'five levels',
      code: "function sync() {\n  if (a) {\n    while (gr.next()) {\n      for (var i = 0; i < n; i++) {\n        try {\n          if (x) { go(); }\n        } catch (e) {}\n      }\n    }\n  }\n}",
      findings: [{ line: 6, column: 11, severity: 'WARNING', message: /^Function sync\(\) nests blocks 5 levels deep \(maximum 4\)\.$/ }]
    },
    {
      name: 'configured limit at top level',
      config: { thresholds: { maxNestingDepth: 1 } },
      code: 'if (a) {\n  if (b) { go(); }\n}',
      findings: [{ line: 2, column: 3, message: /^Top-level code nests blocks 2 levels deep \(maximum 1\)/ }]
    }
  ]
});
