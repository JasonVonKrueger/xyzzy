import { callsNamed } from '../glide-record.js';
import { paramName } from '../glide-ajax.js';
import { CLIENT_AND_UI_ACTION } from './client-helpers.js';

export default {
  id: 'SN-AJAX-003',
  name: 'GlideAjax parameter without the sysparm_ prefix',
  category: 'correctness',
  severity: 'error',
  description: "addParam() names must start with sysparm_; other parameters never reach the Script Include.",
  contexts: CLIENT_AND_UI_ACTION,
  fixable: false,

  create(context) {
    return {
      'Program:exit'() {
        for (const instance of context.glideAjax.instances) {
          for (const call of callsNamed(instance, new Set(['addParam']))) {
            const name = paramName(call);
            if (name === null || name.startsWith('sysparm_')) {
              continue;
            }
            context.report({
              node: call.args[0],
              confidence: 0.9,
              message: `GlideAjax parameter '${name}' does not start with sysparm_, so the server never receives it.`,
              explanation: `The GlideAjax processor only passes parameters named sysparm_*. On the server, this.getParameter('${name}') returns null.`,
              recommendation: `Rename it to 'sysparm_${name}' here and in the Script Include's getParameter() call.`
            });
          }
        }
      }
    };
  }
};
