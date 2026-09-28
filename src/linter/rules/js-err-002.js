import { isFunctionNode, walk } from '../ast.js';
import { isLoggingCall } from '../known-globals.js';
import { isVariableUsed } from '../scope.js';

// Looks for a throw or a logging call directly in the catch body (not inside nested functions, which
// may never run).
function reportsFailure(body) {
  let found = false;
  walk(body, (node) => {
    if (found || isFunctionNode(node)) {
      return false;
    }
    if (node.type === 'ThrowStatement' || isLoggingCall(node)) {
      found = true;
    }
    return true;
  });
  return found;
}

// Non-empty catch blocks that neither use the error, rethrow, nor log. Empty blocks are JS-ERR-001.
export default {
  id: 'JS-ERR-002',
  name: 'Swallowed exception',
  category: 'error-handling',
  severity: 'warning',
  description: 'A catch block handles a failure without logging it, rethrowing it, or looking at the error.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    return {
      CatchClause(node) {
        if (node.body.body.length === 0) {
          return;
        }

        const scope = context.scopes.scopeByNode.get(node);
        const param = node.param?.type === 'Identifier' ? scope.variables.get(node.param.name) : null;
        if (node.param && (!param || isVariableUsed(param))) {
          return;
        }
        if (reportsFailure(node.body)) {
          return;
        }
        context.report({
          loc: { start: node.loc.start, end: node.body.loc.start },
          confidence: 0.8,
          message: 'Exception is caught and suppressed without being logged or rethrown.',
          explanation:
            'The catch block carries on (often returning a default value) without recording what went wrong. Callers cannot tell a real result from a failure, and nothing appears in the system log to diagnose it.',
          recommendation:
            "Log the error with context before recovering (gs.warn('<what failed>: ' + e.message, '<source>')), or rethrow it if the caller should handle it."
        });
      }
    };
  }
};
