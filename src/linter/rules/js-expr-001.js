import { getMemberChain, getPropertyName } from '../ast.js';

const EFFECT_TYPES = new Set([
  'CallExpression',
  'NewExpression',
  'AssignmentExpression',
  'UpdateExpression',
  'AwaitExpression',
  'YieldExpression',
  'ImportExpression',
  'TaggedTemplateExpression'
]);
const COMPARISON_OPERATORS = new Set(['==', '===', '!=', '!==', '<', '>', '<=', '>=']);

function hasEffect(node) {
  if (EFFECT_TYPES.has(node.type)) {
    return true;
  }
  switch (node.type) {
    case 'ChainExpression':
      return hasEffect(node.expression);
    case 'UnaryExpression':
      return node.operator === 'delete' || node.operator === 'void';
    case 'SequenceExpression':
      return node.expressions.every(hasEffect);
    // `ready && init();` and `ok ? save() : warn();` run code conditionally.
    case 'LogicalExpression':
      return hasEffect(node.right);
    case 'ConditionalExpression':
      return hasEffect(node.consequent) || hasEffect(node.alternate);
    default:
      return false;
  }
}

function describe(expression, sourceCode) {
  if (expression.type === 'BinaryExpression' && COMPARISON_OPERATORS.has(expression.operator)) {
    const left = sourceCode.getText(expression.left);
    const right = sourceCode.getText(expression.right);
    return {
      message: `Comparison result is discarded. Did you mean '${left} = ${right}'?`,
      explanation: `This compares ${left} with ${right} and throws the result away, so ${left} is not changed. It is usually an assignment typed as ==.`,
      recommendation: 'Use = to assign, or remove the statement.'
    };
  }

  if (expression.type === 'MemberExpression') {
    const chain = getMemberChain(expression) ?? sourceCode.getText(expression);
    const method = getPropertyName(expression);
    return {
      message: `'${chain}' is read but not called. Did you mean '${chain}()'?`,
      explanation: `Referring to ${method ?? 'a property'} without parentheses does nothing${method === 'next' || method === 'query' || method === 'update' ? `; ${chain} never runs, so no records are read or written` : ''}.`,
      recommendation: `Add () to call it, or remove the statement.`
    };
  }

  return {
    message: 'Expression has no effect.',
    explanation: 'The value of this statement is computed and thrown away. It is usually an incomplete edit or a typo.',
    recommendation: 'Remove the statement, or turn it into the assignment or call that was intended.'
  };
}

export default {
  id: 'JS-EXPR-001',
  name: 'Expression with no effect',
  category: 'correctness',
  severity: 'warning',
  description: 'A statement computes a value and discards it (e.g. `x == 5;` or `gr.next;`).',
  contexts: ['any'],
  fixable: false,

  create(context) {
    return {
      ExpressionStatement(node) {
        if (node.directive !== undefined || hasEffect(node.expression)) {
          return;
        }
        context.report({ node, ...describe(node.expression, context.sourceCode) });
      }
    };
  }
};
