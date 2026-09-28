import { isFunctionNode, isReference, traverse } from './ast.js';

// Scope analysis: which declarations exist in which scope, and which declaration (if any) each
// identifier reference resolves to. Resolution happens after the whole tree is walked, so hoisted `var`
// and function declarations resolve regardless of source order.
//
// Simplifications, all of which err toward fewer findings:
//   - function declarations inside blocks are hoisted to the enclosing function (sloppy-mode Annex B),
//   - the temporal dead zone of let/const is ignored,
//   - `with` statements and `eval` are not modelled.

const VAR_SCOPE_TYPES = new Set(['global', 'module', 'function']);
const PATTERN_TYPES = new Set(['ArrayPattern', 'ObjectPattern', 'RestElement']);

export class Scope {
  constructor(type, node, parent) {
    this.type = type;
    this.node = node;
    this.parent = parent;
    this.children = [];
    this.variables = new Map();
    this.variableScope = VAR_SCOPE_TYPES.has(type) ? this : parent.variableScope;
    parent?.children.push(this);
  }

  // variable: { name, scope, defs: [{ kind, identifier, node }], references: [...] }
  // kind: 'var' | 'let' | 'const' | 'function' | 'function-name' | 'class' | 'param' | 'catch' | 'import' | 'implicit'
  declare(name, kind, identifier = null, node = null) {
    let variable = this.variables.get(name);
    if (!variable) {
      variable = { name, scope: this, defs: [], references: [] };
      this.variables.set(name, variable);
    }
    variable.defs.push({ kind, identifier, node });
    return variable;
  }

  resolve(name) {
    for (let scope = this; scope; scope = scope.parent) {
      const variable = scope.variables.get(name);
      if (variable) {
        return variable;
      }
    }
    return null;
  }

  // The nearest enclosing function (or program) node.
  get functionNode() {
    return this.variableScope.node;
  }
}

export function patternIdentifiers(pattern, found = []) {
  if (!pattern) {
    return found;
  }

  switch (pattern.type) {
    case 'Identifier':
      found.push(pattern);
      break;
    case 'ObjectPattern':
      for (const property of pattern.properties) {
        patternIdentifiers(property.type === 'RestElement' ? property.argument : property.value, found);
      }
      break;
    case 'ArrayPattern':
      for (const element of pattern.elements) {
        patternIdentifiers(element, found);
      }
      break;
    case 'AssignmentPattern':
      patternIdentifiers(pattern.left, found);
      break;
    case 'RestElement':
      patternIdentifiers(pattern.argument, found);
      break;
    default:
      break;
  }

  return found;
}

// The value of an expression is thrown away: `count++;` or `total += 1;` as a statement.
function isDiscarded(expression) {
  const parent = expression.parent;
  return (
    parent.type === 'ExpressionStatement' ||
    (parent.type === 'ForStatement' && parent.update === expression) ||
    (parent.type === 'SequenceExpression' && parent.expressions[parent.expressions.length - 1] !== expression)
  );
}

// How a reference uses its variable. `selfUpdate` marks `x++` / `x += 1` whose result is discarded:
// that reads x only to write it back, so it does not count as a use.
function classifyReference(identifier) {
  let node = identifier;
  let parent = node.parent;

  while (
    PATTERN_TYPES.has(parent.type) ||
    (parent.type === 'Property' && parent.value === node && parent.parent?.type === 'ObjectPattern') ||
    (parent.type === 'AssignmentPattern' && parent.left === node)
  ) {
    node = parent;
    parent = parent.parent;
  }

  if (parent.type === 'AssignmentExpression' && parent.left === node) {
    return parent.operator === '='
      ? { isRead: false, isWrite: true, selfUpdate: false }
      : { isRead: true, isWrite: true, selfUpdate: isDiscarded(parent) };
  }
  if (parent.type === 'UpdateExpression') {
    return { isRead: true, isWrite: true, selfUpdate: isDiscarded(parent) };
  }
  if ((parent.type === 'ForInStatement' || parent.type === 'ForOfStatement') && parent.left === node) {
    return { isRead: false, isWrite: true, selfUpdate: false };
  }
  return { isRead: true, isWrite: false, selfUpdate: false };
}

