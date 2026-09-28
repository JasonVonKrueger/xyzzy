import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { EXECUTION_CONTEXTS } from './execution-context.js';
import { RULE_CATEGORIES } from './rule-registry.js';
import { parseSeverity } from './severity.js';

export const CONFIG_FILE_NAMES = ['.snlintrc.json', '.snlintrc'];

export const DEFAULT_THRESHOLDS = Object.freeze({
  maxFunctionLength: 75,
  maxFileLength: 500,
  maxComplexity: 10,
  maxNestingDepth: 4,
  maxParameters: 5
});

export const DEFAULT_OPTIONS = Object.freeze({
  // ERROR findings below this confidence are reported as WARNING.
  errorConfidenceThreshold: 0.8,
  // Findings below this confidence are dropped entirely.
  minConfidence: 0,
  ecmaVersion: 'latest'
});

export class LintConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LintConfigError';
  }
}

// Accepts "error" | "warning" | "info" | "off", ["warning", { ...options }], or
// { "severity": "warning", "options": { ... } }.
function parseRuleSetting(ruleId, setting) {
  let severityValue = setting;
  let options = {};

  if (Array.isArray(setting)) {
    [severityValue, options = {}] = setting;
  } else if (setting && typeof setting === 'object') {
    severityValue = setting.severity;
    options = setting.options ?? {};
  }

  const severity = severityValue === undefined ? undefined : parseSeverity(severityValue);
  if (severity === null) {
    throw new LintConfigError(
      `Invalid severity ${JSON.stringify(severityValue)} for ${ruleId}. Use "error", "warning", "info", or "off".`
    );
  }
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new LintConfigError(`Options for ${ruleId} must be an object.`);
  }

  return { severity, options };
}

// Accepts ["name", ...] (read-only) or { "name": "readonly" | "writable" }.
function parseGlobals(value) {
  const globals = new Map();
  if (value === undefined) {
    return globals;
  }

  if (!Array.isArray(value) && (typeof value !== 'object' || value === null)) {
    throw new LintConfigError('globals must be an array of names or an object of name: "readonly" | "writable".');
  }

  const entries = Array.isArray(value) ? value.map((name) => [name, 'readonly']) : Object.entries(value);
  for (const [name, access] of entries) {
    if (typeof name !== 'string' || !['readonly', 'writable'].includes(access)) {
      throw new LintConfigError(`Invalid global ${JSON.stringify(name)}: use "readonly" or "writable".`);
    }
    globals.set(name, { writable: access === 'writable' });
  }
  return globals;
}

function toFiniteNumber(name, value, { min = -Infinity, max = Infinity } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new LintConfigError(`${name} must be a number between ${min} and ${max}.`);
  }
  return value;
}

// Merges user configuration with defaults and checks it against the registry. Unknown rule ids are
// collected as warnings rather than errors so configs survive rule renames.
export function resolveConfig(userConfig = {}, registry) {
  if (typeof userConfig !== 'object' || userConfig === null || Array.isArray(userConfig)) {
    throw new LintConfigError('Configuration must be a JSON object.');
  }

  const warnings = [];

  const categories = new Map();
  for (const [category, value] of Object.entries(userConfig.categories ?? {})) {
    if (!RULE_CATEGORIES.has(category)) {
      warnings.push(`Unknown rule category "${category}" in configuration.`);
      continue;
    }
    const severity = parseSeverity(value);
    if (severity === null) {
      throw new LintConfigError(`Invalid severity ${JSON.stringify(value)} for category "${category}".`);
    }
    categories.set(category, severity);
  }

  const ruleSettings = new Map();
  for (const [ruleId, setting] of Object.entries(userConfig.rules ?? {})) {
    if (registry && !registry.has(ruleId)) {
      warnings.push(`Unknown rule "${ruleId}" in configuration.`);
      continue;
    }
    ruleSettings.set(ruleId, parseRuleSetting(ruleId, setting));
  }

  const thresholds = { ...DEFAULT_THRESHOLDS };
  for (const [name, value] of Object.entries(userConfig.thresholds ?? {})) {
    if (!(name in DEFAULT_THRESHOLDS)) {
      warnings.push(`Unknown threshold "${name}" in configuration.`);
      continue;
    }
    thresholds[name] = toFiniteNumber(`thresholds.${name}`, value, { min: 0 });
  }

  if (userConfig.context !== undefined && !EXECUTION_CONTEXTS[userConfig.context]) {
    throw new LintConfigError(
      `Unknown context "${userConfig.context}". Valid contexts: ${Object.keys(EXECUTION_CONTEXTS).join(', ')}.`
    );
  }

  const confidenceRange = { min: 0, max: 1 };
  return {
    categories,
    rules: ruleSettings,
    thresholds,
    context: userConfig.context,
    globals: parseGlobals(userConfig.globals),
    errorConfidenceThreshold: toFiniteNumber(
      'errorConfidenceThreshold',
      userConfig.errorConfidenceThreshold ?? DEFAULT_OPTIONS.errorConfidenceThreshold,
      confidenceRange
    ),
    minConfidence: toFiniteNumber('minConfidence', userConfig.minConfidence ?? DEFAULT_OPTIONS.minConfidence, confidenceRange),
    ecmaVersion: userConfig.ecmaVersion ?? DEFAULT_OPTIONS.ecmaVersion,
    warnings
  };
}

export function ensureResolvedConfig(config, registry) {
  return config?.rules instanceof Map ? config : resolveConfig(config ?? {}, registry);
}

// Effective severity ('off' | 'error' | 'warning' | 'info') and options for a rule: rule setting, then
// category setting, then the rule's default.
export function getRuleSetting(config, rule) {
  const setting = config.rules.get(rule.id);
  const severity = setting?.severity ?? config.categories.get(rule.category) ?? rule.severity;
  return { severity, options: setting?.options ?? {} };
}

export function loadConfigFile(filePath) {
  let text;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new LintConfigError(`Cannot read config file ${filePath}: ${error.message}`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new LintConfigError(`Config file ${filePath} is not valid JSON: ${error.message}`);
  }
}

export function findConfigFile(directory) {
  for (const name of CONFIG_FILE_NAMES) {
    const candidate = path.join(directory, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}
