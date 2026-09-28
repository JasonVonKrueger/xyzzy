import { readFileSync, writeFileSync } from 'node:fs';

import { LintConfigError } from './config.js';
import { portablePath } from './fingerprint.js';

// Baselines let a team adopt the linter on existing code: record today's findings once, then fail CI
// only on new ones. Findings are matched by fingerprint (see fingerprint.js), with counts, so fixing
// one of two identical findings still lets the other through.
//
// File format (sorted, no timestamps, so it diffs cleanly in pull requests):
//   { "version": 1, "tool": "sn-lint",
//     "findings": { "<fingerprint>": { "ruleId": "...", "file": "...", "code": "...", "count": 1 } } }

const VERSION = 1;

export function createBaseline(results, cwd = process.cwd()) {
  const entries = new Map();
  for (const result of results) {
    for (const finding of result.findings) {
      const entry = entries.get(finding.fingerprint);
      if (entry) {
        entry.count += 1;
      } else {
        entries.set(finding.fingerprint, {
          ruleId: finding.ruleId,
          file: portablePath(finding.file, cwd),
          code: finding.code,
          count: 1
        });
      }
    }
  }

  const sorted = [...entries].sort(([a, x], [b, y]) => x.file.localeCompare(y.file) || x.ruleId.localeCompare(y.ruleId) || a.localeCompare(b));
  return { version: VERSION, tool: 'sn-lint', findings: Object.fromEntries(sorted) };
}

export function writeBaseline(file, baseline) {
  writeFileSync(file, `${JSON.stringify(baseline, null, 2)}\n`);
}

export function loadBaseline(file) {
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new LintConfigError(`Cannot read baseline ${file}: ${error.message}`);
  }
  if (baseline?.version !== VERSION || typeof baseline.findings !== 'object' || baseline.findings === null) {
    throw new LintConfigError(`${file} is not an sn-lint baseline (expected version ${VERSION} with a "findings" object).`);
  }
  return baseline;
}

// Removes findings recorded in the baseline. Each result gains `baselinedCount`; `stale` counts baseline
// entries that no longer occur (fixed findings; refresh the baseline with --write-baseline).
export function applyBaseline(results, baseline) {
  const remaining = new Map(Object.entries(baseline.findings).map(([fingerprint, entry]) => [fingerprint, entry.count ?? 1]));

  const filtered = results.map((result) => {
    let baselinedCount = 0;
    const findings = result.findings.filter((finding) => {
      const left = remaining.get(finding.fingerprint) ?? 0;
      if (left > 0) {
        remaining.set(finding.fingerprint, left - 1);
        baselinedCount += 1;
        return false;
      }
      return true;
    });
    return { ...result, findings, baselinedCount };
  });

  const stale = [...remaining.values()].reduce((sum, left) => sum + left, 0);
  return { results: filtered, stale };
}
