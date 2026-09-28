import { getCalleeName, getMemberChain, isStringLiteral } from '../ast.js';

function keyName(property) {
  if (property.type !== 'Property' || property.computed) {
    return null;
  }
  if (property.key.type === 'Identifier') {
    return property.key.name;
  }
  if (isStringLiteral(property.key) || (property.key.type === 'Literal' && typeof property.key.value === 'number')) {
    return String(property.key.value);
  }
  return null;
}

// `Foo.prototype = { ... }` or `Object.extendsObject(Base, { ... })`
function isScriptIncludePrototype(object) {
  const parent = object.parent;
  if (parent?.type === 'AssignmentExpression' && parent.right === object) {
    return /\.prototype$/.test(getMemberChain(parent.left) ?? '');
  }
  return parent?.type === 'CallExpression' && getCalleeName(parent) === 'Object.extendsObject';
}

export default {
  id: 'JS-DUP-002',
  name: 'Duplicate object key',
  category: 'correctness',
  severity: 'error',
  description: 'An object literal defines the same key twice; the earlier value is silently discarded.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    return {
      ObjectExpression(node) {
        const seen = new Map();

        for (const property of node.properties) {
          const name = keyName(property);
          if (name === null) {
            continue;
          }
          // A getter and a setter for the same key are a pair, not a duplicate.
          const slot = property.kind === 'init' ? 'value' : property.kind;
          const previous = seen.get(name);

          if (previous && (previous.slot === 'value' || slot === 'value' || previous.slot === slot)) {
            const isMethod = isScriptIncludePrototype(node);
            context.report({
              node: property.key,
              message: isMethod
                ? `Script Include method '${name}' is defined twice; the definition on line ${previous.line} is never used.`
                : `Duplicate key '${name}'; the value on line ${previous.line} is silently overwritten.`,
              explanation: isMethod
                ? 'Only the last definition of a method in a prototype object survives. Callers get this version, and any fix made to the earlier copy has no effect.'
                : 'JavaScript keeps only the last value for a repeated key, so the earlier one is discarded without any error.',
              recommendation: 'Remove or rename one of the definitions.'
            });
          }

          seen.set(name, { slot, line: property.key.loc.start.line });
        }
      }
    };
  }
};
