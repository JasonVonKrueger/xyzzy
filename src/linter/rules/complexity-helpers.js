// Shared helpers for the complexity rules (CPLX-*), which read context.metrics (metrics.js) and compare
// it with the configured thresholds.

export const TOP_LEVEL = '(top level)';

export function describeUnit(unit) {
  if (unit.name === TOP_LEVEL) {
    return 'Top-level code';
  }
  return unit.name === '(anonymous)' ? `Anonymous function (line ${unit.line})` : `Function ${unit.name}()`;
}

// Location of a unit's start: the function keyword, or line 1 for the top level.
export function unitLoc(unit) {
  const start = { line: unit.line, column: (unit.column ?? 1) - 1 };
  return { start, end: start };
}

// The functions and (optionally) the top level whose `metric` exceeds `limit`.
export function unitsOver(metrics, metric, limit, { includeTopLevel = true } = {}) {
  return metrics.functions.filter((unit) => (includeTopLevel || unit.name !== TOP_LEVEL) && unit[metric] > limit);
}
