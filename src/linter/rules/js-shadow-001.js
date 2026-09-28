import { SERVICENOW_GLOBALS } from '../servicenow-apis.js';

const RESTRICTED = new Set(['undefined', 'NaN', 'Infinity', 'eval', 'arguments']);

// ServiceNow globals worth protecting: platform objects scripts depend on, on the side where they exist.
// Parameters named `current` or `previous` are normal (executeRule(current, previous), helper(current)),
// so parameters are only checked against the restricted JavaScript names.
const PROTECTED = new Set(
  [...SERVICENOW_GLOBALS].filter(([, api]) => api.signal).map(([name]) => name)
);

const DECLARATION_KINDS = new Set(['var', 'let', 'const', 'function', 'class']);

export default {
  id: 'JS-SHADOW-001',
  name: 'Shadowed ServiceNow or JavaScript global',
  category: 'correctness',
  severity: 'warning',
  description: 'A declaration reuses the name of a ServiceNow global (gs, current, g_form, ...) or a restricted JavaScript name.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    return {
      Program() {
        for (const scope of context.scopes.scopes) {
          for (const variable of scope.variables.values()) {
            const restricted = RESTRICTED.has(variable.name);
            // A global only matters on the side where it exists: `var current` is harmless in a client
            // script, and in code of unknown origin names like current/previous are just words.
            const side = SERVICENOW_GLOBALS.get(variable.name)?.side;
            const isProtected =
              PROTECTED.has(variable.name) && (side === context.execution.side || context.execution.side === 'both');
            if (!restricted && !isProtected) {
              continue;
            }

            const def = variable.defs.find(
              (candidate) => DECLARATION_KINDS.has(candidate.kind) || (restricted && candidate.kind === 'param')
            );
            if (!def) {
              continue;
            }

            const api = SERVICENOW_GLOBALS.get(variable.name);
            context.report({
              node: def.identifier,
              message: restricted
                ? `'${variable.name}' is a built-in JavaScript name and should not be redeclared.`
                : `'${variable.name}' hides the ServiceNow global ${api.api}.`,
              explanation: restricted
                ? `Redeclaring ${variable.name} changes the meaning of every use in this scope, which breaks code that relies on the built-in.`
                : `Inside this scope ${variable.name} no longer refers to the platform object. Code (or a later edit) that expects the real ${variable.name} — for example current.update() or gs.info() — silently operates on this variable instead.`,
              recommendation: `Rename the variable (for example ${variable.name}Record or my${variable.name[0].toUpperCase()}${variable.name.slice(1)}).`
            });
          }
        }
      }
    };
  }
};
