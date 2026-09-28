import assert from 'node:assert/strict';
import test from 'node:test';

import { lintWithRule, runRuleTests } from '../helpers.js';

const CLIENT_SCRIPT_WITH_GS = `function onChange(control, oldValue, newValue, isLoading) {
    if (isLoading) return;
    g_form.setValue('assigned_to', gs.getUserID());
}`;

runRuleTests('SN-CLIENT-001', {
  valid: [
    {
      name: 'client script using client APIs only',
      code: `function onLoad() {
    var ga = new GlideAjax('UserUtils');
    ga.addParam('sysparm_name', 'getManager');
    ga.getXMLAnswer(function (answer) { g_form.setValue('u_manager', answer); });
}`
    },
    {
      name: 'typeof guard in shared code',
      code: "function onLoad() { if (typeof gs !== 'undefined') { return; } g_form.hideRelatedLists(); }"
    },
    {
      name: 'locally declared variable named current',
      code: "function onLoad() { var current = g_form.getValue('state'); alert(current); }"
    },
    {
      name: 'property named gs is not the gs global',
      code: "function onLoad() { var cfg = { gs: 1 }; alert(cfg.gs); }"
    },
    {
      name: 'legacy client-side GlideRecord is left to the GlideRecord client rule',
      code: "function onLoad() { var gr = new GlideRecord('sys_user'); gr.get(g_user.userID); }"
    },
    {
      name: 'server code is out of scope for this rule',
      code: "(function executeRule(current, previous) { gs.info(current.number); })(current, previous);"
    },
    {
      name: 'same code in an explicit Business Rule context',
      code: CLIENT_SCRIPT_WITH_GS,
      context: 'business_rule'
    }
  ],
  invalid: [
    {
      name: 'gs in an onChange client script',
      code: CLIENT_SCRIPT_WITH_GS,
      findings: [{ line: 3, column: 36, severity: 'ERROR', confidence: 0.9, message: /GlideSystem \(gs\)/ }]
    },
    {
      name: 'explicit client_script context gives full confidence',
      code: 'var id = gs.getUserID();',
      context: 'client_script',
      findings: [{ severity: 'ERROR', confidence: 1 }]
    },
    {
      name: 'one finding per API with a use count',
      code: `function onSubmit() {
    var a = current.number;
    var b = current.state;
    var c = new GlideAggregate('incident');
}`,
      findings: [
        { line: 2, message: /current .*\(2 uses\)/ },
        { line: 4, message: /GlideAggregate/ }
      ]
    },
    {
      name: 'catalog client script detected from its folder',
      code: "g_form.setValue('u_due', new GlideDateTime().getValue());",
      file: 'export/catalog_script_client/set_due.js',
      findings: [{ severity: 'ERROR', message: /GlideDateTime/ }]
    },
    {
      name: 'mixed signals without a signature stay at WARNING',
      code: "g_form.setValue('a', 1); g_form.setValue('b', 2); g_user.hasRole('x'); var s = gs.now();",
      findings: [{ severity: 'WARNING', confidence: 0.5 }]
    }
  ]
});

test('SN-CLIENT-001 does not run for a UI Action (client and server halves)', () => {
  const code = `function runClientCode() {
    gsftSubmit(null, g_form.getFormElement(), 'resolve_incident');
}
if (typeof window == 'undefined') {
    current.state = 6;
    current.update();
}`;

  assert.deepEqual(lintWithRule('SN-CLIENT-001', code), []);
});
