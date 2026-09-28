import { isTypeofOperand } from '../ast.js';
import { SERVICENOW_GLOBALS } from '../servicenow-apis.js';

// Reported once per API (first use, with a count) rather than on every line, so a misclassified script
// produces a handful of findings instead of hundreds.
export default {
  id: 'SN-CLIENT-001',
  name: 'Server-only API used in client-side code',
  category: 'servicenow',
  severity: 'error',
  description: 'Detects server-side ServiceNow APIs (gs, current, GlideAggregate, RESTMessageV2, ...) in browser code.',
  contexts: ['client'],
  fixable: false,

  create(context) {
    return {
      Program() {
        for (const [name, references] of context.scopes.globalReferences) {
          const api = SERVICENOW_GLOBALS.get(name);
          if (api?.side !== 'server') {
            continue;
          }

          // `typeof gs !== 'undefined'` is how shared code guards server-only calls.
          const uses = references.filter((reference) => !isTypeofOperand(reference.identifier));
          if (uses.length === 0) {
            continue;
          }

          const more = uses.length > 1 ? ` (${uses.length} uses)` : '';
          context.report({
            node: uses[0].identifier,
            message: `Server-only API ${api.api} used in client-side code${more}.`,
            explanation: `${name} exists only on the ServiceNow server. In the browser it is undefined, so this line throws a ReferenceError and the rest of the ${context.execution.label} stops running.`,
            recommendation: api.clientAlternative
          });
        }
      }
    };
  }
};
