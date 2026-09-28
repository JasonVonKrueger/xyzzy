import { getPropertyName } from '../ast.js';
import { scopeOf } from '../scope.js';

// Shared helpers for the Business Rule rules (SN-BR-*).

// `name` refers to the platform-provided object (current, previous): either not declared in the file,
// or a parameter, as in `function executeRule(current, previous)`.
export function isPlatformObject(identifier, name, scopes) {
  if (identifier?.type !== 'Identifier' || identifier.name !== name) {
    return false;
  }
  const variable = scopeOf(scopes, identifier).resolve(name);
  return !variable || variable.defs.every((def) => def.kind === 'param');
}

// `current.<method>(...)` → method name, else null.
export function currentMethod(call, scopes) {
  const { callee } = call;
  if (callee.type !== 'MemberExpression' || !isPlatformObject(callee.object, 'current', scopes)) {
    return null;
  }
  return getPropertyName(callee);
}

export function isFalseLiteral(node) {
  return node?.type === 'Literal' && node.value === false;
}

// A comment on the same line as `node` or on the line directly above it.
export function hasNearbyComment(sourceCode, node) {
  const line = node.loc.start.line;
  return sourceCode.comments.some((comment) => comment.loc.end.line === line - 1 || comment.loc.start.line === line);
}

// "an after Business Rule", "a before Business Rule", or "a Business Rule" when the timing is unknown.
export function aBusinessRule(when) {
  if (!when) {
    return 'a Business Rule';
  }
  return `${/^[aeiou]/.test(when) ? 'an' : 'a'} ${when} Business Rule`;
}
