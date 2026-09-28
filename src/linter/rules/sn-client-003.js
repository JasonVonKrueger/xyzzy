import { isFunctionNode } from '../ast.js';
import { CLIENT_AND_UI_ACTION, callbackOf, gFormMethod, portalSeverity } from './client-helpers.js';

export default {
  id: 'SN-CLIENT-003',
  name: 'g_form.getReference() without a callback',
  category: 'performance',
  severity: 'error',
  description: 'g_form.getReference(field) without a callback is a synchronous server call. ERROR in Service Portal (unsupported), WARNING in the classic UI.',
  contexts: CLIENT_AND_UI_ACTION,
  fixable: false,

  create(context) {
    return {
      CallExpression(node) {
        if (gFormMethod(node, context.scopes) !== 'getReference' || callbackOf(node, context.scopes)) {
          return;
        }
        // A callback held in a variable or property: we cannot see it, so assume it is one.
        if (node.arguments.length > 1 && !isFunctionNode(node.arguments[1])) {
          return;
        }
        const field = context.sourceCode.getText(node.arguments[0] ?? node);
        context.report({
          node,
          severity: portalSeverity(context.execution),
          confidence: 0.9,
          message: `g_form.getReference(${field}) without a callback waits synchronously for the server.`,
          explanation: 'Without a callback, getReference() fetches the whole referenced record synchronously and freezes the page until it arrives. Service Portal requires the callback form.',
          recommendation: `Pass a callback: g_form.getReference(${field}, function (ref) { ... }). If you only need one or two fields, a GlideAjax call returning just those values is lighter still.`
        });
      }
    };
  }
};
