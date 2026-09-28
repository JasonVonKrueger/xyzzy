import { getFunctionName } from '../ast.js';

const CLIENT_ENTRY_POINTS = new Set(['onLoad', 'onChange', 'onSubmit', 'onCellEdit']);

function hasComment(body, comments) {
  return comments.some((comment) => comment.start > body.start && comment.end < body.end);
}

// Empty functions passed as arguments are no-op callbacks (a common, deliberate pattern) and empty
// `initialize` methods are the Script Include template, so neither is reported. A comment inside the
// body marks an empty function as intentional.
export default {
  id: 'JS-FUNC-001',
  name: 'Empty function',
  category: 'correctness',
  severity: 'info',
  description: 'A function has an empty body and no comment explaining why.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    function check(node) {
      if (node.body.type !== 'BlockStatement' || node.body.body.length > 0) {
        return;
      }
      if (hasComment(node.body, context.sourceCode.comments)) {
        return;
      }
      const parent = node.parent;
      if ((parent.type === 'CallExpression' || parent.type === 'NewExpression') && parent.arguments.includes(node)) {
        return;
      }

      const name = getFunctionName(node);
      if (name === 'initialize') {
        return;
      }

      const isClientEntryPoint = CLIENT_ENTRY_POINTS.has(name) && parent.type === 'Program';
      context.report({
        loc: { start: node.loc.start, end: node.body.loc.start },
        message: isClientEntryPoint ? `Empty ${name}() client script.` : `Function '${name}' is empty.`,
        explanation: isClientEntryPoint
          ? `An empty ${name}() does nothing, but the record is still downloaded and run in the browser on every matching form load.`
          : 'An empty function usually marks unfinished work, or a callback that silently ignores a result it should handle.',
        recommendation: isClientEntryPoint
          ? 'Deactivate or delete the Client Script record.'
          : 'Implement it, remove it, or add a comment inside the body explaining why it is intentionally empty.'
      });
    }

    return { FunctionDeclaration: check, FunctionExpression: check, ArrowFunctionExpression: check };
  }
};
