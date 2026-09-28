import { callsNamed, WRITE_METHODS } from '../glide-record.js';
import { GR_CONTEXTS } from './gr-helpers.js';
import { currentMethod, hasNearbyComment, isFalseLiteral } from './br-helpers.js';

const EFFECTS =
  'setWorkflow(false) turns off every Business Rule for that write, and with them the events, notifications, workflows, and flows they would start, plus any integrations or SLA and approval logic built on them.';

export default {
  id: 'SN-BR-003',
  name: 'setWorkflow(false)',
  category: 'servicenow',
  severity: 'warning',
  description: 'setWorkflow(false) with no write after it (no effect), or without a comment explaining which engines it is meant to skip.',
  ...GR_CONTEXTS,
  fixable: false,

  create(context) {
    const onCurrent = [];

    function report(node, owner, hasWrite) {
      if (!hasWrite) {
        context.report({
          node,
          confidence: 0.85,
          message: `${owner}.setWorkflow(false) has no effect: no insert(), update(), or delete follows on ${owner}.`,
          explanation: 'setWorkflow() only affects later writes made through the same GlideRecord object. Nothing is written after it, so it changes nothing, and the code may not do what its author expected.',
          recommendation: `Call setWorkflow(false) on the GlideRecord you write with, before its update(), insert(), or delete call, or remove it.`
        });
      } else if (!hasNearbyComment(context.sourceCode, node)) {
        context.report({
          node,
          severity: 'info',
          confidence: 0.8,
          message: `${owner}.setWorkflow(false) skips all Business Rules and notifications for this write; add a comment explaining why.`,
          explanation: `${EFFECTS} That is sometimes exactly right (bulk data fixes) and sometimes a hidden bug (an SLA or audit trail that silently stops updating).`,
          recommendation: 'Keep it only if no rule, notification, or workflow should react to this write, and say so in a comment on the line above. To keep sys_updated_on/by unchanged, autoSysFields(false) is the separate switch.'
        });
      }
    }

    return {
      CallExpression(node) {
        if (currentMethod(node, context.scopes) === 'setWorkflow' && isFalseLiteral(node.arguments[0])) {
          onCurrent.push(node);
        }
      },
      'Program:exit'() {
        for (const instance of context.glideRecords.instances) {
          for (const call of callsNamed(instance, new Set(['setWorkflow']))) {
            if (!isFalseLiteral(call.args[0])) {
              continue;
            }
            const writesAfter = instance.calls.some((other) => WRITE_METHODS.has(other.method) && other.node.start > call.node.start);
            const escapesAfter = instance.escapes.some((identifier) => identifier.start > call.node.start);
            report(call.node, instance.name, writesAfter || escapesAfter);
          }
        }
        // On current, the platform's own save counts as the write, so only the comment check applies.
        for (const node of onCurrent) {
          report(node, 'current', true);
        }
      }
    };
  }
};
