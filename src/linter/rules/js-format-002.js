import { pointLoc, reportOnce } from './formatting-helpers.js';

const QUOTES = { single: "'", double: '"' };

export default {
  id: 'JS-FORMAT-002',
  name: 'Inconsistent quotes',
  category: 'formatting',
  severity: 'info',
  description: 'String literals that do not use the configured quote style. Option: { "style": "single" (default) | "double" }.',
  contexts: ['any'],
  fixable: true,

  create(context) {
    const style = context.options?.style === 'double' ? 'double' : 'single';
    const target = QUOTES[style];
    const other = style === 'single' ? QUOTES.double : QUOTES.single;
    const occurrences = [];

    return {
      Literal(node) {
        if (typeof node.value !== 'string' || node.raw[0] !== other) {
          return;
        }
        // Directives ('use strict') are compared by their raw text.
        if (node.parent.type === 'ExpressionStatement' && node.parent.directive !== undefined) {
          return;
        }
        const inner = node.raw.slice(1, -1);
        // Converting would need new escapes (or would leave needless ones): keep the author's choice.
        if (inner.includes(target) || inner.includes(`\\${other}`)) {
          return;
        }
        occurrences.push({
          loc: pointLoc(node.loc.start.line, node.loc.start.column, node.loc.end.column),
          edits: [{ range: [node.start, node.end], text: `${target}${inner}${target}` }]
        });
      },
      'Program:exit'() {
        reportOnce(context, occurrences, {
          single: `String uses ${style === 'single' ? 'double' : 'single'} quotes; the configured style is ${style}.`,
          many: (count, line) => `${count} strings use ${style === 'single' ? 'double' : 'single'} quotes (first on line ${line}); the configured style is ${style}.`,
          explanation: 'Mixed quote styles make scripts harder to scan and create noisy diffs when someone normalizes them later.',
          recommendation: `Run the linter with --fix, or set the rule option { "style": "${style === 'single' ? 'double' : 'single'}" } to match your team's convention. Strings that contain the other quote character are left alone.`
        });
      }
    };
  }
};
