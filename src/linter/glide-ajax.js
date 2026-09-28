import { getPropertyName } from './ast.js';
import { callsNamed, stringValue, trackInstances } from './glide-record.js';

// GlideAjax data flow: each `new GlideAjax('ScriptInclude')` bound to a variable, with its addParam()
// calls and requests, built on the same tracking as GlideRecord (glide-record.js).

// Calls that send the request. getXMLWait() is synchronous; the others take a callback.
export const REQUEST_METHODS = new Set(['getXML', 'getXMLAnswer', 'getXMLWait', 'getJSON']);

export function analyzeGlideAjax(ast, scopes) {
  return trackInstances(ast, scopes, (node) =>
    node.callee.type === 'Identifier' && node.callee.name === 'GlideAjax'
      ? { className: 'GlideAjax', processor: stringValue(node.arguments[0]) }
      : null
  );
}

export function requestsOf(instance) {
  return callsNamed(instance, REQUEST_METHODS);
}

// The literal name passed to addParam(name, value), or null.
export function paramName(call) {
  return stringValue(call.args[0]);
}

// `new GlideAjax('X').getXMLWait()` style chains are not bound to a variable; report those by walking
// the call directly.
export function chainedRequest(newExpression) {
  const member = newExpression.parent;
  if (member?.type === 'MemberExpression' && member.object === newExpression && member.parent.type === 'CallExpression') {
    const method = getPropertyName(member);
    return REQUEST_METHODS.has(method) ? { method, node: member.parent } : null;
  }
  return null;
}
