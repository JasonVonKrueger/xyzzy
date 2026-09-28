import { isReference, walk } from '../ast.js';
import { callsBefore, callsNamed, contains, QUERY_METHODS, WRITE_METHODS } from '../glide-record.js';
import { scopeOf } from '../scope.js';
import { GR_CONTEXTS } from './gr-helpers.js';

const SHAPING_METHODS = new Set([
  'addQuery',
  'addEncodedQuery',
  'addActiveQuery',
  'addInactiveQuery',
  'addNullQuery',
  'addNotNullQuery',
  'addJoinQuery',
  'setLimit',
  'chooseWindow',
  'orderBy',
  'orderByDesc',
  'addAggregate',
  'groupBy'
]);

// True when `a` and `b` sit in different branches of the same if/else, ternary, or switch.
function mutuallyExclusive(a, b) {
  let ancestor = a.parent;
  while (ancestor && !contains(ancestor, b)) {
    ancestor = ancestor.parent;
  }
  if (!ancestor) {
    return false;
  }
  if (ancestor.type === 'IfStatement' || ancestor.type === 'ConditionalExpression') {
    const inConsequent = (node) => contains(ancestor.consequent, node);
    return ancestor.alternate !== null && inConsequent(a) !== inConsequent(b);
  }
  return ancestor.type === 'SwitchStatement';
}

export default {
  id: 'SN-GR-006',
  name: 'Repeated identical query',
  category: 'performance',
  severity: 'warning',
  description: 'The same GlideRecord query (table and conditions) runs twice in one function with no write to that table in between.',
  ...GR_CONTEXTS,
  fixable: false,

  create(context) {
    const text = (node) => context.sourceCode.getText(node).replace(/\s+/g, ' ');

    function fingerprint(instance, query) {
      const shaping = callsBefore(instance, query.node, SHAPING_METHODS)
        .map((call) => `${call.method}(${call.args.map(text).join(',')})`)
        .join('.');
      return `${instance.className}:${instance.table}:${shaping}`;
    }

    // Variables used in the conditions of the first query that are reassigned before the second.
    function argumentsChangeBetween(instance, first, second) {
      let changed = false;
      for (const call of callsBefore(instance, first.node, SHAPING_METHODS)) {
        for (const arg of call.args) {
          walk(arg, (node) => {
            if (node.type !== 'Identifier' || !isReference(node)) {
              return;
            }
            const variable = scopeOf(context.scopes, node).resolve(node.name);
            const writes = variable?.references.filter((ref) => ref.isWrite) ?? [];
            if (writes.some((ref) => ref.identifier.start > first.node.end && ref.identifier.start < second.node.start)) {
              changed = true;
            }
          });
        }
      }
      return changed;
    }

    return {
      'Program:exit'() {
        const { instances } = context.glideRecords;
        const seen = new Map();

        for (const instance of instances) {
          const query = callsNamed(instance, QUERY_METHODS)[0];
          if (!query || !instance.table || !instance.tracked) {
            continue;
          }
          const key = `${fingerprint(instance, query)}@${query.fn.start}`;
          const earlier = seen.get(key);
          if (!earlier) {
            seen.set(key, { instance, query });
            continue;
          }

          const writesBetween = instances.some(
            (other) =>
              other.table === instance.table &&
              other.calls.some(
                (call) => WRITE_METHODS.has(call.method) && call.node.start > earlier.query.node.end && call.node.start < query.node.start
              )
          );
          if (
            writesBetween ||
            mutuallyExclusive(earlier.query.node, query.node) ||
            argumentsChangeBetween(earlier.instance, earlier.query, query)
          ) {
            seen.set(key, { instance, query });
            continue;
          }

          context.report({
            node: query.node,
            confidence: 0.8,
            message: `The same query on '${instance.table}' already ran on line ${earlier.query.node.loc.start.line}.`,
            explanation: 'Both GlideRecords use the same table and conditions, and nothing writes to that table in between, so the second query returns the same rows at the cost of another database round trip.',
            recommendation: `Reuse the result of the first query (store the values you need, or keep the GlideRecord), or move the lookup into a helper that caches it.`
          });
        }
      }
    };
  }
};
