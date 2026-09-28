import { aBusinessRule, currentMethod } from './br-helpers.js';

export default {
  id: 'SN-BR-008',
  name: 'setAbortAction() outside a before Business Rule',
  category: 'servicenow',
  severity: 'error',
  description: 'current.setAbortAction(true) only works in before Business Rules; after, async, and display rules run too late (needs record.when).',
  contexts: ['business_rule'],
  fixable: false,

  create(context) {
    return {
      CallExpression(node) {
        const { when } = context.execution.record;
        if (!when || when === 'before' || currentMethod(node, context.scopes) !== 'setAbortAction') {
          return;
        }
        context.report({
          node,
          confidence: 0.95,
          message: `current.setAbortAction() in ${aBusinessRule(when)} cannot stop the operation.`,
          explanation:
            when === 'display'
              ? 'A display Business Rule runs when the form loads; there is no database operation to abort.'
              : `${aBusinessRule(when).replace(/^a/, 'A')} runs after the record has already been written, so there is nothing left to abort. The save goes through, and any error message shown says otherwise.`,
          recommendation: 'Move the validation and setAbortAction(true) to a before Business Rule (with gs.addErrorMessage() explaining why the save was refused).'
        });
      }
    };
  }
};
