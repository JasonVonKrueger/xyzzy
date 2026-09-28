import { callsNamed, describeTable, filterStrength, hasLimitBefore, QUERY_METHODS } from '../glide-record.js';
import { GR_CONTEXTS } from './gr-helpers.js';

export default {
  id: 'SN-GR-004',
  name: 'Unfiltered query without a limit',
  category: 'performance',
  severity: 'warning',
  description: 'query() with no conditions and no setLimit() reads the whole table. Option: allowUnfilteredTables (table names).',
  ...GR_CONTEXTS,
  fixable: false,

  create(context) {
    const allowed = new Set(context.options?.allowUnfilteredTables ?? []);

    return {
      'Program:exit'() {
        for (const instance of context.glideRecords.instances) {
          if (instance.isAggregate || allowed.has(instance.table)) {
            continue;
          }
          const query = callsNamed(instance, QUERY_METHODS)[0];
          if (!query || hasLimitBefore(instance, query.node)) {
            continue;
          }
          if (filterStrength(instance, query.node, context.scopes) !== 'none') {
            continue;
          }
          context.report({
            node: query.node,
            confidence: 0.85,
            message: `${instance.name}.query() on ${describeTable(instance)} has no conditions and no setLimit().`,
            explanation: 'An unfiltered query reads every row in the table. On large tables (task, sys_audit, syslog, cmdb_ci) that is slow, holds a database connection, and can hit transaction quotas. It is also often a sign that a condition was forgotten.',
            recommendation: 'Add addQuery()/addEncodedQuery() conditions, or setLimit() if only a few rows are needed. If reading the whole (small) table is intended, list it in the allowUnfilteredTables option.'
          });
        }
      }
    };
  }
};
