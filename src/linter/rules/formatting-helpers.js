import { walk } from '../ast.js';

// Shared helpers for the formatting rules (JS-FORMAT-*). Formatting fixes must never change what the
// code does; fixer.js additionally rejects every fix for a file whose AST changes.

// String and template literal ranges. Whitespace, quotes, and line breaks inside them are part of a
// value (multi-line template literals, backslash line continuations) and must not be touched.
export function literalRanges(ast) {
  const ranges = [];
  walk(ast, (node) => {
    if (node.type === 'TemplateLiteral' || (node.type === 'Literal' && typeof node.value === 'string')) {
      ranges.push([node.start, node.end]);
    }
  });
  return ranges;
}

export function isInside(ranges, offset) {
  return ranges.some(([from, to]) => offset > from && offset < to);
}

// Calls visit({ number, start, end, text }) for each line; `end` excludes the line break.
export function forEachLine(text, visit) {
  const lineBreak = /\r\n|\r|\n/g;
  let start = 0;
  let number = 1;
  for (;;) {
    const match = lineBreak.exec(text);
    const end = match ? match.index : text.length;
    visit({ number, start, end, text: text.slice(start, end) });
    if (!match) {
      return;
    }
    start = match.index + match[0].length;
    number += 1;
  }
}

// One finding per file: at the first occurrence, with the count, carrying every edit.
export function reportOnce(context, occurrences, { single, many, explanation, recommendation }) {
  if (occurrences.length === 0) {
    return;
  }
  const [first] = occurrences;
  context.report({
    loc: first.loc,
    message: occurrences.length === 1 ? single : many(occurrences.length, first.loc.start.line),
    explanation,
    recommendation,
    fix: occurrences.flatMap((occurrence) => occurrence.edits)
  });
}

export function pointLoc(line, column, endColumn = column) {
  return { start: { line, column }, end: { line, column: endColumn } };
}
