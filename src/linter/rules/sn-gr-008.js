import { callsNamed, describeTable, NEXT_METHODS } from '../glide-record.js';
import { GR_CONTEXTS } from './gr-helpers.js';

export default {
  id: 'SN-GR-008',
  name: 'getRowCount() used to count records',
  category: 'performance',
  severity: 'warning',
  description: 'getRowCount() on a GlideRecord whose rows are never read: the query fetched every record just to count them.',
  ...GR_CONTEXTS,
  fixable: false,

  create(context) {
    return {
      'Program:exit'() {
        for (const instance of context.glideRecords.instances) {
          if (instance.isAggregate || instance.escapes.length > 0 || callsNamed(instance, NEXT_METHODS).length > 0) {
            continue;
          }
          const count = callsNamed(instance, new Set(['getRowCount']))[0];
          if (!count) {
            continue;
          }
          context.report({
            node: count.node,
            confidence: 0.85,
            message: `${instance.name}.getRowCount() counts records by fetching all of them from ${describeTable(instance)}.`,
            explanation: 'getRowCount() runs the full query and loads the result set just to count it. GlideAggregate asks the database for COUNT(*) instead, which is far cheaper on large tables.',
            recommendation: `Use a GlideAggregate: var ga = new GlideAggregate(table); ga.addQuery(...); ga.addAggregate('COUNT'); ga.query(); var count = ga.next() ? parseInt(ga.getAggregate('COUNT'), 10) : 0;`
          });
        }
      }
    };
  }
};
