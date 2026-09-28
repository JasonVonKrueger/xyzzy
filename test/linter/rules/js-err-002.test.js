import { runRuleTests } from '../helpers.js';

runRuleTests('JS-ERR-002', {
  valid: [
    { name: 'error is used', code: 'function f() { try { return run(); } catch (e) { return { error: e.message }; } }' },
    { name: 'logs without using the error', code: "function f() { try { return run(); } catch (e) { gs.warn('run failed'); return null; } }" },
    { name: 'rethrows', code: 'function f() { try { return run(); } catch (e) { cleanup(); throw new Error("run failed"); } }' },
    { name: 'empty catch is JS-ERR-001, not this rule', code: 'try { run(); } catch (e) {}' },
    { name: 'client logging', code: "try { run(); } catch (e) { g_form.addErrorMessage('Could not load data'); }" }
  ],
  invalid: [
    {
      name: 'returns a default without logging',
      code: 'function getManager(id) {\n  try {\n    return lookup(id);\n  } catch (e) {\n    return null;\n  }\n}',
      findings: [{ line: 4, column: 5, severity: 'WARNING', confidence: 0.8, message: /caught and suppressed/ }]
    },
    {
      name: 'logging only inside a nested callback does not count',
      code: 'try { run(); } catch (e) {\n  retry(function () { gs.error("x"); });\n}',
      findings: [{ line: 1 }]
    },
    {
      name: 'optional catch binding that continues silently',
      code: 'try { run(); } catch {\n  ok = false;\n}',
      findings: [{ line: 1 }]
    }
  ]
});
