import { getPropertyName, isFunctionNode, walk } from '../ast.js';
import { scopeOf } from '../scope.js';

// Shared helpers for the client-side rules (SN-CLIENT-*, SN-AJAX-*).

// Client rules that also apply to UI Actions: the APIs they look for (GlideAjax, g_form, the DOM) only
// exist in the client half of a UI Action, so the server half cannot trigger them.
export const CLIENT_AND_UI_ACTION = ['client', 'ui_action'];

// Scripts that run in Service Portal (and Workspace), where synchronous calls and the DOM are not
// available at all rather than merely discouraged.
export function runsInPortal(execution) {
  return execution.type === 'catalog_client_script' || execution.type === 'portal_client';
}

// Severity for problems that break in Service Portal but only degrade the classic UI.
export function portalSeverity(execution) {
  return runsInPortal(execution) ? 'error' : 'warning';
}

// The platform global `name` (not a local variable of the same name).
export function isGlobal(identifier, name, scopes) {
  return identifier?.type === 'Identifier' && identifier.name === name && !scopeOf(scopes, identifier).resolve(name);
}

// `g_form.<method>(...)` → method name, else null.
export function gFormMethod(call, scopes) {
  const { callee } = call;
  if (callee.type !== 'MemberExpression' || !isGlobal(callee.object, 'g_form', scopes)) {
    return null;
  }
  return getPropertyName(callee);
}

// The callback function passed to an asynchronous call: an inline function, or an identifier naming a
// function declared in the file.
export function callbackOf(call, scopes) {
  for (const arg of call.arguments) {
    if (isFunctionNode(arg)) {
      return arg;
    }
    if (arg.type === 'Identifier') {
      const def = scopeOf(scopes, arg).resolve(arg.name)?.defs[0];
      if (def?.kind === 'function' || (def?.node?.type === 'VariableDeclarator' && def.node.init && isFunctionNode(def.node.init))) {
        return def.kind === 'function' ? def.node : def.node.init;
      }
    }
  }
  return null;
}

// Top-level `function <name>(...)` declarations: the client script entry points.
export function entryPoint(program, name) {
  return program.body.find((statement) => statement.type === 'FunctionDeclaration' && statement.id?.name === name) ?? null;
}

// Nodes in `fn`'s own body (not in nested functions) for which `test` is true.
export function ownNodes(fn, test) {
  const found = [];
  walk(fn.body, (node) => {
    if (node !== fn.body && isFunctionNode(node)) {
      return false;
    }
    if (test(node)) {
      found.push(node);
    }
    return undefined;
  });
  return found;
}
