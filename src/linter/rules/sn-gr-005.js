import { getPropertyName } from '../ast.js';
import { callsNamed, contains, enclosingLoop, GET_METHODS, LIMIT_METHODS, QUERY_METHODS } from '../glide-record.js';
import { GR_CONTEXTS } from './gr-helpers.js';

const LOOKUPS = new Set([...QUERY_METHODS, ...GET_METHODS]);

function loopDescription(loop) {
  return loop.type === 'CallExpression' ? `${getPropertyName(loop.callee)}() callback` : 'loop';
}

export default {
  id: 'SN-GR-005',
  name: 'Database query inside a loop',
  category: 'performance',
  severity: 'warning',
  description: 'query(), get(), or getRefRecord() inside a loop runs one database round trip per iteration (N+1 queries).',
  ...GR_CONTEXTS,
  fixable: false,

  create(context) {
    function report(node, what, loop) {
      context.report({
        node,
        confidence: 0.8,
        message: `${what} inside a ${loopDescription(loop)} (line ${loop.loc.start.line}) runs a database query on every iteration.`,
        explanation: 'Each iteration makes its own round trip to the database. With hundreds of outer records this becomes hundreds of queries and a slow transaction (the N+1 query problem).',
        recommendation: 'Collect the keys first and run one query with addQuery(field, "IN", keys), use a GlideAggregate, or dot-walk the reference field instead of querying it separately.'
      });
    }

    return {
      CallExpression(node) {
        if (node.callee.type === 'MemberExpression' && getPropertyName(node.callee) === 'getRefRecord') {
          const loop = enclosingLoop(node);
          if (loop) {
            report(node, 'getRefRecord()', loop);
          }
        }
      },
      'Program:exit'() {
        for (const instance of context.glideRecords.instances) {
          for (const call of callsNamed(instance, LOOKUPS)) {
            const loop = enclosingLoop(call.node);
            // Paging through one table with chooseWindow()/setLimit() inside the loop is batching, not N+1.
            const pages = callsNamed(instance, LIMIT_METHODS).some((limit) => contains(loop ?? call.node, limit.node));
            if (loop && !pages) {
              report(call.node, `${instance.name}.${call.method}()`, loop);
              break;
            }
          }
        }
      }
    };
  }
};
