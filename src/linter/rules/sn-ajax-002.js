import { callsBefore } from '../glide-record.js';
import { chainedRequest, paramName, requestsOf } from '../glide-ajax.js';
import { CLIENT_AND_UI_ACTION } from './client-helpers.js';

const ADD_PARAM = new Set(['addParam']);

export default {
  id: 'SN-AJAX-002',
  name: "GlideAjax without sysparm_name",
  category: 'correctness',
  severity: 'error',
  description: "A GlideAjax request sent without addParam('sysparm_name', ...), so the Script Include does not know which method to run.",
  contexts: CLIENT_AND_UI_ACTION,
  fixable: false,

  create(context) {
    function report(node, processor) {
      context.report({
        node,
        confidence: 0.9,
        message: `GlideAjax request${processor ? ` to ${processor}` : ''} without addParam('sysparm_name', ...).`,
        explanation: 'sysparm_name tells the client-callable Script Include which of its methods to call. Without it no method runs and the answer is null.',
        recommendation: "Add ga.addParam('sysparm_name', '<methodName>') before sending the request."
      });
    }

    return {
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'GlideAjax') {
          const chained = chainedRequest(node);
          if (chained) {
            report(chained.node, node.arguments[0] ? context.sourceCode.getText(node.arguments[0]) : null);
          }
        }
      },
      'Program:exit'() {
        for (const instance of context.glideAjax.instances) {
          const [request] = requestsOf(instance);
          if (!request || instance.escapes.some((identifier) => identifier.start < request.node.start)) {
            continue;
          }
          const params = callsBefore(instance, request.node, ADD_PARAM);
          // A parameter name from a variable might be sysparm_name.
          if (params.some((call) => paramName(call) === 'sysparm_name' || paramName(call) === null)) {
            continue;
          }
          report(request.node, instance.processor && `'${instance.processor}'`);
        }
      }
    };
  }
};
