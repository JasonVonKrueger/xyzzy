import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeGlideRecords,
  callsNamed,
  encodedQueryHasCondition,
  enclosingLoop,
  filterStrength
} from '../../src/linter/glide-record.js';
import { parseSource } from '../../src/linter/parser.js';
import { analyzeScopes } from '../../src/linter/scope.js';

function analyze(code) {
  const { ast } = parseSource(code);
  const scopes = analyzeScopes(ast);
  return { scopes, ...analyzeGlideRecords(ast, scopes) };
}

function strengthOf(code, method = 'deleteMultiple') {
  const { instances, scopes } = analyze(code);
  const instance = instances.find((candidate) => callsNamed(candidate, new Set([method])).length > 0);
  return filterStrength(instance, callsNamed(instance, new Set([method]))[0].node, scopes);
}

test('instances record table, class, ordered calls, field writes and escapes', () => {
  const { instances } = analyze(
    "var ga = new GlideAggregate('incident');\nga.addQuery('active', true);\nga.query();\nga.u_x = 1;\nsend(ga);\nvar other = new GlideRecord(t);"
  );

  assert.equal(instances.length, 2);
  assert.equal(instances[0].className, 'GlideAggregate');
  assert.equal(instances[0].isAggregate, true);
  assert.equal(instances[0].table, 'incident');
  assert.deepEqual(instances[0].calls.map((call) => call.method), ['addQuery', 'query']);
  assert.deepEqual(instances[0].fieldWrites.map((write) => write.field), ['u_x']);
  assert.equal(instances[0].escapes.length, 1);
  assert.equal(instances[1].table, null);
});

test('references follow the most recent construction assigned to the variable', () => {
  const { instances } = analyze(
    "var gr = new GlideRecord('a');\ngr.query();\ngr = new GlideRecord('b');\ngr.deleteMultiple();\ngr = lookup();\ngr.update();"
  );

  assert.deepEqual(instances.map((instance) => instance.calls.map((call) => call.method)), [['query'], ['deleteMultiple']]);
});

test('shadowed variables are separate', () => {
  const { instances } = analyze(
    "var gr = new GlideRecord('a');\nfunction f() { var gr = new GlideRecord('b'); gr.query(); }\ngr.update();"
  );

  assert.deepEqual(instances.map((instance) => [instance.table, instance.calls.map((call) => call.method)]), [
    ['a', ['update']],
    ['b', ['query']]
  ]);
});

test('filter strength', () => {
  const gr = "var gr = new GlideRecord('t');\n";
  assert.equal(strengthOf(`${gr}gr.deleteMultiple();`), 'none');
  assert.equal(strengthOf(`${gr}gr.addQuery('a', 1);\ngr.deleteMultiple();`), 'static');
  assert.equal(strengthOf(`${gr}gr.addEncodedQuery(q);\ngr.deleteMultiple();`), 'weak');
  assert.equal(strengthOf(`${gr}if (x) gr.addQuery('a', 1);\ngr.deleteMultiple();`), 'weak');
  assert.equal(strengthOf(`${gr}x && gr.addQuery('a', 1);\ngr.deleteMultiple();`), 'weak');
  assert.equal(strengthOf(`${gr}try { gr.addQuery('a', 1); } catch (e) {}\ngr.deleteMultiple();`), 'static');
  assert.equal(strengthOf(`${gr}prepare(gr);\ngr.deleteMultiple();`), 'unknown');
});

test('encoded queries need a real condition', () => {
  assert.equal(encodedQueryHasCondition('active=true'), true);
  assert.equal(encodedQueryHasCondition('caller_id='), true);
  assert.equal(encodedQueryHasCondition('ORDERBYnumber^ORDERBYDESCsys_created_on'), false);
  assert.equal(encodedQueryHasCondition(''), false);
  assert.equal(encodedQueryHasCondition('^'), false);
});

test('enclosingLoop sees loop bodies and iteration callbacks but not plain functions', () => {
  const { instances } = analyze(
    "while (a) { var x = new GlideRecord('t'); x.query(); }\n" +
      "items.forEach(function () { var y = new GlideRecord('t'); y.query(); });\n" +
      "function z() { var w = new GlideRecord('t'); w.query(); }\n" +
      "for (var i = new GlideRecord('t').query(); i < 1; i++) {}"
  );
  const loops = instances.slice(0, 3).map((instance) => enclosingLoop(instance.calls[0].node)?.type ?? null);

  assert.deepEqual(loops, ['WhileStatement', 'CallExpression', null]);
  assert.equal(enclosingLoop(instances[3].node), null);
});
