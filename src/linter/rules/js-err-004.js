import { getCalleeName, getMemberChain, getPropertyName, walk } from '../ast.js';
import { isLoggingCall } from '../known-globals.js';

const ERROR_DETAILS = new Set(['message', 'getMessage', 'toString', 'stack']);

// `e`, `e.message`, `e.getMessage()`, `e.toString()`, `String(e)`, `'' + e`
function isOnlyError(node, errorName) {
  switch (node.type) {
    case 'Identifier':
      return node.name === errorName;
    case 'MemberExpression':
      return getMemberChain(node.object) === errorName && ERROR_DETAILS.has(getPropertyName(node));
    case 'CallExpression':
      if (getCalleeName(node) === 'String') {
        return node.arguments.length === 1 && isOnlyError(node.arguments[0], errorName);
      }
      return node.callee.type === 'MemberExpression' && node.arguments.length === 0 && isOnlyError(node.callee, errorName);
    case 'BinaryExpression':
      return (
        node.operator === '+' &&
        ((isOnlyError(node.left, errorName) && isEmptyString(node.right)) || (isEmptyString(node.left) && isOnlyError(node.right, errorName)))
      );
    default:
      return false;
  }
}

function isEmptyString(node) {
  return node.type === 'Literal' && node.value === '';
}

export default {
  id: 'JS-ERR-004',
  name: 'Error logged without context',
  category: 'error-handling',
  severity: 'info',
  description: 'A catch block logs only the error itself, not what was being attempted or for which record.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    return {
      CatchClause(node) {
        if (node.param?.type !== 'Identifier') {
          return;
        }
        const errorName = node.param.name;

        walk(node.body, (child) => {
          if (isLoggingCall(child) && child.arguments.length > 0 && isOnlyError(child.arguments[0], errorName)) {
            context.report({
              node: child,
              message: `Log message contains only the error ('${context.sourceCode.getText(child.arguments[0])}').`,
              explanation:
                'A message like "TypeError: Cannot read property \'x\' of null" in the system log does not say which script, operation, or record failed, so it cannot be traced back without reproducing the problem.',
              recommendation: `Say what failed and for what, and pass a source: gs.error('IncidentUtils.closeStale: failed for ' + gr.getUniqueValue() + ': ' + ${errorName}.message, 'IncidentUtils').`
            });
          }
        });
      }
    };
  }
};
