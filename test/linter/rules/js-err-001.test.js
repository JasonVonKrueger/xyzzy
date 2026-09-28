import { runRuleTests } from '../helpers.js';

runRuleTests('JS-ERR-001', {
  valid: [
    { name: 'catch that logs', code: "try { r.execute(); } catch (e) { gs.error('REST call failed: ' + e.message, 'Integration'); }" },
    { name: 'documented empty catch', code: 'try { JSON.parse(s); } catch (e) {\n  // not JSON: treat as plain text\n}' },
    { name: 'no catch', code: 'try { run(); } finally { cleanup(); }' }
  ],
  invalid: [
    {
      name: 'empty catch',
      code: "try {\n  response = request.execute();\n} catch (ex) {}",
      findings: [{ line: 3, column: 3, severity: 'WARNING', message: /Empty catch block swallows the exception/ }]
    },
    {
      name: 'optional catch binding',
      code: 'try { run(); } catch {}',
      findings: [{ line: 1 }]
    }
  ]
});
