import assert from 'node:assert/strict';
import test from 'node:test';

import { lintWithRule, runRuleTests } from '../helpers.js';

runRuleTests('SEC-002', {
  valid: [
    { name: 'credential from a property', code: "var r = new sn_ws.RESTMessageV2();\nr.setBasicAuth(user, gs.getProperty('x_app.api.password'));" },
    { name: 'authentication profile', code: "r.setAuthenticationProfile('basic', 'c9b1f0e1db012010a5b0f5f3ca9619b4');" },
    { name: 'field and property names are not secrets', code: "var password = 'u_password';\nvar token = 'x_app.integration.token';\nvar passwordField = 'Hunter2Pass!';" },
    { name: 'placeholders', code: "var apiKey = '<your api key>';\nvar secret = '';\nvar password = 'changeme';\nvar token = '${TOKEN}';" },
    { name: 'sys_id', code: "var token = 'c9b1f0e1db012010a5b0f5f3ca9619b4';" },
    { name: 'dynamic header', code: "r.setRequestHeader('Authorization', 'Bearer ' + token);" },
    { name: 'secret word in a message', code: "gs.info('Password reset for ' + user);" }
  ],
  invalid: [
    {
      name: 'known token format anywhere',
      code: "var cfg = { region: 'us-east-1', key: 'AKIAIOSFODNN7EXAMPLE' };",
      findings: [{ line: 1, severity: 'ERROR', confidence: 0.95, message: /^Hardcoded AWS access key: AKIA… \(20 characters\)\.$/ }]
    },
    {
      name: 'setBasicAuth literal',
      code: "var r = new sn_ws.RESTMessageV2();\nr.setBasicAuth('svc', 'S3cr3t!Pass');",
      findings: [{ line: 2, message: /setBasicAuth\(\) password: S3cr…/ }]
    },
    {
      name: 'Authorization header literal',
      code: "r.setRequestHeader('Authorization', 'Bearer abcdefghijklmnop1234567890');",
      findings: [{ message: /Bearer token/ }]
    },
    {
      name: 'secret-named variable and property',
      code: "var clientSecret = 'q8Zr!2kLp';\nconfig.password = 'hunter2';",
      findings: [{ line: 1, confidence: 0.85, message: /value in 'clientSecret'/ }, { line: 2, message: /value in 'password'/ }]
    },
    {
      name: 'credentials in a URL',
      code: "var endpoint = 'https://svc:pa55word@api.example.com/v1';",
      findings: [{ message: /URL with embedded credentials/ }]
    },
    {
      name: 'private key in a template literal',
      code: 'var pem = `-----BEGIN RSA PRIVATE KEY-----\nMIIE`;',
      findings: [{ message: /private key/ }]
    },
    {
      name: 'client-side secret explains browser exposure',
      context: 'client_script',
      code: "function onLoad() { var apiKey = 'k3y-9f8e7d6c5b'; }",
      findings: [{ explanation: /every user who opens the page can read it/ }]
    }
  ]
});

test('SEC-002 never prints the full secret', () => {
  const findings = lintWithRule('SEC-002', "var token = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789AB';");
  assert.equal(findings.length, 1);
  assert.doesNotMatch(JSON.stringify(findings), /abcdefghijklmnopqrstuvwxyz0123456789AB/);
  assert.equal(findings[0].code, "var token = '<redacted>';");
});
