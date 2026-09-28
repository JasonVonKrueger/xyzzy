import { WRITABLE_GLOBALS } from '../known-globals.js';

const SIDE_EXPLANATIONS = {
  server:
    'Assigning to an undeclared name creates a global variable. On the server it lives in the shared Rhino global scope for the rest of the transaction, where it can collide with variables of the same name in other Business Rules and Script Includes.',
  client:
    'Assigning to an undeclared name creates a property on window. Every client script on the form shares it, so two scripts using the same name silently overwrite each other.'
};

export default {
  id: 'JS-GLOBAL-001',
  name: 'Accidental global variable',
  category: 'correctness',
  severity: 'warning',
  description: 'A value is assigned to a name that was never declared, creating an implicit global.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    return {
      Program() {
        for (const [name, references] of context.scopes.globalReferences) {
          if (WRITABLE_GLOBALS.has(name) || context.configuredGlobals.get(name)?.writable) {
            continue;
          }

          const writes = references.filter((reference) => reference.isWrite);
          if (writes.length === 0) {
            continue;
          }

          context.report({
            node: writes[0].identifier,
            message: `'${name}' is assigned without being declared, creating a global variable.`,
            explanation:
              SIDE_EXPLANATIONS[context.execution.side] ??
              'Assigning to an undeclared name creates a global variable that other scripts can overwrite (and in strict mode it throws a ReferenceError).',
            recommendation: `Declare it with var (or let/const in scoped ES2021 scripts) in the function that uses it. If it is intentionally shared, list it under "globals" in .snlintrc.json as "writable".`
          });
        }
      }
    };
  }
};
