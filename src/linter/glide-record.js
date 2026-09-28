import { getMemberChain, getPropertyName, isFunctionNode, isStringLiteral, walk } from './ast.js';
import { scopeOf } from './scope.js';

// Object data flow, used for GlideRecord (and GlideAjax, see glide-ajax.js). Every `new GlideRecord(table)` (or GlideRecordSecure / GlideAggregate) that is
// bound to a variable becomes an *instance*: its table, the ordered method calls made on it, direct field
// writes (`gr.state = 7`), and the places where the object escapes (passed to a function, returned,
// stored elsewhere) and can no longer be followed.
//
// A reference belongs to the construction most recently assigned to its variable *in source order*.
// That is exact for straight-line code, the way almost every GlideRecord is used. Where it is not (loops,
// callbacks, escapes) the helpers below answer "unknown" or "weak" rather than guess, and rules lower
// their confidence or stay silent.

export const GLIDE_RECORD_CLASSES = new Set(['GlideRecord', 'GlideRecordSecure', 'GlideAggregate']);

export const FILTER_METHODS = new Set([
  'addQuery',
  'addEncodedQuery',
  'addActiveQuery',
  'addInactiveQuery',
  'addNullQuery',
  'addNotNullQuery',
  'addJoinQuery',
  'addDomainQuery'
]);
export const LIMIT_METHODS = new Set(['setLimit', 'chooseWindow']);
export const QUERY_METHODS = new Set(['query', '_query']);
export const GET_METHODS = new Set(['get', '_get']);
export const NEXT_METHODS = new Set(['next', '_next', 'hasNext']);
// Calls that read or write using the conditions built up so far.
export const CONSUMER_METHODS = new Set([...QUERY_METHODS, ...GET_METHODS, 'updateMultiple', 'deleteMultiple']);
export const WRITE_METHODS = new Set(['insert', 'update', 'updateMultiple', 'deleteRecord', 'deleteMultiple']);

const LOOP_TYPES = new Set(['WhileStatement', 'DoWhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement']);
// Array-style iteration callbacks: their body runs once per element.
const ITERATION_METHODS = new Set([
  'forEach',
  'map',
  'filter',
  'some',
  'every',
  'reduce',
  'reduceRight',
  'find',
  'findIndex',
  'flatMap',
  'each'
]);

export function glideRecordClass(newExpression) {
  const chain = getMemberChain(newExpression.callee);
  const name = chain?.startsWith('global.') ? chain.slice('global.'.length) : chain;
  return GLIDE_RECORD_CLASSES.has(name) ? name : null;
}

export function enclosingFunction(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (isFunctionNode(current) || current.type === 'Program') {
      return current;
    }
  }
  return null;
}

export function contains(outer, inner) {
  return outer.start <= inner.start && inner.end <= outer.end;
}

// The variable a construction is bound to: `var gr = new GlideRecord(...)` or `gr = new GlideRecord(...)`.
// Implicit globals are grouped by name.
function bindingOf(node, scopes) {
  const parent = node.parent;
  let identifier = null;

  if (parent.type === 'VariableDeclarator' && parent.init === node && parent.id.type === 'Identifier') {
    identifier = parent.id;
  } else if (
    parent.type === 'AssignmentExpression' &&
    parent.operator === '=' &&
    parent.right === node &&
    parent.left.type === 'Identifier'
  ) {
    identifier = parent.left;
  }
  if (!identifier) {
    return null;
  }

  const variable = scopeOf(scopes, parent).resolve(identifier.name);
  return {
    key: variable ?? `global:${identifier.name}`,
    name: identifier.name,
    variable,
    references: variable ? variable.references : scopes.globalReferences.get(identifier.name) ?? []
  };
}

// Every plain write to the variable, in source order, with the value written (null when unknown).
function writesOf(binding) {
  const writes = [];

  for (const def of binding.variable?.defs ?? []) {
    if (def.node?.type === 'VariableDeclarator' && def.node.init) {
      writes.push({ end: def.node.end, value: def.node.init });
    } else if (def.kind === 'param' || def.kind === 'catch') {
      writes.push({ end: def.identifier.end, value: null });
    }
  }

  for (const reference of binding.references) {
    if (!reference.isWrite) {
      continue;
    }
    const parent = reference.identifier.parent;
    const plain = parent.type === 'AssignmentExpression' && parent.operator === '=' && parent.left === reference.identifier;
    writes.push({ end: plain ? parent.end : reference.identifier.end, value: plain ? parent.right : null });
  }

  return writes.sort((a, b) => a.end - b.end);
}

