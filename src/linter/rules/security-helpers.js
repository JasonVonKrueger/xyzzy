import { getMemberChain, getPropertyName, isFunctionNode, walk } from '../ast.js';

// Shared helpers for the security rules (SEC-*).

// Calls that check the caller's roles or record-level ACLs.
const AUTH_METHODS = /^(hasRole\w*|hasRoleInGroup|can(Read|Write|Create|Delete)|hasRights|isMemberOf|checkAccess)$/;

export function isAuthorizationCheck(node) {
  if (node.type === 'NewExpression') {
    return getMemberChain(node.callee)?.endsWith('GlideRecordSecure') ?? false;
  }
  return node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && AUTH_METHODS.test(getPropertyName(node.callee) ?? '');
}

export function containsAuthorizationCheck(root) {
  let found = false;
  walk(root, (node) => {
    if (found) {
      return false;
    }
    found = isAuthorizationCheck(node);
    return undefined;
  });
  return found;
}

// `this.<name>(...)` calls in a subtree: helpers on the same Script Include.
export function thisMethodCalls(root) {
  const names = [];
  walk(root, (node) => {
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.object.type === 'ThisExpression') {
      const name = getPropertyName(node.callee);
      if (name) {
        names.push(name);
      }
    }
  });
  return names;
}

// The methods object of a client-callable Script Include:
// Object.extendsObject(AbstractAjaxProcessor, { ... }) (also global.AbstractAjaxProcessor).
export function clientCallableMethods(ast) {
  let methods = null;
  walk(ast, (node) => {
    if (methods) {
      return false;
    }
    if (
      node.type === 'CallExpression' &&
      getMemberChain(node.callee) === 'Object.extendsObject' &&
      getMemberChain(node.arguments[0] ?? node)?.endsWith('AbstractAjaxProcessor') &&
      node.arguments[1]?.type === 'ObjectExpression'
    ) {
      methods = node.arguments[1];
    }
    return undefined;
  });
  return methods;
}

// Map name → { property, fn } for function-valued properties of an object literal.
export function methodMap(objectExpression) {
  const map = new Map();
  for (const property of objectExpression?.properties ?? []) {
    if (property.type !== 'Property' || !isFunctionNode(property.value)) {
      continue;
    }
    const name = property.key.type === 'Identifier' ? property.key.name : property.key.value;
    if (typeof name === 'string') {
      map.set(name, { property, fn: property.value });
    }
  }
  return map;
}

// True when a method, or a this.helper() it calls (transitively, within `methods`), checks authorization.
export function methodChecksAuthorization(name, methods, seen = new Set()) {
  const method = methods.get(name);
  if (!method || seen.has(name)) {
    return false;
  }
  seen.add(name);
  return (
    containsAuthorizationCheck(method.fn.body) ||
    thisMethodCalls(method.fn.body).some((helper) => methodChecksAuthorization(helper, methods, seen))
  );
}

const DATA_CLASSES = /(^|\.)(GlideRecord|GlideAggregate|GlideQuery)$/;

// The first place in a subtree that reads or writes table data without ACL enforcement, or null.
export function findDataAccess(root) {
  let found = null;
  walk(root, (node) => {
    if (found) {
      return false;
    }
    if (node.type === 'NewExpression' && DATA_CLASSES.test(getMemberChain(node.callee) ?? '')) {
      found = node;
    } else if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && getPropertyName(node.callee) === 'getRefRecord') {
      found = node;
    }
    return undefined;
  });
  return found;
}

export function shannonEntropy(text) {
  const counts = new Map();
  for (const char of text) {
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / text.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// Never print a secret in full: findings end up in CI logs and SARIF uploads.
export function maskSecret(value) {
  return `${value.slice(0, 4)}… (${value.length} characters)`;
}
