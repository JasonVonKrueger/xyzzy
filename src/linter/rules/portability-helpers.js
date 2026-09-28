// Shared helpers for the portability rules (PORT-*).

export const SYS_ID = /^[0-9a-f]{32}$/;
export const INSTANCE_HOST = /\b[a-z0-9-]+\.(service-now|servicenowservices)\.com\b/i;

// The constant string value of a literal or a template without expressions, else null.
export function literalString(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked ?? null;
  }
  return null;
}

// The leading constant text of a string expression: 'https://api.x.com/' + id → 'https://api.x.com/'.
export function leadingText(node) {
  if (node?.type === 'BinaryExpression' && node.operator === '+') {
    return leadingText(node.left);
  }
  if (node?.type === 'TemplateLiteral') {
    return node.quasis[0].value.cooked ?? null;
  }
  return literalString(node);
}
