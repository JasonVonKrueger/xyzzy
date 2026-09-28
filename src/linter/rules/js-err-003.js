import { isStringLiteral } from '../ast.js';

function isNonErrorValue(node) {
  switch (node.type) {
    case 'Literal':
    case 'TemplateLiteral':
    case 'ObjectExpression':
    case 'ArrayExpression':
      return true;
    case 'BinaryExpression':
      return node.operator === '+' && (isNonErrorValue(node.left) || isNonErrorValue(node.right) || isStringLiteral(node.left) || isStringLiteral(node.right));
    case 'Identifier':
      return node.name === 'undefined';
    default:
      return false;
  }
}

export default {
  id: 'JS-ERR-003',
  name: 'Throwing a non-Error value',
  category: 'error-handling',
  severity: 'warning',
  description: 'throw is used with a string, number, or plain object instead of an Error.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    return {
      ThrowStatement(node) {
        if (!isNonErrorValue(node.argument)) {
          return;
        }

        const isRest = context.execution.type === 'scripted_rest';
        context.report({
          node,
          message: 'Throwing a literal value instead of an Error object.',
          explanation: isRest
            ? 'A thrown string reaches the Scripted REST framework as a generic 500 Internal Server Error, hiding the real problem from the API client and losing the stack trace.'
            : 'A thrown string or object has no stack trace and no .message, so catch blocks that log e.message print "undefined" and the origin of the failure is lost.',
          recommendation: isRest
            ? "Throw a typed REST error, e.g. throw new sn_ws_err.BadRequestError('...') or sn_ws_err.NotFoundError, or set the status with response.setError()."
            : "Throw an Error: throw new Error('<what failed and why>')."
        });
      }
    };
  }
};
