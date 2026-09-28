import { getPropertyName } from '../ast.js';
import { REQUEST_METHODS } from '../glide-ajax.js';
import { callbackOf, entryPoint, ownNodes } from './client-helpers.js';

// Asynchronous calls whose callback runs after onSubmit has returned.
const ASYNC_METHODS = new Set([...REQUEST_METHODS, 'getReference', 'query', 'get'].filter((method) => method !== 'getXMLWait'));

function isReturnFalse(node) {
  return node.type === 'ReturnStatement' && node.argument?.type === 'Literal' && node.argument.value === false;
}

export default {
  id: 'SN-AJAX-004',
  name: 'return false in an asynchronous callback in onSubmit',
  category: 'correctness',
  severity: 'error',
  description: 'In onSubmit, return false inside a GlideAjax/getReference callback cannot stop the submit: onSubmit has already returned.',
  contexts: ['client'],
  fixable: false,

  create(context) {
    return {
      Program(program) {
        const onSubmit = entryPoint(program, 'onSubmit');
        if (!onSubmit) {
          return;
        }
        const asyncCalls = ownNodes(onSubmit, (node) => {
          if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') {
            return false;
          }
          return ASYNC_METHODS.has(getPropertyName(node.callee));
        });

        for (const call of asyncCalls) {
          const callback = callbackOf(call, context.scopes);
          const [returnFalse] = callback ? ownNodes(callback, isReturnFalse) : [];
          if (!returnFalse) {
            continue;
          }
          context.report({
            node: returnFalse,
            confidence: 0.9,
            message: `return false inside the ${getPropertyName(call.callee)}() callback cannot cancel the submit.`,
            explanation: 'The callback runs after the server answers, by which time onSubmit has already returned and the form has been submitted. Its return value goes nowhere, so the validation never blocks anything.',
            recommendation: 'Validate before submit (for example in onChange, storing the result in g_scratchpad), or return false from onSubmit, then call g_form.submit() from the callback once the check passes (with a flag so the second onSubmit lets it through).'
          });
        }
      }
    };
  }
};
