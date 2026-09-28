const NON_CHILD_KEYS = new Set(['parent', 'loc', 'start', 'end', 'range']);

function isNode(value) {
  return value !== null && typeof value === 'object' && typeof value.type === 'string';
}

export function childNodes(node) {
  const children = [];

  for (const key of Object.keys(node)) {
    if (NON_CHILD_KEYS.has(key)) {
      continue;
    }

    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) {
          children.push(item);
        }
      }
    } else if (isNode(value)) {
      children.push(value);
    }
  }

  return children;
}

// Depth-first traversal that sets `node.parent`. Iterative so that very deep trees (long string
// concatenations are common in ServiceNow scripts) cannot overflow the call stack.
export function traverse(root, { enter, leave } = {}) {
  const stack = [{ node: root, parent: null, exiting: false }];

  while (stack.length > 0) {
    const frame = stack.pop();

    if (frame.exiting) {
      leave?.(frame.node);
      continue;
    }

    const { node } = frame;
    node.parent = frame.parent;
    enter?.(node);
    stack.push({ node, exiting: true });

    const children = childNodes(node);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ node: children[index], parent: node, exiting: false });
    }
  }
}

// Visits `root` and its descendants in source order without touching parent pointers, so rules can
// search subtrees during the main traversal. Return false from `visit` to skip a node's children.
export function walk(root, visit) {
  const stack = [root];

  while (stack.length > 0) {
    const node = stack.pop();
    if (visit(node) === false) {
      continue;
    }
    const children = childNodes(node);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }
}

// "gs.info", "sn_ws.RESTMessageV2", "this.helper.run" — or null when the chain contains anything other
// than identifiers, `this`, and non-computed or string-literal property access.
export function getMemberChain(node) {
  if (node.type === 'Identifier') {
    return node.name;
  }

  if (node.type === 'ThisExpression') {
    return 'this';
  }

  if (node.type === 'MemberExpression') {
    const object = getMemberChain(node.object);
    const property = getPropertyName(node);
    return object !== null && property !== null ? `${object}.${property}` : null;
  }

  return null;
}

export function getPropertyName(memberExpression) {
  const { property, computed } = memberExpression;

  if (!computed && property.type === 'Identifier') {
    return property.name;
  }

  if (computed && isStringLiteral(property)) {
    return property.value;
  }

  return null;
}

export function getCalleeName(callOrNew) {
  return getMemberChain(callOrNew.callee);
}

export function isStringLiteral(node) {
  return (
    (node?.type === 'Literal' && typeof node.value === 'string') ||
    (node?.type === 'TemplateLiteral' && node.expressions.length === 0)
  );
}

export function isFunctionNode(node) {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  );
}

// Best-effort display name: declarations, `var x = function`, `{ name: function }` (Script Include
// methods), and `Obj.prototype.name = function`.
export function getFunctionName(node) {
  if (node.id?.name) {
    return node.id.name;
  }

  const parent = node.parent;
  if (!parent) {
    return '(anonymous)';
  }

  if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
    return parent.id.name;
  }

  if ((parent.type === 'Property' || parent.type === 'MethodDefinition') && parent.value === node) {
    if (!parent.computed && parent.key.type === 'Identifier') {
      return parent.key.name;
    }
    if (isStringLiteral(parent.key)) {
      return parent.key.value;
    }
  }

  if (parent.type === 'AssignmentExpression' && parent.right === node) {
    const chain = getMemberChain(parent.left);
    if (chain) {
      return chain.split('.').pop();
    }
  }

  return '(anonymous)';
}

// True when an Identifier is a read or write of a variable, as opposed to a property name, object key,
// label, or declaration.
export function isReference(identifier) {
  const parent = identifier.parent;
  if (!parent) {
    return true;
  }

  switch (parent.type) {
    case 'MemberExpression':
      return parent.object === identifier || parent.computed;
    case 'Property':
    case 'PropertyDefinition':
    case 'MethodDefinition':
      return parent.value === identifier || (parent.computed && parent.key === identifier);
    case 'VariableDeclarator':
      return parent.init === identifier;
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return parent.body === identifier;
    case 'ClassDeclaration':
    case 'ClassExpression':
      return parent.superClass === identifier;
    case 'AssignmentPattern':
      return parent.right === identifier;
    case 'CatchClause':
    case 'ImportSpecifier':
    case 'ImportDefaultSpecifier':
    case 'ImportNamespaceSpecifier':
    case 'ExportSpecifier':
    case 'LabeledStatement':
    case 'BreakStatement':
    case 'ContinueStatement':
    case 'MetaProperty':
      return false;
    default:
      return true;
  }
}

// `typeof gs`, used to guard code that runs on both client and server.
export function isTypeofOperand(identifier) {
  return identifier.parent?.type === 'UnaryExpression' && identifier.parent.operator === 'typeof';
}

// Structural fingerprint that ignores positions and raw literal text, used to prove that an automatic
// fix did not change what the code does.
export function astFingerprint(ast) {
  return JSON.stringify(ast, (key, value) => {
    if (NON_CHILD_KEYS.has(key) || key === 'raw') {
      return undefined;
    }
    return typeof value === 'bigint' ? `${value}n` : value;
  });
}
