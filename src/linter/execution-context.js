import { getCalleeName, getMemberChain, isFunctionNode, traverse } from './ast.js';
import { SERVICENOW_GLOBALS } from './servicenow-apis.js';

// Every execution context the linter knows about. `side` decides which rules run: rules scoped to
// 'server' or 'client' run only when the side matches; 'both' (e.g. a UI Action that has client and
// server halves) only runs rules that name the context explicitly or apply to 'any'.
export const EXECUTION_CONTEXTS = {
  business_rule: { side: 'server', label: 'Business Rule' },
  script_include: { side: 'server', label: 'Script Include' },
  script_action: { side: 'server', label: 'Script Action' },
  scheduled_job: { side: 'server', label: 'Scheduled Job' },
  fix_script: { side: 'server', label: 'Fix Script' },
  background_script: { side: 'server', label: 'Background Script' },
  transform_map: { side: 'server', label: 'Transform Map script' },
  scripted_rest: { side: 'server', label: 'Scripted REST API resource' },
  flow_action: { side: 'server', label: 'Flow Designer script step' },
  portal_server: { side: 'server', label: 'Service Portal widget server script' },
  server: { side: 'server', label: 'Server-side script' },
  client_script: { side: 'client', label: 'Client Script' },
  catalog_client_script: { side: 'client', label: 'Catalog Client Script' },
  ui_policy: { side: 'client', label: 'UI Policy script' },
  portal_client: { side: 'client', label: 'Service Portal client controller' },
  client: { side: 'client', label: 'Client-side script' },
  ui_action: { side: 'both', label: 'UI Action' },
  unknown: { side: 'unknown', label: 'Unknown context' }
};

// When a Business Rule runs (sys_script.when). Record metadata is not part of the script, so it is only
// known when the caller passes it (lintText's `record` option, the CLI's --when/--table).
export const BUSINESS_RULE_WHEN = ['before', 'after', 'async', 'display'];

export const CONTEXT_SELECTORS = new Set(['any', 'server', 'client', ...Object.keys(EXECUTION_CONTEXTS)]);

// Directory names used by common ServiceNow source exports (table names and friendly names). The folder
// closest to the file wins.
const PATH_HINTS = {
  sys_script: 'business_rule',
  business_rules: 'business_rule',
  sys_script_include: 'script_include',
  script_includes: 'script_include',
  sys_script_client: 'client_script',
  client_scripts: 'client_script',
  catalog_script_client: 'catalog_client_script',
  catalog_client_scripts: 'catalog_client_script',
  sys_ui_policy: 'ui_policy',
  ui_policies: 'ui_policy',
  sys_ui_action: 'ui_action',
  ui_actions: 'ui_action',
  sys_ws_operation: 'scripted_rest',
  scripted_rest_resources: 'scripted_rest',
  sysauto_script: 'scheduled_job',
  scheduled_jobs: 'scheduled_job',
  sys_script_fix: 'fix_script',
  fix_scripts: 'fix_script',
  sysevent_script_action: 'script_action',
  script_actions: 'script_action',
  sys_transform_script: 'transform_map',
  sys_transform_entry: 'transform_map',
  sys_transform_map: 'transform_map',
  transform_scripts: 'transform_map'
};

const PATH_CONFIDENCE = 0.9;
const CLIENT_ENTRY_POINTS = new Set(['onLoad', 'onChange', 'onSubmit', 'onCellEdit']);
const TRANSFORM_ENTRY_POINTS = new Set(['transformRow', 'transformEntry', 'runTransformScript']);

export class UnknownExecutionContextError extends Error {
  constructor(name) {
    super(`Unknown execution context "${name}". Valid contexts: ${Object.keys(EXECUTION_CONTEXTS).join(', ')}.`);
    this.name = 'UnknownExecutionContextError';
  }
}

function describe(type, source, confidence, signals, traits = {}) {
  const { side, label } = EXECUTION_CONTEXTS[type];
  return { type, side, label, source, confidence, signals, traits };
}

export function contextFromPath(file) {
  if (!file) {
    return null;
  }

  const segments = file.split(/[\\/]+/).slice(0, -1).reverse();
  for (const segment of segments) {
    const type = PATH_HINTS[segment.toLowerCase()];
    if (type) {
      return describe(type, 'path', PATH_CONFIDENCE, [`folder "${segment}"`]);
    }
  }

  return null;
}

