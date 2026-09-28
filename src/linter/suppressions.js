// Inline suppression comments. Rule ids are optional (none = every rule); a reason may follow "--":
//
//   gr.deleteMultiple(); // snlint-disable-line SN-GR-004 -- table is truncated nightly by design
//   // snlint-disable-next-line SN-CLIENT-001, SEC-001
//   /* snlint-disable-file JS-FORMAT-001 */
const DIRECTIVE = /^\s*\*?\s*snlint-(disable-next-line|disable-line|disable-file)\b([\s\S]*)$/;
const ALL_RULES = '*';

function parseRuleList(text) {
  const [rulePart] = text.split('--');
  const ids = rulePart.split(/[\s,]+/).filter(Boolean);
  return ids.length > 0 ? ids : [ALL_RULES];
}

export function parseSuppressions(comments) {
  const byLine = new Map();
  const fileWide = new Set();

  function addLine(line, ids) {
    if (!byLine.has(line)) {
      byLine.set(line, new Set());
    }
    for (const id of ids) {
      byLine.get(line).add(id);
    }
  }

  for (const comment of comments) {
    const match = DIRECTIVE.exec(comment.value);
    if (!match) {
      continue;
    }

    const [, kind, rest] = match;
    const ids = parseRuleList(rest);

    if (kind === 'disable-file') {
      ids.forEach((id) => fileWide.add(id));
    } else if (kind === 'disable-line') {
      addLine(comment.loc.start.line, ids);
    } else {
      addLine(comment.loc.end.line + 1, ids);
    }
  }

  return {
    isSuppressed(ruleId, line) {
      if (fileWide.has(ALL_RULES) || fileWide.has(ruleId)) {
        return true;
      }
      const lineIds = byLine.get(line);
      return Boolean(lineIds && (lineIds.has(ALL_RULES) || lineIds.has(ruleId)));
    }
  };
}
