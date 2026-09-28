import { getPropertyName } from '../ast.js';

// Walks a promise chain from the outermost call inwards: fetch(u).then(a).then(b)
function chainMethods(expression) {
  const methods = [];
  let node = expression.type === 'ChainExpression' ? expression.expression : expression;

  while (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
    methods.push({ name: getPropertyName(node.callee), call: node });
    node = node.callee.object;
  }
  return methods;
}

// Only statement-level chains are checked: a returned, awaited, or assigned promise is the caller's to
// handle.
export default {
  id: 'JS-ERR-005',
  name: 'Unhandled promise rejection',
  category: 'error-handling',
  severity: 'warning',
  description: 'A promise chain (e.g. $http, fetch, GlideAjax wrappers) has no rejection handler.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    return {
      ExpressionStatement(node) {
        const methods = chainMethods(node.expression);
        const [outermost] = methods;
        if (!outermost || !['then', 'finally'].includes(outermost.name)) {
          return;
        }
        const handled = methods.some(
          ({ name, call }) => name === 'catch' || (name === 'then' && call.arguments.length >= 2)
        );
        if (handled) {
          return;
        }

        context.report({
          node,
          confidence: 0.8,
          message: 'Promise chain has no rejection handler.',
          explanation:
            'If the request fails (network error, 4xx/5xx from the instance, an exception in a then callback), the rejection is unhandled: the user sees nothing, the form stays in a half-updated state, and the only trace is in the browser console.',
          recommendation: 'Add .catch(function (error) { ... }) at the end of the chain and tell the user (e.g. spUtil.addErrorMessage or g_form.addErrorMessage).'
        });
      }
    };
  }
};
