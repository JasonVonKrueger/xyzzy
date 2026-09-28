import { forEachLine, isInside, literalRanges, pointLoc, reportOnce } from './formatting-helpers.js';

const DEFAULT_TAB_WIDTH = 4;

// Visual width of leading whitespace, with tabs advancing to the next tab stop.
function width(leading, tabWidth) {
  let columns = 0;
  for (const char of leading) {
    columns = char === '\t' ? (Math.floor(columns / tabWidth) + 1) * tabWidth : columns + 1;
  }
  return columns;
}

// Tabs for indentation followed by spaces for alignment is a legitimate tabs style.
function isAcceptable(leading, style, tabWidth) {
  if (style === 'spaces') {
    return !leading.includes('\t');
  }
  return /^\t+ *$/.test(leading) || (/^ *$/.test(leading) && leading.length < tabWidth);
}

function indentation(columns, style, tabWidth) {
  return style === 'tabs'
    ? '\t'.repeat(Math.floor(columns / tabWidth)) + ' '.repeat(columns % tabWidth)
    : ' '.repeat(columns);
}

export default {
  id: 'JS-FORMAT-004',
  name: 'Mixed indentation',
  category: 'formatting',
  severity: 'info',
  description: 'Indentation that mixes tabs and spaces (tabs followed by alignment spaces are fine). Options: { "style": "spaces" | "tabs" (default: whichever the file mostly uses), "tabWidth": 4 }.',
  contexts: ['any'],
  fixable: true,

  create(context) {
    const tabWidth = Number.isInteger(context.options?.tabWidth) && context.options.tabWidth > 0 ? context.options.tabWidth : DEFAULT_TAB_WIDTH;

    return {
      Program(program) {
        const insideLiteral = literalRanges(program);
        const lines = [];
        forEachLine(context.sourceCode.text, (line) => {
          const leading = /^[ \t]*/.exec(line.text)[0];
          // Blank lines are JS-FORMAT-001's; lines that continue a string or template belong to the value.
          if (leading.length > 0 && leading.length < line.text.length && !isInside(insideLiteral, line.start)) {
            lines.push({ ...line, leading });
          }
        });

        let style = context.options?.style;
        if (style !== 'spaces' && style !== 'tabs') {
          const tabbed = lines.filter((line) => line.leading[0] === '\t').length;
          style = tabbed > lines.length - tabbed ? 'tabs' : 'spaces';
        }

        const occurrences = [];
        for (const line of lines) {
          if (isAcceptable(line.leading, style, tabWidth)) {
            continue;
          }
          const expected = indentation(width(line.leading, tabWidth), style, tabWidth);
          if (expected !== line.leading) {
            occurrences.push({
              loc: pointLoc(line.number, 0, line.leading.length),
              edits: [{ range: [line.start, line.start + line.leading.length], text: expected }]
            });
          }
        }

        reportOnce(context, occurrences, {
          single: `Indentation does not use ${style} consistently.`,
          many: (count, first) => `${count} lines are indented with a mix of tabs and spaces (first on line ${first}); this file uses ${style}.`,
          explanation: 'Tabs and spaces render differently in the ServiceNow script editor, diff viewers, and IDEs, so mixed indentation makes nesting look wrong and hides real structure.',
          recommendation: `Run the linter with --fix to convert them to ${style} (tab width ${tabWidth}).`
        });
      }
    };
  }
};
