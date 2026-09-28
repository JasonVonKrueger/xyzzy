import path from 'node:path';

import { summarize } from '../engine.js';

const RULE_LINE = '-'.repeat(72);

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

// Relative to the working directory when the file is inside it, otherwise unchanged.
export function displayPath(file, cwd) {
  if (!path.isAbsolute(file)) {
    return file;
  }
  const relative = path.relative(cwd, file);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : file;
}

function describeContext(execution) {
  if (execution.source === 'explicit') {
    return execution.label;
  }
  const how = execution.source === 'path' ? 'from folder' : 'inferred';
  const confidence = Math.round(execution.confidence * 100);
  const signals = execution.signals.length > 0 ? `: ${execution.signals.join(', ')}` : '';
  return `${execution.label} (${how}, ${confidence}%${signals})`;
}

function formatFinding(finding, file) {
  const lines = [
    `${finding.severity} ${finding.ruleId}`,
    `${file}:${finding.line}:${finding.column}`,
    `    ${finding.line} | ${finding.code}`,
    '',
    finding.message,
    '',
    finding.explanation
  ];

  if (finding.recommendation) {
    lines.push('', 'Recommendation:', finding.recommendation);
  }

  lines.push('');
  if (finding.confidence < 1) {
    lines.push(`Confidence: ${Math.round(finding.confidence * 100)}%`);
  }
  lines.push(`Fixable: ${finding.fixable ? 'Yes (run with --fix)' : 'No'}`);

  return lines.join('\n');
}

// Human-readable console output: what is wrong, why it matters, where it is, and how to fix it.
export function formatStylish(results, { cwd = process.cwd() } = {}) {
  const blocks = [];

  for (const result of results) {
    const file = displayPath(result.file, cwd);
    const notes = [];

    if (result.fixesApplied > 0) {
      notes.push(`Applied ${plural(result.fixesApplied, 'automatic fix')}.`);
    }
    if (result.fixRejected) {
      notes.push(`Automatic fixes were not applied: ${result.fixRejected}.`);
    }
    for (const error of result.errors) {
      notes.push(`Internal error in rule ${error.ruleId} (rule skipped): ${error.message}`);
    }

    if (result.findings.length === 0 && notes.length === 0) {
      continue;
    }

    blocks.push(`${RULE_LINE}\n${file} — ${describeContext(result.executionContext)}`);
    blocks.push(...notes);
    for (const finding of result.findings) {
      blocks.push(`${RULE_LINE}\n${formatFinding(finding, file)}`);
    }
  }

  const summary = summarize(results);
  const total = summary.error + summary.warning + summary.info;
  const parts = [
    plural(summary.error, 'error'),
    plural(summary.warning, 'warning'),
    `${summary.info} info`
  ];
  let footer =
    total === 0
      ? `No problems found in ${plural(summary.files, 'file')}.`
      : `${parts.join(', ')} in ${plural(summary.files, 'file')}.`;
  if (summary.fixable > 0) {
    footer += ` ${summary.fixable} can be fixed automatically with --fix.`;
  }
  if (summary.suppressed > 0) {
    footer += ` ${summary.suppressed} suppressed by snlint-disable comments.`;
  }
  if (summary.baselined > 0) {
    footer += ` ${summary.baselined} existing ${summary.baselined === 1 ? 'finding' : 'findings'} hidden by the baseline.`;
  }

  blocks.push(total > 0 ? `${RULE_LINE}\n${footer}` : footer);
  return `${blocks.join('\n\n')}\n`;
}
