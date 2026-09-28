import { createHash } from 'node:crypto';
import path from 'node:path';

// Stable identity for a finding across commits, used by SARIF partialFingerprints and baselines.
// Built from the rule, the file path (relative to the working directory, with forward slashes), and
// the code on the finding's line, plus an index when the same rule reports
// the same code more than once in a file. Line numbers are deliberately left out, so findings keep
// their identity when code above them moves. The code is normalized (whitespace and semicolons removed,
// quotes unified) so that --fix formatting changes do not invalidate a baseline. The code snippet is
// already redacted for secrets.

export const FINGERPRINT_KEY = 'snLint/v1';

export function portablePath(file, cwd = process.cwd()) {
  const relative = path.isAbsolute(file) ? path.relative(cwd, file) : file;
  const usable = relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : file;
  return usable.split(path.sep).join('/');
}

function hash(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}

// Returns the findings (in their existing order) with `fingerprint` added.
export function withFingerprints(findings, file, cwd) {
  const uri = portablePath(file, cwd);
  const occurrences = new Map();

  return findings.map((finding) => {
    const code = finding.code.replace(/[\s;]+/g, '').replace(/"/g, "'");
    const key = `${finding.ruleId}\0${uri}\0${code}`;
    const index = occurrences.get(key) ?? 0;
    occurrences.set(key, index + 1);
    return { ...finding, fingerprint: hash(`${key}\0${index}`) };
  });
}
