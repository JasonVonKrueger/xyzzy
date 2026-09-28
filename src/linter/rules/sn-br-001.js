import { runsWhenever } from '../glide-record.js';
import { aBusinessRule, currentMethod, isFalseLiteral } from './br-helpers.js';

const WRITES = new Set(['update', 'insert']);

function explain(method, when) {
  if (method === 'insert') {
    return 'current.insert() in a Business Rule saves the record being processed as a new record: a duplicate, which then runs the insert Business Rules again.';
  }
  switch (when) {
    case 'before':
      return 'Changes made to current in a before Business Rule are saved automatically when the rule finishes. current.update() writes the record an extra time and runs every Business Rule on the table again, including this one.';
    case 'display':
      return 'A display Business Rule runs every time the form loads. current.update() turns every form view into a database write and runs the update Business Rules each time.';
    default:
      return 'current.update() saves the record again, which runs every Business Rule on the table again, including this one. The platform stops the loop only after several levels of recursion, having written the record repeatedly and fired duplicate events and notifications.';
  }
}

export default {
  id: 'SN-BR-001',
  name: 'current.update() in a Business Rule',
  category: 'servicenow',
  severity: 'error',
  description: 'current.update() or current.insert() inside a Business Rule saves the record again and re-runs the Business Rules (recursion).',
  contexts: ['business_rule'],
  fixable: false,

  create(context) {
    const disables = [];
    const writes = [];

    return {
      CallExpression(node) {
        const method = currentMethod(node, context.scopes);
        if (method === 'setWorkflow' && isFalseLiteral(node.arguments[0])) {
          disables.push(node);
        } else if (WRITES.has(method)) {
          writes.push({ node, method });
        }
      },
      'Program:exit'() {
        const { when } = context.execution.record;
        for (const { node, method } of writes) {
          const guarded = method === 'update' && disables.some((disable) => disable.start < node.start && runsWhenever(disable, node));
          context.report({
            node,
            confidence: guarded ? 0.6 : 0.95,
            message: guarded
              ? `current.update() in ${aBusinessRule(when)} after current.setWorkflow(false): the record is still saved twice.`
              : `current.${method}() in ${aBusinessRule(when)}.`,
            explanation: guarded
              ? 'setWorkflow(false) prevents the recursion, but the record is still written twice, and the second write skips every other Business Rule, workflow, and notification that should see the change.'
              : explain(method, when),
            recommendation:
              when === 'before'
                ? 'Remove current.update(); set fields on current and let the platform save them.'
                : 'Make the change in a before Business Rule (set the field on current, no update() call). If this must run after the save, update a different record, or use an async rule or event with a separate GlideRecord.'
          });
        }
      }
    };
  }
};
