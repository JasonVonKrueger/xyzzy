import { pointLoc, reportOnce } from './formatting-helpers.js';

const TERMINATED = [
  'ExpressionStatement',
  'VariableDeclaration',
  'ReturnStatement',
  'ThrowStatement',
  'BreakStatement',
  'ContinueStatement',
  'DoWhileStatement',
  'DebuggerStatement'
];

function isLoopHead(node) {
  const parent = node.parent;
  return (
    (parent.type === 'ForStatement' && parent.init === node) ||
    ((parent.type === 'ForInStatement' || parent.type === 'ForOfStatement') && parent.left === node)
  );
}

export default {
  id: 'JS-FORMAT-003',
  name: 'Missing semicolon',
  category: 'formatting',
  severity: 'info',
  description: 'Statements that end without a semicolon and rely on automatic semicolon insertion.',
  contexts: ['any'],
  fixable: true,

  create(context) {
    const { text } = context.sourceCode;
    const occurrences = [];

    function check(node) {
      if (text[node.end - 1] === ';' || isLoopHead(node)) {
        return;
      }
      const { line, column } = node.loc.end;
      occurrences.push({ loc: pointLoc(line, column), edits: [{ range: [node.end, node.end], text: ';' }] });
    }

    return {
      ...Object.fromEntries(TERMINATED.map((type) => [type, check])),
      'Program:exit'() {
        reportOnce(context, occurrences, {
          single: 'Missing semicolon.',
          many: (count, line) => `Missing semicolons on ${count} statements (first on line ${line}).`,
          explanation: 'Without semicolons the code depends on automatic semicolon insertion. A later edit that starts a line with ( or [ then silently joins two statements, and minified or concatenated scripts (UI Scripts) can break.',
          recommendation: 'Run the linter with --fix to add them.'
        });
      }
    };
  }
};
