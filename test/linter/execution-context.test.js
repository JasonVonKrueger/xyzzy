import assert from 'node:assert/strict';
import test from 'node:test';

import { lintText } from '../../src/linter/index.js';
import { contextFromPath } from '../../src/linter/execution-context.js';

function contextOf(code, options) {
  return lintText(code, options).executionContext;
}

test('recognises ServiceNow script signatures', () => {
  const cases = [
    ['(function executeRule(current, previous /*null when async*/) {\n})(current, previous);', 'business_rule'],
    ['(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {\n})(request, response);', 'scripted_rest'],
    ['(function transformRow(source, target, map, log, isUpdate) {\n})(source, target, map, log, action === "update");', 'transform_map'],
    ['var IncidentUtils = Class.create();\nIncidentUtils.prototype = { type: "IncidentUtils" };', 'script_include'],
    ['function onChange(control, oldValue, newValue, isLoading, isTemplate) {\n}', 'client_script'],
    ['function onCondition() {\n}', 'ui_policy'],
    ['api.controller = function ($scope) {\n};', 'portal_client'],
    ["function run() { gsftSubmit(null, g_form.getFormElement(), 'x'); }", 'ui_action']
  ];

  for (const [code, type] of cases) {
    assert.equal(contextOf(code).type, type, code);
  }
});

test('client-callable Script Includes are flagged as a trait', () => {
  const code = 'var UserAjax = Class.create();\nUserAjax.prototype = Object.extendsObject(AbstractAjaxProcessor, {});';
  const context = contextOf(code);

  assert.equal(context.type, 'script_include');
  assert.equal(context.traits.clientCallable, true);
});

test('falls back to API usage when there is no signature', () => {
  assert.deepEqual(
    (({ type, side, confidence }) => ({ type, side, confidence }))(contextOf("var gr = new GlideAggregate('incident'); gs.info('x');")),
    { type: 'server', side: 'server', confidence: 0.8 }
  );
  assert.equal(contextOf("g_form.setValue('a', 1);").side, 'client');
  assert.equal(contextOf('var total = 1 + 2;').type, 'unknown');
  // A local variable named like a global is not a signal.
  assert.equal(contextOf("var current = {}; current.x = 1;").type, 'unknown');
});

test('folder names beat inference and explicit context beats both', () => {
  const code = "gs.info('hello');";

  assert.equal(contextOf(code, { file: 'app/sys_script_client/x.js' }).type, 'client_script');
  assert.equal(contextOf(code, { file: 'app/sys_script_client/x.js' }).source, 'path');
  assert.equal(contextOf(code, { file: 'app/sys_script_client/x.js', context: 'fix_script' }).type, 'fix_script');
  assert.equal(contextOf(code, { context: 'fix_script' }).confidence, 1);
  assert.throws(() => lintText(code, { context: 'nonsense' }), /Unknown execution context/);
});

test('the folder closest to the file wins', () => {
  assert.equal(contextFromPath('sys_script_include/helpers/sys_script_client/a.js').type, 'client_script');
  assert.equal(contextFromPath('C:\\export\\sys_ws_operation\\get_user.js').type, 'scripted_rest');
  assert.equal(contextFromPath('sys_script.js'), null);
});

test('imported bindings are declarations, not globals', () => {
  const context = contextOf("import { gs } from '@servicenow/glide';\nexport const x = 1;");

  assert.equal(context.type, 'unknown');
});
