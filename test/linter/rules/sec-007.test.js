import { runRuleTests } from '../helpers.js';

runRuleTests('SEC-007', {
  valid: [
    { name: 'ordinary session use', code: "var session = gs.getSession();\nsession.putClientData('x', 1);" },
    { name: 'client code is out of scope', context: 'client_script', code: 'function onLoad() { var e = new GlideEncrypter(); }' }
  ],
  invalid: [
    {
      name: 'GlideImpersonate',
      code: "var imp = new GlideImpersonate();\nvar previous = imp.impersonate(userId);\nimp.impersonate(previous);",
      findings: [{ line: 1, severity: 'WARNING', message: /^User impersonation in a script \(new GlideImpersonate\(\)\)\.$/ }]
    },
    {
      name: 'session impersonate',
      code: 'gs.getSession().impersonate(adminId);',
      findings: [{ message: /gs\.getSession\(\)\.impersonate\(\)/ }]
    },
    {
      name: 'GlideEncrypter',
      code: "var enc = new GlideEncrypter();\nvar secret = enc.encrypt(value);",
      findings: [{ message: /GlideEncrypter is deprecated/ }]
    }
  ]
});
