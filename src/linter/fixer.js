import { astFingerprint } from './ast.js';
import { parseSource } from './parser.js';

// Applies non-overlapping text edits ({ range: [start, end], text }). When edits overlap, the earlier one
// wins; the rest are left for the next --fix run.
export function applyEdits(text, edits) {
  const sorted = [...edits].sort((a, b) => a.range[0] - b.range[0] || a.range[1] - b.range[1]);
  const applied = [];
  let output = '';
  let cursor = 0;

  for (const edit of sorted) {
    const [start, end] = edit.range;
    if (start < cursor) {
      continue;
    }
    output += text.slice(cursor, start) + edit.text;
    cursor = end;
    applied.push(edit);
  }

  return { output: output + text.slice(cursor), applied };
}

// Automatic fixes are only allowed to change layout. The fixed source must parse, and its AST — ignoring
// positions and raw literal text — must match the original exactly; otherwise every fix is discarded.
export function applyFixesSafely(text, originalAst, edits, parseOptions) {
  if (edits.length === 0) {
    return { output: text, appliedCount: 0, rejected: null };
  }

  const { output, applied } = applyEdits(text, edits);
  const reparsed = parseSource(output, parseOptions);

  if (!reparsed.ast) {
    return { output: text, appliedCount: 0, rejected: `fixed code no longer parses (${reparsed.syntaxError.message})` };
  }
  if (astFingerprint(reparsed.ast) !== astFingerprint(originalAst)) {
    return { output: text, appliedCount: 0, rejected: 'fixes would have changed the behavior of the code' };
  }

  return { output, appliedCount: applied.length, rejected: null };
}
