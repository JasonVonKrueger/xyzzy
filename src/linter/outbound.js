import { getMemberChain, getPropertyName } from './ast.js';
import { trackInstances } from './glide-record.js';
import { scopeOf } from './scope.js';

// Outbound web-service data flow: each `new sn_ws.RESTMessageV2(...)` / SOAPMessageV2 bound to a
// variable (tracked like GlideRecord), and the responses its execute()/executeAsync() calls return.

export const EXECUTE_METHODS = new Set(['execute', 'executeAsync']);
export const STATUS_CHECKS = new Set(['getStatusCode', 'haveError', 'getErrorCode', 'getErrorMessage']);

export function outboundClass(newExpression) {
  const name = getMemberChain(newExpression.callee)?.replace(/^(sn_ws|global)\./, '');
  return name === 'RESTMessageV2' || name === 'SOAPMessageV2' ? name : null;
}

// The response of an execute call: the variable it is stored in and the calls made on it. A chained
// `r.execute().getBody()` has no variable; its single call is recorded directly.
function responseOf(executeCall, scopes) {
  const parent = executeCall.parent;
  const response = { execute: executeCall, name: null, calls: [], escapes: false };

  if (parent.type === 'MemberExpression' && parent.object === executeCall && parent.parent.type === 'CallExpression') {
    response.calls.push({ method: getPropertyName(parent), node: parent.parent });
    return response;
  }

  let identifier = null;
  if (parent.type === 'VariableDeclarator' && parent.init === executeCall && parent.id.type === 'Identifier') {
    identifier = parent.id;
  } else if (parent.type === 'AssignmentExpression' && parent.right === executeCall && parent.left.type === 'Identifier') {
    identifier = parent.left;
  } else {
    // Returned, passed on, or discarded: whoever receives it handles it.
    response.escapes = parent.type !== 'ExpressionStatement';
    return response;
  }

  response.name = identifier.name;
  const variable = scopeOf(scopes, parent).resolve(identifier.name);
  for (const reference of variable?.references ?? []) {
    const use = reference.identifier.parent;
    if (reference.identifier.start < executeCall.start) {
      continue;
    }
    if (use.type === 'MemberExpression' && use.object === reference.identifier) {
      if (use.parent.type === 'CallExpression' && use.parent.callee === use) {
        response.calls.push({ method: getPropertyName(use), node: use.parent });
      }
    } else if (!(use.type === 'AssignmentExpression' && use.left === reference.identifier)) {
      response.escapes = true;
    }
  }
  response.calls.sort((a, b) => a.node.start - b.node.start);
  return response;
}

// Returns { instances, byNode, responses }.
export function analyzeOutbound(ast, scopes) {
  const tracked = trackInstances(ast, scopes, (node) => {
    const className = outboundClass(node);
    return className ? { className } : null;
  });
  const responses = [];
  for (const instance of tracked.instances) {
    for (const call of instance.calls) {
      if (EXECUTE_METHODS.has(call.method)) {
        responses.push({ ...responseOf(call.node, scopes), instance, method: call.method });
      }
    }
  }
  return { ...tracked, responses };
}
