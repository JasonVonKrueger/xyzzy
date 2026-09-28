import {
  CONSUMER_METHODS,
  contains,
  enclosingLoop,
  enclosingNextLoop,
  FILTER_METHODS,
  GET_METHODS,
  LIMIT_METHODS,
  NEXT_METHODS,
  QUERY_METHODS
} from '../glide-record.js';
import { GR_CONTEXTS } from './gr-helpers.js';

const READERS = new Set([...QUERY_METHODS, ...GET_METHODS]);
const MODIFIERS = new Set([...FILTER_METHODS, ...LIMIT_METHODS, 'orderBy', 'orderByDesc']);

export default {
  id: 'SN-GR-010',
  name: 'GlideRecord calls out of order',
  category: 'servicenow',
  severity: 'error',
  description: 'next() before query(), or conditions added after the last query(), so they have no effect.',
  ...GR_CONTEXTS,
  fixable: false,

  create(context) {
    return {
      'Program:exit'() {
        for (const instance of context.glideRecords.instances) {
          // Only calls in the function that created the object run in a known order.
          const calls = instance.calls.filter((call) => call.fn === instance.fn);
          // Passing the current row to a helper inside `while (gr.next())` reads it; it does not re-query.
          const escapes = instance.escapes.filter((identifier) => !enclosingNextLoop(instance, identifier));
          const readers = calls.filter((call) => READERS.has(call.method));

          const next = calls.find((call) => NEXT_METHODS.has(call.method));
          if (
            next &&
            !readers.some((call) => call.node.start < next.node.start) &&
            !escapes.some((identifier) => identifier.start < next.node.start) &&
            // In a loop, a query() later in the body runs before the next iteration's next().
            !readers.some((call) => contains(enclosingLoop(next.node) ?? next.node, call.node))
          ) {
            context.report({
              node: next.node,
              confidence: 0.85,
              message: `${instance.name}.${next.method}() is called before ${instance.name}.query().`,
              explanation: `A GlideRecord has no rows until query() runs, so ${next.method}() returns false and the code that depends on it never executes.`,
              recommendation: `Call ${instance.name}.query() after adding conditions and before ${next.method}().`
            });
          }

          const consumers = calls.filter((call) => CONSUMER_METHODS.has(call.method));
          if (consumers.length === 0) {
            continue;
          }
          const last = consumers[consumers.length - 1];
          const late = calls.find(
            (call) =>
              MODIFIERS.has(call.method) &&
              call.node.start > last.node.end &&
              !escapes.some((identifier) => identifier.start > call.node.start) &&
              !consumers.some((consumer) => {
                const loop = enclosingLoop(call.node);
                return loop && contains(loop, consumer.node);
              })
          );
          if (late) {
            context.report({
              node: late.node,
              severity: 'warning',
              confidence: 0.85,
              message: `${instance.name}.${late.method}() comes after the last ${last.method}() (line ${last.node.loc.start.line}) and has no effect.`,
              explanation: `Conditions, limits, and ordering apply only to the next query(). Added afterwards, they change nothing, so the query that did run was less restricted than the code suggests.`,
              recommendation: `Move ${late.method}() above ${instance.name}.${last.method}(), or call query() again if a second query was intended.`
            });
          }
        }
      }
    };
  }
};
