import { getMemberChain, getPropertyName } from './ast.js';
import { SERVICENOW_GLOBALS } from './servicenow-apis.js';

const ECMASCRIPT = [
  'undefined', 'NaN', 'Infinity', 'globalThis', 'eval', 'arguments',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'encodeURI', 'encodeURIComponent', 'decodeURI', 'decodeURIComponent', 'escape', 'unescape'
];

const BROWSER = [
  'window', 'document', 'navigator', 'location', 'history', 'screen', 'self', 'top', 'parent', 'frames',
  'alert', 'confirm', 'prompt', 'console', 'fetch', 'performance', 'localStorage', 'sessionStorage',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'atob', 'btoa',
  'event', 'angular', '$', '$j', '$$', 'jQuery'
];

// Variables the platform injects into specific script types (union across all contexts: the
// server/client mismatch is SN-CLIENT-001's job, not the undefined-variable rule's).
const SERVICENOW_CONTEXT_VARIABLES = [
  // Server
  'gs', 'current', 'previous', 'g_scratchpad', 'answer', 'global',
  'action', 'source', 'target', 'map', 'log', 'ignore', 'error', 'error_message', 'status_message', // transform maps
  'email', 'email_action', 'event', 'template', 'sys_email', // notifications, inbound actions
  'producer', 'cat_item', // record producers
  'workflow', 'activity', 'context', // legacy workflow
  'request', 'response', 'g_request', 'g_response', 'g_processor', // Scripted REST, processors
  'data', 'input', 'options', '$sp', // portal widget server script
  'inputs', 'outputs', 'fd_data', // Flow Designer
  'vaInputs', 'vaVars', 'vaSystem', 'vaContext', // Virtual Agent
  'j2js', 'jsinclude',
  // Client
  'g_form', 'g_user', 'g_list', 'g_menu', 'g_item', 'g_navigation', 'g_i18n', 'g_lang', 'g_service_catalog',
  'g_user_date_format', 'g_user_date_time_format', 'g_tz_offset', 'g_ck', 'g_modal',
  'gel', 'getMessage', 'getMessages', 'jslog', 'spUtil', 'spModal', 'spAriaUtil', 'nowapi',
  '$scope', '$rootScope', '$http', '$timeout', '$interval', '$location', '$window', '$q', '$sce', '$uibModal',
  '$element', '$attrs', '$document', '$filter', '$compile'
];

// Globals scripts are expected to assign to.
export const WRITABLE_GLOBALS = new Set([
  'answer', 'ignore', 'error', 'error_message', 'status_message', 'data', 'outputs', 'g_scratchpad'
]);

const KNOWN = new Set([...ECMASCRIPT, ...BROWSER, ...SERVICENOW_CONTEXT_VARIABLES, ...SERVICENOW_GLOBALS.keys()]);

export const KNOWN_LOWERCASE_GLOBALS = [...KNOWN].filter((name) => /^[a-z_$]/.test(name));

export function isKnownGlobal(name) {
  return KNOWN.has(name);
}

// PascalCase names are platform classes (GlideRecord, JSUtil, ArrayUtil, ...) or Script Includes defined
// in other records, and `sn_*` / `x_*` are scoped-app namespaces. The linter cannot see those records,
// so they are never reported as undefined.
export function looksLikePlatformName(name) {
  return /^[A-Z]/.test(name) || /^(sn|x)_/.test(name);
}

// Functions whose signatures are fixed by the platform: their parameters must exist even when unused,
// and their names are called by the platform rather than by the script.
export const ENTRY_POINT_FUNCTIONS = new Set([
  'executeRule', 'process', 'transformRow', 'transformEntry', 'runTransformScript',
  'onLoad', 'onChange', 'onSubmit', 'onCellEdit', 'onCondition', 'execute', 'evaluate'
]);

const LOGGING_METHODS = new Set([
  'log', 'info', 'warn', 'warning', 'error', 'debug', 'print', 'trace',
  'logError', 'logWarning', 'addErrorMessage', 'addInfoMessage', 'showFieldMsg', 'jslog'
]);

// gs.error(...), gs.log(...), console.warn(...), this.logger.error(...), jslog(...)
export function isLoggingCall(node) {
  if (node.type !== 'CallExpression') {
    return false;
  }
  if (node.callee.type === 'Identifier') {
    return node.callee.name === 'jslog';
  }
  if (node.callee.type === 'MemberExpression') {
    return LOGGING_METHODS.has(getPropertyName(node.callee)) && getMemberChain(node.callee.object) !== null;
  }
  return false;
}

// Levenshtein distance, used for "did you mean" suggestions.
export function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) {
    return Infinity;
  }
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = row;
  }
  return previous[b.length];
}
