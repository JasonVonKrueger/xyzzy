import { getPropertyName } from '../ast.js';
import { CLIENT_AND_UI_ACTION, portalSeverity, runsInPortal } from './client-helpers.js';

export default {
  id: 'SN-CLIENT-002',
  name: 'Synchronous GlideAjax (getXMLWait)',
  category: 'performance',
  severity: 'error',
  description: 'getXMLWait() blocks the browser until the server answers, and is not available in Service Portal. ERROR there, WARNING in the classic UI.',
  contexts: CLIENT_AND_UI_ACTION,
  fixable: false,

  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'MemberExpression' || getPropertyName(node.callee) !== 'getXMLWait') {
          return;
        }
        const portal = runsInPortal(context.execution);
        context.report({
          node,
          severity: portalSeverity(context.execution),
          confidence: 0.9,
          message: portal
            ? `getXMLWait() is not supported in Service Portal: this ${context.execution.label} fails there.`
            : 'getXMLWait() freezes the browser until the server answers.',
          explanation: 'A synchronous request locks the whole page: the user cannot type, scroll, or click until the server responds, and a slow instance makes the form look hung. Service Portal and Workspace do not support synchronous GlideAjax at all.',
          recommendation: "Use asynchronous getXMLAnswer(function (answer) { ... }) and continue the logic inside the callback. In onSubmit, see SN-AJAX-004 for how to validate asynchronously."
        });
      }
    };
  }
};
