function isIife(statement) {
  let expression = statement.type === 'ExpressionStatement' ? statement.expression : null;
  if (expression?.type === 'UnaryExpression') {
    expression = expression.argument;
  }
  return (
    expression?.type === 'CallExpression' &&
    (expression.callee.type === 'FunctionExpression' || expression.callee.type === 'ArrowFunctionExpression')
  );
}

// Top-level code that is fine: the executeRule IIFE, function declarations (the legacy onBefore()
// template), a call to such a function, and directives.
function isWrapped(statement, functionNames) {
  if (isIife(statement) || statement.type === 'FunctionDeclaration' || statement.type === 'EmptyStatement' || statement.directive) {
    return true;
  }
  const expression = statement.type === 'ExpressionStatement' ? statement.expression : null;
  return expression?.type === 'CallExpression' && expression.callee.type === 'Identifier' && functionNames.has(expression.callee.name);
}

export default {
  id: 'SN-BR-005',
  name: 'Business Rule code outside a function',
  category: 'servicenow',
  severity: 'warning',
  description: 'Business Rule statements at the top level, outside (function executeRule(current, previous) { ... })(current, previous).',
  contexts: ['business_rule'],
  fixable: false,

  create(context) {
    return {
      Program(program) {
        const functionNames = new Set(
          program.body.filter((statement) => statement.type === 'FunctionDeclaration').map((statement) => statement.id.name)
        );
        const loose = program.body.filter((statement) => !isWrapped(statement, functionNames));
        if (loose.length === 0) {
          return;
        }
        const variables = loose.filter((statement) => statement.type === 'VariableDeclaration').length;
        context.report({
          node: loose[0],
          confidence: 0.85,
          message: `${loose.length} top-level statement${loose.length === 1 ? '' : 's'} outside a function${variables ? ` (${variables} variable declaration${variables === 1 ? '' : 's'})` : ''}.`,
          explanation: 'Business Rules on the global scope share one global namespace for the whole transaction. Top-level variables become globals that other Business Rules can read or overwrite, which causes intermittent bugs that depend on rule order.',
          recommendation: 'Wrap the script in the standard template: (function executeRule(current, previous) { ... })(current, previous);'
        });
      }
    };
  }
};
