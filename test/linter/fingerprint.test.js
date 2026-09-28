import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { applyBaseline, createBaseline, loadBaseline, writeBaseline } from '../../src/linter/baseline.js';
import { LintConfigError, lintText } from '../../src/linter/index.js';

const ONLY_GR = { categories: { correctness: 'off', naming: 'off', portability: 'off', complexity: 'off', performance: 'off' } };
const DELETE = "var gr = new GlideRecord('u_log');\ngr.deleteMultiple();\n";

function lint(code, file = 'scripts/cleanup.js') {
  return lintText(code, { file, config: ONLY_GR, cwd: process.cwd() });
}

function fingerprints(result) {
  return result.findings.map((finding) => finding.fingerprint);
}

test('fingerprints survive code moving to other lines', () => {
  const before = lint(DELETE);
  const after = lint(`// header comment\n\nfunction unrelated() {}\n${DELETE}`);

  assert.equal(before.findings[0].line, 2);
  assert.equal(after.findings[0].line, 5);
  assert.deepEqual(fingerprints(after), fingerprints(before));
});

test('fingerprints differ by rule, file, and code, and repeated identical code gets distinct ids', () => {
  const base = fingerprints(lint(DELETE))[0];
  const otherFile = fingerprints(lint(DELETE, 'scripts/other.js'))[0];
  const otherCode = fingerprints(lint("var gr = new GlideRecord('u_log');\ngr.deleteMultiple( );\n"))[0];
  const repeated = fingerprints(lint(`${DELETE}${DELETE}`));

  assert.notEqual(otherFile, base);
  assert.equal(otherCode, base, 'whitespace inside the line is normalized');
  assert.equal(repeated.length, 2);
  assert.equal(repeated[0], base);
  assert.notEqual(repeated[1], repeated[0]);
});

test('formatting fixes do not change fingerprints', () => {
  const messy = 'var gr = new GlideRecord("u_log")\n    gr.deleteMultiple()\n';
  const fixed = lintText(messy, { file: 'scripts/cleanup.js', fix: true, config: ONLY_GR });
  const deleteFingerprint = (result) => result.findings.filter((finding) => finding.ruleId === 'SN-GR-002').map((finding) => finding.fingerprint);

  assert.equal(fixed.output, "var gr = new GlideRecord('u_log');\n    gr.deleteMultiple();\n");
  assert.deepEqual(deleteFingerprint(fixed), deleteFingerprint(lint(messy)));
  assert.deepEqual(deleteFingerprint(fixed), deleteFingerprint(lint(DELETE)));
});

test('fingerprints use paths relative to cwd', () => {
  const absolute = lintText(DELETE, { file: path.join(process.cwd(), 'scripts/cleanup.js'), config: ONLY_GR });

  assert.deepEqual(fingerprints(absolute), fingerprints(lint(DELETE)));
});

test('a baseline hides existing findings and lets new ones through', () => {
  const baseline = createBaseline([lint(DELETE)]);
  const entry = Object.values(baseline.findings)[0];

  assert.deepEqual(entry, { ruleId: 'SN-GR-002', file: 'scripts/cleanup.js', code: 'gr.deleteMultiple();', count: 1 });

  const withNewFinding = lint(`${DELETE}var gr2 = new GlideRecord('task');\ngr2.updateMultiple();\n`);
  const { results, stale } = applyBaseline([withNewFinding], baseline);

  assert.deepEqual(results[0].findings.map((finding) => finding.ruleId), ['SN-GR-001']);
  assert.equal(results[0].baselinedCount, 1);
  assert.equal(stale, 0);
});

test('baseline counts are consumed, and fixed findings are reported as stale', () => {
  const baseline = createBaseline([lint(`${DELETE}${DELETE}`)]);
  assert.equal(Object.keys(baseline.findings).length, 2);

  const fixedOne = applyBaseline([lint(DELETE)], baseline);
  assert.equal(fixedOne.results[0].findings.length, 0);
  assert.equal(fixedOne.stale, 1);

  const clean = applyBaseline([lint('var x = 1;\n')], baseline);
  assert.equal(clean.stale, 2);
});

test('baseline files round-trip and invalid ones are rejected', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'sn-lint-baseline-'));
  const file = path.join(dir, 'baseline.json');
  const baseline = createBaseline([lint(DELETE)]);

  writeBaseline(file, baseline);
  assert.deepEqual(loadBaseline(file), baseline);
  assert.match(readFileSync(file, 'utf8'), /^\{\n {2}"version": 1,/);

  writeFileSync(file, '{"findings": []}');
  assert.throws(() => loadBaseline(file), LintConfigError);
  assert.throws(() => loadBaseline(path.join(dir, 'missing.json')), /Cannot read baseline/);
});

test('secrets never reach fingerprints or baselines', () => {
  const result = lintText("var token = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789AB';\n", { file: 'x.js' });
  const baseline = JSON.stringify(createBaseline([result]));

  assert.doesNotMatch(baseline, /abcdefghijklmnopqrstuvwxyz/);
  assert.match(baseline, /<redacted>/);
});
