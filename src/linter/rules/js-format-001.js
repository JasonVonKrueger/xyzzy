import { forEachLine, isInside, literalRanges, pointLoc, reportOnce } from './formatting-helpers.js';

const TRAILING_WHITESPACE = /[ \t]+$/;

// Reported once per file, not once per line, so formatting never drowns out real findings.
export default {
  id: 'JS-FORMAT-001',
  name: 'Trailing whitespace',
  category: 'formatting',
  severity: 'info',
  description: 'Lines end with spaces or tabs.',
  contexts: ['any'],
  fixable: true,

  create(context) {
    return {
      Program(program) {
        const insideLiteral = literalRanges(program);
        const occurrences = [];

        forEachLine(context.sourceCode.text, (line) => {
          const trailing = TRAILING_WHITESPACE.exec(line.text);
          if (!trailing) {
            return;
          }
          const start = line.start + trailing.index;
          // A literal that continues past this line owns the whitespace (>= from: it may start here).
          if (insideLiteral.some(([from, to]) => start >= from && start < to)) {
            return;
          }
          occurrences.push({
            loc: pointLoc(line.number, trailing.index, line.text.length),
            edits: [{ range: [start, line.end], text: '' }]
          });
        });

        reportOnce(context, occurrences, {
          single: 'Trailing whitespace.',
          many: (count, line) => `Trailing whitespace on ${count} lines (first on line ${line}).`,
          explanation: 'Trailing whitespace adds noise to update set and version-control diffs.',
          recommendation: 'Remove it, or run the linter with --fix.'
        });
      }
    };
  }
};
