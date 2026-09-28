import { scopeOf } from '../scope.js';

const ALWAYS_TRUTHY_TYPES = new Set([
  'ObjectExpression',
  'ArrayExpression',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ClassExpression'
]);

// Returns true / false for a condition whose value is known without running the code, or null.
function constantTruthiness(node, scope) {
  switch (node.type) {
    case 'Literal':
      return Boolean(node.value) || Boolean(node.regex);
    case 'TemplateLiteral':
      return node.expressions.length === 0 ? node.quasis[0].value.cooked !== '' : node.quasis.some((quasi) => quasi.value.cooked !== '') || null;
    case 'Identifier':
      return node.name === 'undefined' && !scope.resolve('undefined') ? false : null;
    case 'UnaryExpression': {
      if (node.operator === 'void') {
        return false;
      }
      if (node.operator === 'typeof') {
        return true; // typeof always yields a non-empty string
      }
      const inner = constantTruthiness(node.argument, scope);
      return node.operator === '!' && inner !== null ? !inner : null;
    }
    default:
      return ALWAYS_TRUTHY_TYPES.has(node.type) ? true : null;
  }
}

// `while (true)`, `for (;;)`, and `do {} while (1)` are intentional loops that exit with break/return.
function isIntentionalInfiniteLoop(statement, value) {
  return value === true && statement.type !== 'IfStatement' && statement.type !== 'ConditionalExpression' && statement.test.type === 'Literal';
}

export default {
  id: 'JS-COND-001',
  name: 'Constant condition',
  category: 'correctness',
  severity: 'warning',
  description: 'A condition always evaluates the same way, so one branch is dead code.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    function check(node) {
      if (!node.test) {
        return;
      }
      const value = constantTruthiness(node.test, scopeOf(context.scopes, node.test));
      if (value === null || isIntentionalInfiniteLoop(node, value)) {
        return;
      }

      const disabled = value === false && node.type === 'IfStatement';
      context.report({
        node: node.test,
        message: `Condition is always ${value ? 'true' : 'false'}.`,
        explanation: disabled
          ? '`if (false)` is often used to switch code off, but the dead block still ships with the record, confuses reviewers, and is easy to switch back on by accident.'
          : 'The condition does not depend on any data, so one branch can never run. It usually means a variable was meant to be tested (for example `if (typeof x)` instead of `if (typeof x !== "undefined")`).',
        recommendation: disabled
          ? 'Delete the disabled code; the record version history keeps the old script if it is needed again.'
          : 'Test the value that was intended, or remove the condition and the dead branch.'
      });
    }

    return {
      IfStatement: check,
      ConditionalExpression: check,
      WhileStatement: check,
      DoWhileStatement: check,
      ForStatement: check
    };
  }
};
