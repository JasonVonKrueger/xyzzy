import { runRuleTests } from '../helpers.js';

const include = (methods) => `var Api = Class.create();\nApi.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {\n${methods}\n  type: 'Api'\n});`;

runRuleTests('SEC-004', {
  valid: [
    { name: 'no isPublic', context: 'script_include', code: include("  ping: function () { return 'ok'; },") },
    { name: 'isPublic returns false', context: 'script_include', code: include('  isPublic: function () { return false; },') },
    { name: 'conditional isPublic', context: 'script_include', code: include("  isPublic: function () { return gs.getProperty('x.public') == 'true'; },") }
  ],
  invalid: [
    {
      name: 'isPublic returns true',
      context: 'script_include',
      code: include('  isPublic: function () {\n    return true;\n  },'),
      findings: [{ line: 3, severity: 'WARNING', message: /can be called without logging in/ }]
    }
  ]
});
