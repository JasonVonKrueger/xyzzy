import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultRegistry, getFormatter, lintText } from '../../src/linter/index.js';

const registry = createDefaultRegistry();
// Only the rules these fixtures are about.
const config = { categories: { correctness: 'off', naming: 'off', 'error-handling': 'off' } };
const results = [
  lintText("function onLoad() {\n    var id = gs.getUserID();  \n}\n", { file: 'client/sys_script_client/load.js', registry, config }),
  lintText('var clean = 1;\n', { file: 'clean.js', registry, config })
];

test('stylish output answers what, why, where, and how to fix', () => {
  const output = getFormatter('stylish')(results, { cwd: process.cwd() });

  assert.match(output, /client\/sys_script_client\/load\.js — Client Script \(from folder, 90%/);
  assert.match(output, /ERROR SN-CLIENT-001\nclient\/sys_script_client\/load\.js:2:14\n {4}2 \| var id = gs\.getUserID\(\);/);
  assert.match(output, /Recommendation:\nUse g_user/);
  assert.match(output, /Confidence: 90%\nFixable: No/);
  assert.match(output, /INFO JS-FORMAT-001[\s\S]*Fixable: Yes/);
  assert.match(output, /1 error, 0 warnings, 1 info in 2 files\. 1 can be fixed automatically with --fix\./);
});

test('stylish output for a clean run is a single line', () => {
  const output = getFormatter('stylish')([results[1]]);

  assert.equal(output, 'No problems found in 1 file.\n');
});

test('JSON output includes summary, context, metrics, and findings', () => {
  const report = JSON.parse(getFormatter('json')(results));

  assert.deepEqual(report.summary, { files: 2, error: 1, warning: 0, info: 1, fixable: 1, suppressed: 0, baselined: 0 });
  assert.equal(report.results[0].executionContext.type, 'client_script');
  assert.equal(report.results[0].findings[0].ruleId, 'SN-CLIENT-001');
  assert.equal(typeof report.results[0].metrics.totals.maxComplexity, 'number');
});

test('SARIF output is valid 2.1.0 with rule metadata and mapped levels', () => {
  const sarif = JSON.parse(getFormatter('sarif')(results, { registry, cwd: process.cwd() }));
  const [run] = sarif.runs;

  assert.equal(sarif.version, '2.1.0');
  assert.equal(run.tool.driver.name, 'sn-lint');
  assert.deepEqual(
    run.tool.driver.rules.map((rule) => rule.id),
    registry.all().map((rule) => rule.id)
  );

  const security = run.tool.driver.rules.find((rule) => rule.id === 'SEC-001');
  assert.equal(security.properties['security-severity'], '8.0');
  assert.ok(security.properties.tags.includes('MANUAL_REVIEW'));

  const levels = run.results.map((result) => [result.ruleId, result.level]);
  assert.deepEqual(levels, [['SN-CLIENT-001', 'error'], ['JS-FORMAT-001', 'note']]);

  const [first] = run.results;
  assert.equal(run.tool.driver.rules[first.ruleIndex].id, first.ruleId);
  assert.deepEqual(first.locations[0].physicalLocation.region, {
    startLine: 2,
    startColumn: 14,
    endLine: 2,
    endColumn: 16,
    snippet: { text: 'var id = gs.getUserID();' }
  });
  assert.equal(first.locations[0].physicalLocation.artifactLocation.uri, 'client/sys_script_client/load.js');
});
