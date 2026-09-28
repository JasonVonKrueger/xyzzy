import { isTypeofOperand } from '../ast.js';
import { isPlatformObject } from './br-helpers.js';

// `if (previous)`, `previous && ...`, `previous ? ... : ...`, `previous != null`: the author handles null.
function isGuard(identifier) {
  const parent = identifier.parent;
  switch (parent.type) {
    case 'IfStatement':
    case 'ConditionalExpression':
    case 'WhileStatement':
      return parent.test === identifier;
    case 'LogicalExpression':
      return parent.left === identifier;
    case 'UnaryExpression':
      return parent.operator === '!' || parent.operator === 'typeof';
    case 'BinaryExpression':
      return ['==', '!=', '===', '!=='].includes(parent.operator);
    default:
      return false;
  }
}

export default {
  id: 'SN-BR-007',
  name: 'previous in an async Business Rule',
  category: 'servicenow',
  severity: 'error',
  description: 'previous is null in async Business Rules, so previous.field throws (needs record.when).',
  contexts: ['business_rule'],
  fixable: false,

  create(context) {
    return {
      'Program:exit'() {
        if (context.execution.record.when !== 'async') {
          return;
        }
        const uses = [];
        for (const scope of context.scopes.scopes) {
          const variable = scope.variables.get('previous');
          if (variable?.defs.every((def) => def.kind === 'param')) {
            uses.push(...variable.references.map((reference) => reference.identifier));
          }
        }
        uses.push(...(context.scopes.globalReferences.get('previous') ?? []).map((reference) => reference.identifier));

        const platformUses = uses.filter((identifier) => isPlatformObject(identifier, 'previous', context.scopes) && !isTypeofOperand(identifier));
        if (platformUses.some(isGuard)) {
          return;
        }
        const reads = platformUses
          .filter((identifier) => identifier.parent.type === 'MemberExpression' && identifier.parent.object === identifier)
          .sort((a, b) => a.start - b.start);
        if (reads.length === 0) {
          return;
        }
        context.report({
          node: reads[0],
          confidence: 0.9,
          message: `previous is null in an async Business Rule${reads.length > 1 ? ` (${reads.length} uses)` : ''}.`,
          explanation: 'Async Business Rules run later, in a scheduled job, and the platform does not keep the before-change copy of the record. previous is null there, so previous.field throws and the rest of the rule never runs.',
          recommendation: 'Compare old and new values in a before or after rule instead (current.state.changes(), previous.state), and pass what the async work needs through fields, or use gs.eventQueue with the values as parameters.'
        });
      }
    };
  }
};
