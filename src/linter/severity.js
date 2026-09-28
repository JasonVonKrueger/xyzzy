// Severities from most to least serious. Findings carry the upper-case form ('ERROR'); configuration and
// rule definitions use the lower-case form ('error').
export const SEVERITIES = ['error', 'warning', 'info'];

const SEVERITY_RANK = { error: 3, warning: 2, info: 1 };

const ALIASES = { warn: 'warning', information: 'info', note: 'info' };

// Returns 'error' | 'warning' | 'info' | 'off', or null when the value is not a recognised severity.
export function parseSeverity(value) {
  if (value === false || value === 0) {
    return 'off';
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  const resolved = ALIASES[normalized] ?? normalized;
  return resolved === 'off' || SEVERITY_RANK[resolved] ? resolved : null;
}

export function severityRank(severity) {
  return SEVERITY_RANK[severity.toLowerCase()] ?? 0;
}

export function lowerSeverity(a, b) {
  return severityRank(a) <= severityRank(b) ? a : b;
}