function isEscape(identifier) {
  const parent = identifier.parent;
  switch (parent.type) {
    case 'CallExpression':
    case 'NewExpression':
      return parent.arguments.includes(identifier);
    case 'ReturnStatement':
    case 'ArrayExpression':
    case 'SpreadElement':
    case 'YieldExpression':
    case 'ConditionalExpression':
      return true;
    case 'VariableDeclarator':
      return parent.init === identifier;
    case 'AssignmentExpression':
      return parent.right === identifier;
    case 'Property':
      return parent.value === identifier;
    case 'ArrowFunctionExpression':
      return parent.body === identifier;
    default:
      return false;
  }
}

function recordUse(instance, identifier) {
  const parent = identifier.parent;

  if (parent.type === 'MemberExpression' && parent.object === identifier) {
    const grandparent = parent.parent;
    const name = getPropertyName(parent);
    if (grandparent.type === 'CallExpression' && grandparent.callee === parent) {
      if (name) {
        instance.calls.push({
          method: name,
          node: grandparent,
          args: grandparent.arguments,
          fn: enclosingFunction(grandparent)
        });
      }
    } else if (
      (grandparent.type === 'AssignmentExpression' && grandparent.left === parent) ||
      grandparent.type === 'UpdateExpression'
    ) {
      instance.fieldWrites.push({ field: name, node: grandparent, fn: enclosingFunction(grandparent) });
    }
    return;
  }

  if (isEscape(identifier)) {
    instance.escapes.push(identifier);
  }
}

// Tracks every `new X(...)` for which `describe(newExpression)` returns an object (at least { className }),
// following the variable it is bound to. Returns { instances, byNode } where byNode maps each
// construction (NewExpression) to its instance. Used for GlideRecord here and for GlideAjax in
// glide-ajax.js.
export function trackInstances(ast, scopes, describe) {
  const instances = [];
  const byNode = new Map();
  const bindings = new Map();

  walk(ast, (node) => {
    if (node.type !== 'NewExpression') {
      return;
    }
    const described = describe(node);
    if (!described) {
      return;
    }
    const binding = bindingOf(node, scopes);
    const instance = {
      node,
      ...described,
      name: binding?.name ?? null,
      fn: enclosingFunction(node),
      calls: [],
      fieldWrites: [],
      escapes: [],
      tracked: Boolean(binding)
    };
    instances.push(instance);
    byNode.set(node, instance);
    if (binding && !bindings.has(binding.key)) {
      bindings.set(binding.key, binding);
    }
  });

  for (const binding of bindings.values()) {
    const writes = writesOf(binding);
    for (const reference of binding.references) {
      if (reference.isWrite && !reference.isRead) {
        continue;
      }
      const { identifier } = reference;
      let owner = null;
      for (const write of writes) {
        if (write.end > identifier.start) {
          break;
        }
        owner = write;
      }
      const instance = owner?.value && byNode.get(owner.value);
      if (instance) {
        recordUse(instance, identifier);
      }
    }
  }

  for (const instance of instances) {
    instance.calls.sort((a, b) => a.node.start - b.node.start);
    instance.fieldWrites.sort((a, b) => a.node.start - b.node.start);
  }

  return { instances, byNode };
}

export function stringValue(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  return isStringLiteral(node) ? node.quasis[0].value.cooked : null;
}

// GlideRecord / GlideRecordSecure / GlideAggregate instances, with `table` (null when not a literal) and
// `isAggregate`.
export function analyzeGlideRecords(ast, scopes) {
  return trackInstances(ast, scopes, (node) => {
    const className = glideRecordClass(node);
    return className
      ? { className, isAggregate: className === 'GlideAggregate', table: stringValue(node.arguments[0]) }
      : null;
  });
}

export function callsNamed(instance, methods) {
  return instance.calls.filter((call) => methods.has(call.method));
}

export function callsBefore(instance, node, methods) {
  return instance.calls.filter((call) => call.node.start < node.start && methods.has(call.method));
}

export function escapesBefore(instance, node) {
  return instance.escapes.some((identifier) => identifier.start < node.start);
}

// --- Filters --------------------------------------------------------------------------------------------

// Literal text of a string expression, ignoring the parts that are not constant: `'caller_id=' + id` gives
// "caller_id=". Identifiers bound once to a constant string are followed.
function constantText(node, scopes, depth = 0) {
  if (!node || depth > 5) {
    return '';
  }
  if (node.type === 'Literal') {
    return typeof node.value === 'string' ? node.value : '';
  }
  if (node.type === 'TemplateLiteral') {
    return node.quasis.map((quasi) => quasi.value.cooked ?? '').join('');
  }
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return constantText(node.left, scopes, depth + 1) + constantText(node.right, scopes, depth + 1);
  }
  if (node.type === 'Identifier') {
    const variable = scopeOf(scopes, node).resolve(node.name);
    const def = variable?.defs.length === 1 ? variable.defs[0] : null;
    if (def?.node?.type === 'VariableDeclarator' && variable.references.every((reference) => !reference.isWrite)) {
      return constantText(def.node.init, scopes, depth + 1);
    }
  }
  return '';
}

