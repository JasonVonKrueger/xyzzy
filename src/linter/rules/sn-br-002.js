import { callsBefore, callsNamed, GET_METHODS } from '../glide-record.js';
import { isFalseLiteral } from './br-helpers.js';

const SAME_RECORD_WRITES = new Set(['update', 'deleteRecord']);
const TABLE_WRITES = new Set(['insert', 'update', 'updateMultiple']);
const CURRENT_ID = /^current\.(sys_id(\.toString\(\))?|getUniqueValue\(\)|getValue\(\s*['"]sys_id['"]\s*\))$/;

function isCurrentId(node, sourceCode) {
  return Boolean(node) && CURRENT_ID.test(sourceCode.getText(node).replace(/\s+/g, ''));
}

// get(current.sys_id), get('sys_id', current.sys_id), or addQuery('sys_id', current.sys_id).
function loadsCurrentRecord(instance, sourceCode) {
  return instance.calls.some((call) => {
    const [first, second] = call.args;
    if (GET_METHODS.has(call.method)) {
      return call.args.length === 1 ? isCurrentId(first, sourceCode) : isCurrentId(second, sourceCode);
    }
    return call.method === 'addQuery' && call.args.length === 2 && sourceCode.getText(first).slice(1, -1) === 'sys_id' && isCurrentId(second, sourceCode);
  });
}

function disabledBefore(instance, node) {
  return callsBefore(instance, node, new Set(['setWorkflow'])).some((call) => isFalseLiteral(call.args[0]));
}

export default {
  id: 'SN-BR-002',
  name: 'Business Rule writes back to its own record or table',
  category: 'servicenow',
  severity: 'error',
  description: 'A GlideRecord loads the record being processed (current.sys_id) and updates it — a hidden current.update() — or writes to the Business Rule\'s own table.',
  contexts: ['business_rule'],
  fixable: false,

  create(context) {
    const { sourceCode } = context;

    return {
      'Program:exit'() {
        const { table } = context.execution.record;

        for (const instance of context.glideRecords.instances) {
          if (loadsCurrentRecord(instance, sourceCode)) {
            const write = callsNamed(instance, SAME_RECORD_WRITES)[0];
            if (write) {
              const disabled = disabledBefore(instance, write.node);
              context.report({
                node: write.node,
                confidence: disabled ? 0.6 : 0.85,
                message: `${instance.name}.${write.method}() writes the record this Business Rule is processing (loaded by current.sys_id).`,
                explanation:
                  write.method === 'update'
                    ? 'This is current.update() in disguise: the record is saved again, the Business Rules run again, and a before rule\'s pending changes to current can overwrite (or be overwritten by) this update.'
                    : 'Deleting the record while its own Business Rule is running leaves the rest of the transaction working on a record that no longer exists.',
                recommendation: 'Change fields on current directly in a before Business Rule instead of loading the same record again. Use current.setAbortAction(true) to cancel an operation.'
              });
              continue;
            }
          }

          if (table && instance.table === table) {
            const write = callsNamed(instance, TABLE_WRITES).find((call) => !disabledBefore(instance, call.node));
            if (write) {
              context.report({
                node: write.node,
                severity: 'warning',
                confidence: 0.6,
                message: `${instance.name}.${write.method}() writes to '${table}', the table this Business Rule runs on.`,
                explanation: `Writing to '${table}' runs the Business Rules on '${table}' again, possibly including this one. Unless its condition excludes these records, the rule can trigger itself in a chain.`,
                recommendation: 'Make sure the Business Rule condition excludes the records written here, or call setWorkflow(false) on this GlideRecord if no rules should run for this write.'
              });
            }
          }
        }
      }
    };
  }
};
