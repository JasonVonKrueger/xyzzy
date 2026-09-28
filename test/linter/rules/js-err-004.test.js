import { runRuleTests } from '../helpers.js';

runRuleTests('JS-ERR-004', {
  valid: [
    { name: 'contextual message', code: "try { run(); } catch (e) { gs.error('IncidentUtils.close: failed for ' + id + ': ' + e.message, 'IncidentUtils'); }" },
    { name: 'logging outside a catch', code: 'gs.info(e);' },
    { name: 'non-logging call with the error', code: 'try { run(); } catch (e) { handle(e); }' }
  ],
  invalid: [
    {
      name: 'gs.error(e)',
      code: 'try {\n  run();\n} catch (e) {\n  gs.error(e);\n}',
      findings: [{ line: 4, column: 3, severity: 'INFO', message: /contains only the error \('e'\)/ }]
    },
    {
      name: 'gs.log(ex.message, source) still lacks context',
      code: "try { run(); } catch (ex) { gs.log(ex.message, 'MyScript'); }",
      findings: [{ message: /'ex\.message'/ }]
    },
    {
      name: 'console.error(err.toString())',
      code: 'try { run(); } catch (err) { console.error(err.toString()); }',
      findings: [{ line: 1 }]
    },
    {
      name: "gs.warn('' + e)",
      code: "try { run(); } catch (e) { gs.warn('' + e); }",
      findings: [{ line: 1 }]
    }
  ]
});
