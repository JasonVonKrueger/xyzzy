// `while ((match = pattern.exec(text)))` style loops are a real idiom, so assignments in loop conditions
// are reported with low confidence (WARNING); in `if` and ternaries they are almost always a typo.
const LOOP_CONFIDENCE = 0.6;
const BRANCH_CONFIDENCE = 0.95;

function findAssignment(node) {
  if (node.type === 'AssignmentExpression' && node.operator === '=') {
    return node;
  }
  if (node.type === 'LogicalExpression') {
    return findAssignment(node.left) ?? findAssignment(node.right);
  }
  if (node.type === 'UnaryExpression' && node.operator === '!') {
    return findAssignment(node.argument);
  }
  return null;
}

// Parentheses directly around `start`, e.g. 2 for `if ((match = re.exec(s)))`.
function wrappingParens(text, start) {
  let count = 0;
  for (let index = start - 1; index >= 0; index -= 1) {
    const char = text[index];
    if (char === '(') {
      count += 1;
    } else if (!/\s/.test(char)) {
      break;
    }
  }
  return count;
}

// Extra parentheses around the whole test — `if ((x = next()))` — are the conventional way to say "this
// assignment is intentional" (as in ESLint's no-cond-assign "except-parens").
function isMarkedIntentional(statement, assignment, text) {
  if (statement.test !== assignment || statement.type === 'ConditionalExpression') {
    return false;
  }
  const required = statement.type === 'ForStatement' ? 1 : 2;
  return wrappingParens(text, assignment.start) >= required;
}

export default {
  id: 'JS-COND-002',
  name: 'Assignment in condition',
  category: 'correctness',
  severity: 'error',
  description: 'A condition uses = (assignment) where == or === (comparison) was probably intended.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    function check(node) {
      if (!node.test) {
        return;
      }
      const assignment = findAssignment(node.test);
      if (!assignment || isMarkedIntentional(node, assignment, context.sourceCode.text)) {
        return;
      }

      const isBranch = node.type === 'IfStatement' || node.type === 'ConditionalExpression';
      const target = context.sourceCode.getText(assignment.left);
      const value = context.sourceCode.getText(assignment.right);
      const isField = assignment.left.type === 'MemberExpression';

      context.report({
        node: assignment,
        confidence: isBranch ? BRANCH_CONFIDENCE : LOOP_CONFIDENCE,
        message: `Assignment '${target} = ${value}' used as a condition. Did you mean '${target} == ${value}'?`,
        explanation: isField
          ? `This sets ${target} to ${value} instead of comparing it, and the condition then depends only on ${value}. On a GlideRecord the changed field is saved by the next update(), silently corrupting data.`
          : `This assigns ${value} to ${target} instead of comparing them, so the condition depends only on ${value}.`,
        recommendation: isBranch
          ? `Use == or === to compare.`
          : `Use == or === to compare. If the assignment is intentional, wrap it in a second pair of parentheses or compare the result explicitly: while ((${target} = ${value}) !== null).`
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
