import { callsBefore, callsNamed, describeTable, enclosingNextLoop, filterStrength, hasLimitBefore, QUERY_METHODS } from '../glide-record.js';
import { GR_CONTEXTS, WEAK_FILTER_CONFIDENCE } from './gr-helpers.js';

const ROW_WRITES = new Set(['update', 'deleteRecord']);

export default {
  id: 'SN-GR-003',
  name: 'Row-by-row write over an unfiltered query',
  category: 'servicenow',
  severity: 'error',
  description: 'update() or deleteRecord() inside while (gr.next()) over a query with no conditions touches every record in the table.',
  ...GR_CONTEXTS,
  fixable: false,

  create(context) {
    return {
      'Program:exit'() {
        for (const instance of context.glideRecords.instances) {
          for (const write of callsNamed(instance, ROW_WRITES)) {
            const loop = enclosingNextLoop(instance, write.node);
            const query = loop && callsBefore(instance, loop, QUERY_METHODS).pop();
            if (!query || hasLimitBefore(instance, query.node)) {
              continue;
            }
            const strength = filterStrength(instance, query.node, context.scopes);
            if (strength === 'static' || strength === 'unknown') {
              continue;
            }
            const action = write.method === 'update' ? 'updates' : 'deletes';
            context.report({
              node: write.node,
              confidence: strength === 'none' ? 0.9 : WEAK_FILTER_CONFIDENCE,
              message: `${instance.name}.${write.method}() in a loop over an unfiltered query ${action} every record in ${describeTable(instance)}.`,
              explanation: `The query on line ${query.node.loc.start.line} has ${strength === 'none' ? 'no conditions' : 'conditions that can be empty at runtime'}, so the loop visits the whole table and ${action} each record one at a time, running Business Rules for every row.`,
              recommendation: 'Add conditions to the query so only the intended records are visited. For a deliberate full-table job, use setLimit()/chooseWindow() batches and suppress this finding with a reason.'
            });
            break;
          }
        }
      }
    };
  }
};
