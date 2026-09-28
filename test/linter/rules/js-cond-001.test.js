import { runRuleTests } from '../helpers.js';

runRuleTests('JS-COND-001', {
  valid: [
    { name: 'real condition', code: "if (current.active == true) { gs.info('x'); }" },
    { name: 'while (true) loop', code: 'while (true) { if (done()) break; }' },
    { name: 'for (;;) loop', code: 'for (;;) { if (done()) break; }' },
    { name: 'do-while(1)', code: 'do { step(); } while (1);' },
    { name: 'typeof comparison', code: "if (typeof gs !== 'undefined') { gs.info('x'); }" },
    { name: 'shadowed undefined is not constant', code: 'function f(undefined) { if (undefined) { return 1; } }' }
  ],
  invalid: [
    {
      name: 'if (false) disabling code',
      code: "if (false) {\n  current.update();\n}",
      findings: [{ line: 1, column: 5, severity: 'WARNING', message: /always false/, explanation: /switch code off/ }]
    },
    {
      name: 'if (true)',
      code: 'if (true) { run(); }',
      findings: [{ message: /always true/ }]
    },
    {
      name: 'typeof without comparison',
      code: 'if (typeof customField) { run(); }',
      findings: [{ message: /always true/, explanation: /typeof x !== "undefined"/ }]
    },
    {
      name: 'object literal in ternary',
      code: 'var x = {} ? 1 : 2;',
      findings: [{ message: /always true/ }]
    },
    {
      name: 'while (false)',
      code: 'while (false) { run(); }',
      findings: [{ message: /always false/ }]
    },
    {
      name: 'negated literal',
      code: 'if (!1) { run(); }',
      findings: [{ message: /always false/ }]
    }
  ]
});