// True when an encoded query contains at least one condition, rather than nothing or only ORDERBY terms.
export function encodedQueryHasCondition(text) {
  return text
    .split('^')
    .map((segment) => segment.trim())
    .some((segment) => /[A-Za-z]/.test(segment) && !/^(ORDERBY|GROUPBY|EQ$|NQ$|OR$)/i.test(segment));
}

function isStaticFilter(call, scopes) {
  const encoded = call.method === 'addEncodedQuery' || (call.method === 'addQuery' && call.args.length === 1);
  if (encoded) {
    return encodedQueryHasCondition(constantText(call.args[0], scopes));
  }
  return call.method !== 'addQuery' || call.args.length > 1;
}

// Whether a child position makes execution optional relative to its parent.
function isConditionalChild(parent, child) {
  switch (parent.type) {
    case 'IfStatement':
    case 'ConditionalExpression':
      return child !== parent.test;
    case 'LogicalExpression':
      return child === parent.right;
    case 'SwitchCase':
    case 'CatchClause':
      return true;
    case 'WhileStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
      return child === parent.body;
    case 'ForStatement':
      return child === parent.body || child === parent.update;
    default:
      return false;
  }
}

// True when, whenever `target` runs, `node` (earlier in the same function) has run too — as far as the
// syntax shows. `if (x) gr.addQuery(...); gr.deleteMultiple();` is conditional.
export function runsWhenever(node, target) {
  let child = node;
  for (let parent = node.parent; parent && !contains(parent, target); parent = parent.parent) {
    if (isFunctionNode(parent) || isConditionalChild(parent, child)) {
      return false;
    }
    child = parent;
  }
  return true;
}

// How well `terminal` (a query/update/delete call) is restricted:
//   'unknown'  the object escaped before the call; conditions may be added elsewhere
//   'none'     no conditions at all
//   'weak'     conditions exist but may be empty at runtime (variable encoded query, filter in a branch)
//   'static'   at least one condition that always applies
export function filterStrength(instance, terminal, scopes) {
  if (escapesBefore(instance, terminal)) {
    return 'unknown';
  }
  const filters = callsBefore(instance, terminal, FILTER_METHODS);
  if (filters.length === 0) {
    return 'none';
  }
  return filters.some((call) => isStaticFilter(call, scopes) && runsWhenever(call.node, terminal)) ? 'static' : 'weak';
}

export function hasLimitBefore(instance, terminal) {
  return callsBefore(instance, terminal, LIMIT_METHODS).length > 0;
}

// --- Loops ----------------------------------------------------------------------------------------------

function isIterationCallback(fn) {
  const call = fn.parent;
  return (
    call?.type === 'CallExpression' &&
    call.arguments.includes(fn) &&
    call.callee.type === 'MemberExpression' &&
    ITERATION_METHODS.has(getPropertyName(call.callee))
  );
}

function isRepeatedChild(loop, child) {
  switch (loop.type) {
    case 'WhileStatement':
    case 'DoWhileStatement':
      return true;
    case 'ForStatement':
      return child !== loop.init;
    default:
      return child === loop.body;
  }
}

// The nearest loop (or iteration callback call such as `ids.forEach(...)`) that runs `node` repeatedly
// within its function, or null. Stops at other function boundaries: we cannot know how often a function
// is called.
export function enclosingLoop(node) {
  let child = node;
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (LOOP_TYPES.has(parent.type) && isRepeatedChild(parent, child)) {
      return parent;
    }
    if (isFunctionNode(parent)) {
      if (!isIterationCallback(parent)) {
        return null;
      }
      return parent.parent;
    }
    child = parent;
  }
  return null;
}

// The `while (gr.next())`-style loop over `instance` that contains `node`, or null.
export function enclosingNextLoop(instance, node) {
  const nextCalls = callsNamed(instance, NEXT_METHODS);
  for (let current = node.parent; current && !isFunctionNode(current); current = current.parent) {
    if (LOOP_TYPES.has(current.type) && current.test) {
      const test = current.test;
      if (nextCalls.some((call) => contains(test, call.node))) {
        return current;
      }
    }
  }
  return null;
}

export function describeTable(instance) {
  return instance.table ? `'${instance.table}'` : 'the table';
}
