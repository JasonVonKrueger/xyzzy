import { CONTEXT_SELECTORS } from './execution-context.js';
import { SEVERITIES } from './severity.js';

export const RULE_CATEGORIES = new Set([
  'correctness',
  'naming',
  'formatting',
  'functions',
  'error-handling',
  'security',
  'performance',
  'servicenow',
  'integration',
  'portability',
  'logging',
  'complexity',
  'documentation'
]);

// Only these categories may be auto-fixed. Everything else — security, GlideRecord behavior, Business
// Rule recursion, integrations — is MANUAL_REVIEW by policy, and the registry refuses rules that claim
// otherwise. Fixes are additionally verified to leave the AST unchanged (see fixer.js).
export const AUTO_FIXABLE_CATEGORIES = new Set(['formatting']);

const RULE_ID = /^[A-Z]+(?:-[A-Z]+)*-\d{3}$/;

export class RuleDefinitionError extends Error {
  constructor(ruleId, problem) {
    super(`Invalid rule ${ruleId ?? '(missing id)'}: ${problem}`);
    this.name = 'RuleDefinitionError';
  }
}

function validateRule(rule) {
  const fail = (problem) => {
    throw new RuleDefinitionError(rule?.id, problem);
  };

  if (!rule || typeof rule !== 'object') fail('rule must be an object');
  if (typeof rule.id !== 'string' || !RULE_ID.test(rule.id)) fail('id must look like "SN-GR-001"');
  for (const field of ['name', 'description']) {
    if (typeof rule[field] !== 'string' || rule[field].trim() === '') fail(`${field} is required`);
  }
  if (!RULE_CATEGORIES.has(rule.category)) fail(`unknown category "${rule.category}"`);
  if (!SEVERITIES.includes(rule.severity)) fail(`severity must be one of ${SEVERITIES.join(', ')}`);
  if (!Array.isArray(rule.contexts) || rule.contexts.length === 0) fail('contexts must be a non-empty array');
  for (const selector of rule.contexts) {
    if (!CONTEXT_SELECTORS.has(selector)) fail(`unknown context "${selector}"`);
  }
  if (rule.excludeContexts !== undefined) {
    if (!Array.isArray(rule.excludeContexts)) fail('excludeContexts must be an array');
    for (const selector of rule.excludeContexts) {
      if (!CONTEXT_SELECTORS.has(selector) || selector === 'any') fail(`unknown excluded context "${selector}"`);
    }
  }
  if (typeof rule.fixable !== 'boolean') fail('fixable must be true or false');
  if (rule.fixable && !AUTO_FIXABLE_CATEGORIES.has(rule.category)) {
    fail(`category "${rule.category}" cannot be auto-fixed; mark the rule fixable: false`);
  }
  // Engine rules (e.g. syntax errors) are reported by the engine itself and have no visitors.
  if (!rule.engine && typeof rule.create !== 'function') fail('create(context) must be a function');
}

export class RuleRegistry {
  constructor(rules = []) {
    this.rules = new Map();
    for (const rule of rules) {
      this.register(rule);
    }
  }

  register(rule) {
    validateRule(rule);
    if (this.rules.has(rule.id)) {
      throw new RuleDefinitionError(rule.id, 'duplicate rule id');
    }
    this.rules.set(rule.id, Object.freeze({ ...rule }));
    return this;
  }

  get(id) {
    return this.rules.get(id);
  }

  has(id) {
    return this.rules.has(id);
  }

  all() {
    return [...this.rules.values()];
  }
}
