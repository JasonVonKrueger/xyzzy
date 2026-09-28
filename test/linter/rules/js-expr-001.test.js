import { runRuleTests } from '../helpers.js';

runRuleTests('JS-EXPR-001', {
  valid: [
    { name: 'calls, assignments, updates', code: "gr.query();\nx = 1;\ni++;\nnew GlideRecord('incident');\ndelete obj.key;" },
    { name: 'short-circuit call', code: 'ready && init();' },
    { name: 'ternary with calls', code: 'ok ? save() : warn();' },
    { name: 'use strict directive', code: "'use strict';\nrun();" },
    { name: 'optional call', code: 'callback?.();' },
    { name: 'void call', code: 'void run();' }
  ],
  invalid: [
    {
      name: 'comparison instead of assignment',
      code: 'gr.active == false;',
      findings: [{ line: 1, column: 1, severity: 'WARNING', message: /Comparison result is discarded\. Did you mean 'gr\.active = false'\?/ }]
    },
    {
      name: 'method referenced without parentheses',
      code: "var gr = new GlideRecord('incident');\ngr.query;",
      findings: [{ line: 2, message: /'gr\.query' is read but not called\. Did you mean 'gr\.query\(\)'\?/, explanation: /no records are read or written/ }]
    },
    {
      name: 'bare identifier',
      code: 'var total = 1;\ntotal;',
      findings: [{ line: 2, message: /Expression has no effect/ }]
    },
    {
      name: 'string that is not a directive',
      code: "run();\n'done';",
      findings: [{ line: 2 }]
    }
  ]
});
