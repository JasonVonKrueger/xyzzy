import { getPropertyName } from '../ast.js';
import { aBusinessRule, currentMethod, isPlatformObject } from './br-helpers.js';

const SETTERS = new Set(['setValue', 'setDisplayValue', 'setDateNumericValue']);

// `current.state = 3`, `current.setValue(...)`, or `current.assigned_to.setValue(...)`.
function currentChange(node, scopes) {
  if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && isPlatformObject(node.left.object, 'current', scopes)) {
    return `current.${getPropertyName(node.left) ?? '[field]'}`;
  }
  if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') {
    return null;
  }
  const method = currentMethod(node, scopes);
  if (SETTERS.has(method)) {
    return `current.${method}()`;
  }
  const field = node.callee.object;
  if (
    SETTERS.has(getPropertyName(node.callee)) &&
    field.type === 'MemberExpression' &&
    isPlatformObject(field.object, 'current', scopes)
  ) {
    return `current.${getPropertyName(field)}.${getPropertyName(node.callee)}()`;
  }
  return null;
}

export default {
  id: 'SN-BR-006',
  name: 'Changes to current after the save',
  category: 'servicenow',
  severity: 'warning',
  description: 'Fields set on current in an after or async Business Rule are never saved (needs record.when).',
  contexts: ['business_rule'],
  fixable: false,

  create(context) {
    const changes = [];
    let updatesCurrent = false;

    function check(node) {
      const change = currentChange(node, context.scopes);
      if (change) {
        changes.push({ node, change });
      }
    }

    return {
      AssignmentExpression: check,
      CallExpression(node) {
        if (currentMethod(node, context.scopes) === 'update') {
          updatesCurrent = true;
        }
        check(node);
      },
      'Program:exit'() {
        const { when } = context.execution.record;
        // With current.update() the changes are saved (SN-BR-001 reports that instead).
        if ((when !== 'after' && when !== 'async') || updatesCurrent || changes.length === 0) {
          return;
        }
        const [first] = changes;
        const more = changes.length > 1 ? ` (and ${changes.length - 1} more change${changes.length === 2 ? '' : 's'})` : '';
        context.report({
          node: first.node,
          confidence: 0.9,
          message: `${first.change} in ${aBusinessRule(when)} is never saved${more}.`,
          explanation: `${aBusinessRule(when).replace(/^a/, 'A')} runs after the record has been written to the database. Changing current there only changes the in-memory copy, so the value is lost (and other ${when} rules may see a value that is not in the database).`,
          recommendation: 'Move the field changes to a before Business Rule on the same table, where changes to current are saved automatically.'
        });
      }
    };
  }
};