function findSignatures(ast) {
  const found = [];
  const traits = {};

  function add(type, confidence, signal) {
    found.push({ type, confidence, signal });
  }

  traverse(ast, {
    enter(node) {
      if (isFunctionNode(node) && node.id) {
        const name = node.id.name;
        const params = node.params.map((param) => param.name);
        const topLevel = node.parent?.type === 'Program';

        if (name === 'executeRule') {
          add('business_rule', 0.95, 'function executeRule(current, previous)');
        } else if (name === 'process' && params.includes('request') && params.includes('response')) {
          add('scripted_rest', 0.95, 'function process(request, response)');
        } else if (TRANSFORM_ENTRY_POINTS.has(name)) {
          add('transform_map', 0.9, `function ${name}()`);
        } else if (topLevel && CLIENT_ENTRY_POINTS.has(name)) {
          add('client_script', 0.9, `function ${name}()`);
        } else if (topLevel && name === 'onCondition') {
          add('ui_policy', 0.8, 'function onCondition()');
        }
      }

      if (node.type === 'CallExpression') {
        const callee = getCalleeName(node);
        if (callee === 'Class.create' || callee === 'Object.extendsObject') {
          add('script_include', 0.9, `${callee}()`);
        } else if (callee === 'gsftSubmit') {
          add('ui_action', 0.85, 'gsftSubmit()');
        }
      }

      if (node.type === 'Identifier' && node.name === 'AbstractAjaxProcessor') {
        traits.clientCallable = true;
      }

      if (node.type === 'AssignmentExpression' && getMemberChain(node.left) === 'api.controller') {
        add('portal_client', 0.85, 'api.controller = function');
      }
    }
  });

  found.sort((a, b) => b.confidence - a.confidence);
  return { signature: found[0] ?? null, traits };
}

function sideSignals(globalReferences) {
  const server = [];
  const client = [];

  for (const name of globalReferences.keys()) {
    const api = SERVICENOW_GLOBALS.get(name);
    if (!api?.signal) {
      continue;
    }
    if (api.side === 'server') {
      server.push(name);
    } else if (api.side === 'client') {
      client.push(name);
    }
  }

  return { server, client };
}

export function inferContextFromCode(ast, globalReferences) {
  const { signature, traits } = findSignatures(ast);
  if (signature) {
    return describe(signature.type, 'inferred', signature.confidence, [signature.signal], traits);
  }

  const { server, client } = sideSignals(globalReferences);
  const uses = (names) => names.map((name) => `uses ${name}`);

  if (server.length > 0 && client.length === 0) {
    return describe('server', 'inferred', server.length > 1 ? 0.8 : 0.7, uses(server), traits);
  }

  if (client.length > 0 && server.length === 0) {
    return describe('client', 'inferred', client.length > 1 ? 0.8 : 0.7, uses(client), traits);
  }

  // Mixed signals usually mean a mistake (server APIs in a client script or vice versa), so pick the
  // dominant side with low confidence; findings then stay at WARNING instead of ERROR.
  if (server.length !== client.length) {
    const type = server.length > client.length ? 'server' : 'client';
    return describe(type, 'inferred', 0.5, uses([...server, ...client]), traits);
  }

  return describe('unknown', 'inferred', 0, uses([...server, ...client]), traits);
}

// Precedence: explicit context > folder name > inference from the code. `record` ({ table, when }, both
// possibly null) is attached as given.
export function resolveExecutionContext({ explicit, file, ast, globalReferences, record = NO_RECORD }) {
  return { ...resolveType({ explicit, file, ast, globalReferences }), record };
}

export const NO_RECORD = Object.freeze({ table: null, when: null });

function resolveType({ explicit, file, ast, globalReferences }) {
  if (explicit) {
    if (!EXECUTION_CONTEXTS[explicit]) {
      throw new UnknownExecutionContextError(explicit);
    }
    const traits = ast ? findSignatures(ast).traits : {};
    return describe(explicit, 'explicit', 1, [], traits);
  }

  const fromPath = contextFromPath(file);
  if (fromPath) {
    if (ast) {
      fromPath.traits = findSignatures(ast).traits;
    }
    return fromPath;
  }

  if (!ast) {
    return describe('unknown', 'inferred', 0, []);
  }

  return inferContextFromCode(ast, globalReferences);
}

export function ruleAppliesToContext(rule, execution) {
  const matches = (selector) => selector === 'any' || selector === execution.type || selector === execution.side;
  return rule.contexts.some(matches) && !(rule.excludeContexts ?? []).some(matches);
}
