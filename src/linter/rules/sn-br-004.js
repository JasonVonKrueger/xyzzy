import { getMemberChain, getPropertyName } from '../ast.js';
import { scopeOf } from '../scope.js';
import { aBusinessRule } from './br-helpers.js';

// Outbound HTTP clients and the calls on them that wait for the remote system.
const CLIENTS = new Map([
  ['RESTMessageV2', new Set(['execute'])],
  ['SOAPMessageV2', new Set(['execute'])],
  ['GlideHTTPRequest', new Set(['get', 'post', 'put', 'del'])]
]);

function clientClass(newExpression) {
  const chain = getMemberChain(newExpression.callee);
  const name = chain?.replace(/^(sn_ws|global)\./, '');
  return CLIENTS.has(name) ? name : null;
}

function boundVariable(newExpression, scopes) {
  const parent = newExpression.parent;
  let identifier = null;
  if (parent.type === 'VariableDeclarator' && parent.init === newExpression && parent.id.type === 'Identifier') {
    identifier = parent.id;
  } else if (parent.type === 'AssignmentExpression' && parent.right === newExpression && parent.left.type === 'Identifier') {
    identifier = parent.left;
  }
  return identifier ? scopeOf(scopes, parent).resolve(identifier.name) : null;
}

export default {
  id: 'SN-BR-004',
  name: 'Synchronous outbound call in a Business Rule',
  category: 'performance',
  severity: 'warning',
  description: 'RESTMessageV2/SOAPMessageV2 execute(), GlideHTTPRequest, or waitForResponse() in a Business Rule makes the user wait for another system.',
  contexts: ['business_rule'],
  fixable: false,

  create(context) {
    const calls = [];

    function add(node, className, method) {
      calls.push({ node, what: `${className}.${method}()` });
    }

    return {
      NewExpression(node) {
        const className = clientClass(node);
        if (!className) {
          return;
        }
        const waits = CLIENTS.get(className);
        // new sn_ws.RESTMessageV2(...).execute()
        const member = node.parent;
        if (member.type === 'MemberExpression' && member.object === node && member.parent.type === 'CallExpression' && waits.has(getPropertyName(member))) {
          add(member.parent, className, getPropertyName(member));
        }
        const variable = boundVariable(node, context.scopes);
        for (const reference of variable?.references ?? []) {
          const use = reference.identifier.parent;
          if (use.type === 'MemberExpression' && use.object === reference.identifier && use.parent.type === 'CallExpression' && use.parent.callee === use && waits.has(getPropertyName(use))) {
            add(use.parent, className, getPropertyName(use));
          }
        }
      },
      CallExpression(node) {
        if (node.callee.type === 'MemberExpression' && getPropertyName(node.callee) === 'waitForResponse') {
          calls.push({ node, what: 'waitForResponse()' });
        }
      },
      'Program:exit'() {
        const { when } = context.execution.record;
        if (when === 'async') {
          return;
        }
        for (const { node, what } of calls) {
          context.report({
            node,
            confidence: when ? 0.9 : 0.75,
            message: `${what} waits for a remote system inside ${aBusinessRule(when)}.`,
            explanation: 'The user\'s save (or form load) is blocked until the other system answers or the call times out, which can take seconds to minutes. A slow or unavailable endpoint then makes the form hang, and a before rule holds the database transaction open the whole time.',
            recommendation: 'Move the call to an async Business Rule, or fire an event (gs.eventQueue) handled by a Script Action or Flow. If the call must stay, use executeAsync() without waitForResponse() and set a short timeout.'
          });
        }
      }
    };
  }
};
