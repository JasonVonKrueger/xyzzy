import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../../bin/sn-lint.js', import.meta.url));
const RULE = "(function executeRule(current, previous) {\n  var gr = new GlideRecord('u_log');\n  gr.deleteMultiple();\n})(current, previous);\n";

function run(cwd, ...args) {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

function project() {
  const dir = mkdtempSync(path.join(tmpdir(), 'sn-lint-cli-'));
  mkdirSync(path.join(dir, 'sys_script'));
  writeFileSync(path.join(dir, 'sys_script', 'cleanup.js'), RULE);
  return dir;
}

test('CLI exit codes: 1 on errors, 2 on usage problems', () => {
  const dir = project();

  assert.equal(run(dir, 'sys_script').code, 1);
  assert.equal(run(dir).code, 2);
  assert.equal(run(dir, '--when', 'later', 'sys_script').code, 2);
  assert.match(run(dir, '--baseline', 'missing.json', 'sys_script').stderr, /Cannot read baseline/);
});

test('CLI baseline flow: record, pass, then fail only on new findings', () => {
  const dir = project();

  const written = run(dir, '--write-baseline', 'sn-lint-baseline.json', 'sys_script');
  assert.equal(written.code, 0);
  assert.match(written.stderr, /wrote baseline with 1 findings/);
  assert.match(readFileSync(path.join(dir, 'sn-lint-baseline.json'), 'utf8'), /"ruleId": "SN-GR-002"/);

  const clean = run(dir, '--baseline', 'sn-lint-baseline.json', 'sys_script');
  assert.equal(clean.code, 0);
  assert.match(clean.stdout, /No problems found in 1 file\. 1 existing finding hidden by the baseline\./);

  // Moving the existing finding down and adding a new one: only the new one counts.
  writeFileSync(
    path.join(dir, 'sys_script', 'cleanup.js'),
    RULE.replace("  var gr", "  var extra = new GlideRecord('task');\n  extra.updateMultiple();\n  var gr")
  );
  const changed = run(dir, '--baseline', 'sn-lint-baseline.json', '-f', 'json', 'sys_script');
  const report = JSON.parse(changed.stdout);
  assert.equal(changed.code, 1);
  assert.deepEqual(report.results[0].findings.map((finding) => finding.ruleId), ['SN-GR-001']);
  assert.equal(report.summary.baselined, 1);

  // Fixing the baselined finding makes its entry stale.
  writeFileSync(path.join(dir, 'sys_script', 'cleanup.js'), '(function executeRule(current, previous) {})(current, previous);\n');
  assert.match(run(dir, '--baseline', 'sn-lint-baseline.json', 'sys_script').stderr, /1 baseline entry no longer occurs/);
});

test('CLI SARIF output carries partial fingerprints', () => {
  const dir = project();
  const sarif = JSON.parse(run(dir, '-f', 'sarif', 'sys_script').stdout);
  const [result] = sarif.runs[0].results;

  assert.match(result.partialFingerprints['snLint/v1'], /^[0-9a-f]{32}$/);
  assert.equal(result.locations[0].physicalLocation.artifactLocation.uri, 'sys_script/cleanup.js');
});
