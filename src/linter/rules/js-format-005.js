import { forEachLine, isInside, literalRanges, pointLoc, reportOnce } from './formatting-helpers.js';

const DEFAULT_MAX = 2;

export default {
  id: 'JS-FORMAT-005',
  name: 'Too many blank lines',
  category: 'formatting',
  severity: 'info',
  description: 'More consecutive blank lines than allowed. Option: { "max": 2 }.',
  contexts: ['any'],
  fixable: true,

  create(context) {
    const max = Number.isInteger(context.options?.max) && context.options.max >= 0 ? context.options.max : DEFAULT_MAX;

    return {
      Program(program) {
        const insideLiteral = literalRanges(program);
        const occurrences = [];
        let run = [];

        forEachLine(context.sourceCode.text, (line) => {
          if (line.text.trim() === '' && !isInside(insideLiteral, line.start)) {
            run.push(line);
            return;
          }
          // Only runs followed by code are collapsed; the end of the file is left alone.
          if (run.length > max) {
            const extra = run[max];
            occurrences.push({
              loc: pointLoc(extra.number, 0),
              edits: [{ range: [extra.start, line.start], text: '' }],
              count: run.length
            });
          }
          run = [];
        });

        reportOnce(context, occurrences, {
          single: `${occurrences[0]?.count} consecutive blank lines (maximum ${max}).`,
          many: (count, line) => `${count} places with more than ${max} consecutive blank lines (first on line ${line}).`,
          explanation: 'Long gaps split a script into apparently unrelated parts and push code off screen in the ServiceNow script editor.',
          recommendation: 'Run the linter with --fix to collapse them.'
        });
      }
    };
  }
};
