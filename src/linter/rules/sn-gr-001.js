import { callsNamed, describeTable, filterStrength } from '../glide-record.js';
import { GR_CONTEXTS, WEAK_FILTER_CONFIDENCE } from './gr-helpers.js';

// SN-GR-001 and SN-GR-002 differ only in the method and its consequence.
export function createMassWriteRule({ id, method, name, verb, consequence }) {
  return {
    id,
    name,
    category: 'servicenow',
    severity: 'error',
    description: `${method}() on a GlideRecord with no query conditions ${verb} every record in the table.`,
    ...GR_CONTEXTS,
    fixable: false,

    create(context) {
      return {
        'Program:exit'() {
          for (const instance of context.glideRecords.instances) {
            for (const call of callsNamed(instance, new Set([method]))) {
              const strength = filterStrength(instance, call.node, context.scopes);
              if (strength === 'static' || strength === 'unknown') {
                continue;
              }
              const table = describeTable(instance);
              context.report({
                node: call.node,
                confidence: strength === 'none' ? 0.95 : WEAK_FILTER_CONFIDENCE,
                message:
                  strength === 'none'
                    ? `${instance.name}.${method}() has no query conditions: it ${verb} every record in ${table}.`
                    : `${instance.name}.${method}() may run without conditions: its only filters can be empty or skipped at runtime.`,
                explanation:
                  strength === 'none'
                    ? `No addQuery()/addEncodedQuery() call restricts ${instance.name} before ${method}(), so ${consequence}`
                    : `The conditions on ${instance.name} are built from a value that can be empty (an encoded query from a variable, or an empty string) or are added only inside a branch. If they end up empty, ${consequence}`,
                recommendation: `Add a condition that always applies before ${method}(), guard against an empty encoded query (if (!query) return;), and check the affected row count with a GlideAggregate first.`
              });
            }
          }
        }
      };
    }
  };
}

export default createMassWriteRule({
  id: 'SN-GR-001',
  method: 'updateMultiple',
  name: 'Unrestricted updateMultiple',
  verb: 'updates',
  consequence:
    'the whole table is updated in one statement, without per-record Business Rule context to catch the mistake, and there is no undo.'
});
