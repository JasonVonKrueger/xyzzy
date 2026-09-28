import { runRuleTests } from '../helpers.js';

const include = (methods) => `var Api = Class.create();\nApi.prototype = Object.extendsObject(AbstractAjaxProcessor, {\n${methods}\n  type: 'Api'\n});`;

runRuleTests('SEC-003', {
  valid: [
    { name: 'role check', context: 'script_include', code: include("  get: function () {\n    if (!gs.hasRole('itil')) { return ''; }\n    var gr = new GlideRecord('incident');\n    gr.get(this.getParameter('sysparm_id'));\n    return gr.getValue('number');\n  },") },
    { name: 'GlideRecordSecure', context: 'script_include', code: include("  get: function () {\n    var gr = new GlideRecordSecure('incident');\n    gr.get(this.getParameter('sysparm_id'));\n    return gr.getValue('number');\n  },") },
    { name: 'canRead check', context: 'script_include', code: include("  get: function () {\n    var gr = new GlideRecord('incident');\n    if (gr.get(id) && gr.canRead()) { return gr.getValue('number'); }\n    return '';\n  },") },
    { name: 'check in a helper', context: 'script_include', code: include("  get: function () {\n    if (!this._ok()) return '';\n    var gr = new GlideRecord('incident');\n    return gr.getRowCount();\n  },\n  _ok: function () { return gs.getUser().hasRole('admin'); },") },
    { name: 'private method', context: 'script_include', code: include("  _load: function () { var gr = new GlideRecord('incident'); gr.query(); },") },
    { name: 'no data access', context: 'script_include', code: include("  now: function () { return new GlideDateTime().getDisplayValue(); },") },
    { name: 'not client-callable', context: 'script_include', code: "var Util = Class.create();\nUtil.prototype = { get: function () { var gr = new GlideRecord('incident'); gr.query(); }, type: 'Util' };" }
  ],
  invalid: [
    {
      name: 'unchecked GlideRecord',
      context: 'script_include',
      code: include("  getRecord: function () {\n    var gr = new GlideRecord('sys_user');\n    gr.get(this.getParameter('sysparm_id'));\n    return gr.getValue('email');\n  },"),
      findings: [{ line: 3, severity: 'WARNING', confidence: 0.7, message: /^Client-callable method getRecord\(\) uses new GlideRecord\(\) without checking the caller's roles or ACLs\.$/ }]
    },
    {
      name: 'public include raises confidence',
      context: 'script_include',
      code: include("  getRecord: function () { var gr = new GlideAggregate('incident'); gr.query(); },\n  isPublic: function () { return true; },"),
      findings: [{ confidence: 0.85, message: /isPublic\(\) lets unauthenticated users call it/ }]
    },
    {
      name: 'helper without a check does not help',
      context: 'script_include',
      code: include("  get: function () {\n    this._log();\n    var gr = new GlideRecord('incident');\n    gr.query();\n  },\n  _log: function () { gs.info('x'); },"),
      findings: [{ line: 3 }]
    }
  ]
});
