import {
  callsNamed,
  contains,
  enclosingLoop,
  filterStrength,
  hasLimitBefore,
  NEXT_METHODS,
  QUERY_METHODS
} from '../glide-record.js';
import { GR_CONTEXTS } from './gr-helpers.js';

// A sys_id condition already matches at most one row.
function filtersBySysId(instance, sourceCode) {
  return callsNamed(instance, new Set(['addQuery', 'addEncodedQuery'])).some((call) =>
    /^['"`]sys_id(['"`]|=)/.test(sourceCode.getText(call.args[0] ?? call.node).trim())
  );
}

export default {
  id: 'SN-GR-007',
  name: 'Single-record read without setLimit(1)',
  category: 'performance',
  severity: 'info',
  description: 'A query read with if (gr.next()) uses only the first row but asks the database for all matching rows.',
  ...GR_CONTEXTS,
  fixable: false,

  create(context) {
    return {
      'Program:exit'() {
        for (const instance of context.glideRecords.instances) {
          if (instance.isAggregate) {
            continue;
          }
          const query = callsNamed(instance, QUERY_METHODS)[0];
          const nexts = callsNamed(instance, NEXT_METHODS).filter((call) => call.method !== 'hasNext');
          if (!query || nexts.length === 0 || hasLimitBefore(instance, query.node)) {
            continue;
          }
          // Every next() must run at most once per query: no loop around it that does not also re-run the query.
          const singleRead = nexts.every((call) => {
            const loop = enclosingLoop(call.node);
            return call.node.start > query.node.start && (!loop || contains(loop, query.node));
          });
          // Unfiltered queries are SN-GR-004's concern.
          if (!singleRead || filterStrength(instance, query.node, context.scopes) !== 'static' || filtersBySysId(instance, context.sourceCode)) {
            continue;
          }
          context.report({
            node: query.node,
            confidence: 0.8,
            message: `${instance.name} reads only the first matching record but the query has no setLimit(1).`,
            explanation: 'Without a limit the database finds and returns every matching row, and GlideRecord fetches them in batches, even though only the first is used.',
            recommendation: `Call ${instance.name}.setLimit(1) before query(). Add orderBy() if it matters which record is first.`
          });
        }
      }
    };
  }
};