function createsBlockScope(node) {
  switch (node.type) {
    case 'BlockStatement':
      // A function body shares the function's scope.
      return !isFunctionNode(node.parent) && node.parent.type !== 'CatchClause';
    case 'ForStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
    case 'SwitchStatement':
    case 'StaticBlock':
      return true;
    default:
      return false;
  }
}

export function analyzeScopes(ast) {
  const globalScope = new Scope(ast.sourceType === 'module' ? 'module' : 'global', ast, null);
  const scopes = [globalScope];
  const scopeByNode = new Map([[ast, globalScope]]);
  const declarationIdentifiers = new Set();
  const pending = [];
  let current = globalScope;

  function push(type, node) {
    current = new Scope(type, node, current);
    scopes.push(current);
    scopeByNode.set(node, current);
    return current;
  }

  function declarePattern(scope, pattern, kind, node) {
    for (const identifier of patternIdentifiers(pattern)) {
      declarationIdentifiers.add(identifier);
      scope.declare(identifier.name, kind, identifier, node);
    }
  }

  traverse(ast, {
    enter(node) {
      if (isFunctionNode(node)) {
        if (node.type === 'FunctionDeclaration' && node.id) {
          declarationIdentifiers.add(node.id);
          current.variableScope.declare(node.id.name, 'function', node.id, node);
        }
        const functionScope = push('function', node);
        if (node.type === 'FunctionExpression' && node.id) {
          declarationIdentifiers.add(node.id);
          functionScope.declare(node.id.name, 'function-name', node.id, node);
        }
        if (node.type !== 'ArrowFunctionExpression') {
          functionScope.declare('arguments', 'implicit');
        }
        for (const param of node.params) {
          declarePattern(functionScope, param, 'param', node);
        }
        return;
      }

      switch (node.type) {
        case 'CatchClause':
          push('catch', node);
          declarePattern(current, node.param, 'catch', node);
          return;
        case 'VariableDeclaration': {
          const target = node.kind === 'var' ? current.variableScope : current;
          for (const declarator of node.declarations) {
            declarePattern(target, declarator.id, node.kind, declarator);
          }
          return;
        }
        case 'ClassDeclaration':
          declarationIdentifiers.add(node.id);
          current.declare(node.id.name, 'class', node.id, node);
          return;
        case 'ClassExpression':
          if (node.id) {
            push('class', node);
            declarationIdentifiers.add(node.id);
            current.declare(node.id.name, 'class', node.id, node);
          }
          return;
        case 'ImportSpecifier':
        case 'ImportDefaultSpecifier':
        case 'ImportNamespaceSpecifier':
          declarationIdentifiers.add(node.local);
          globalScope.declare(node.local.name, 'import', node.local, node);
          return;
        case 'Identifier':
          if (!declarationIdentifiers.has(node) && isReference(node)) {
            pending.push({ identifier: node, from: current, ...classifyReference(node) });
          }
          return;
        default:
          if (createsBlockScope(node)) {
            push('block', node);
          }
      }
    },
    leave(node) {
      if (scopeByNode.get(node) === current && current !== globalScope) {
        current = current.parent;
      }
    }
  });

  const through = [];
  for (const reference of pending) {
    const variable = reference.from.resolve(reference.identifier.name);
    reference.variable = variable;
    if (variable) {
      variable.references.push(reference);
    } else {
      through.push(reference);
    }
  }

  // Unresolved references grouped by name: the globals this file relies on (gs, current, g_form...).
  const globalReferences = new Map();
  for (const reference of through) {
    const { name } = reference.identifier;
    if (!globalReferences.has(name)) {
      globalReferences.set(name, []);
    }
    globalReferences.get(name).push(reference);
  }

  return { globalScope, scopes, scopeByNode, globalReferences };
}

// True when a variable is read somewhere other than to update itself.
export function isVariableUsed(variable) {
  return variable.references.some((reference) => reference.isRead && !reference.selfUpdate);
}

// The innermost scope containing `node`.
export function scopeOf(scopes, node) {
  for (let current = node; current; current = current.parent) {
    const scope = scopes.scopeByNode.get(current);
    if (scope) {
      return scope;
    }
  }
  return scopes.globalScope;
}
