import { runRuleTests } from '../helpers.js';

runRuleTests('JS-ERR-003', {
  valid: [
    { name: 'throw new Error', code: "throw new Error('Missing assignment group');" },
    { name: 'rethrow caught error', code: 'try { run(); } catch (e) { throw e; }' },
    { name: 'Scripted REST error class', code: "throw new sn_ws_err.BadRequestError('id is required');" },
    { name: 'throw a variable holding an error', code: 'var err = buildError(); throw err;' }
  ],
  invalid: [
    {
      name: 'throw a string',
      code: "throw 'Missing assignment group';",
      findings: [{ line: 1, column: 1, severity: 'WARNING', message: /Throwing a literal value/, recommendation: /throw new Error/ }]
    },
    {
      name: 'throw a concatenated string',
      code: "throw 'Record ' + id + ' not found';",
      findings: [{ line: 1 }]
    },
    {
      name: 'throw an object literal',
      code: 'throw { code: 404 };',
      findings: [{ line: 1 }]
    },
    {
      name: 'Scripted REST resource gets REST-specific advice',
      code: "(function process(request, response) {\n  throw 'bad input';\n})(request, response);",
      findings: [{ line: 2, explanation: /500 Internal Server Error/, recommendation: /sn_ws_err\.BadRequestError/ }]
    }
  ]
});
