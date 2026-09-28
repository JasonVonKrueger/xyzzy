import { getCalleeName, isStringLiteral } from '../ast.js';

const EVAL_CALLEES = new Set(['eval', 'window.eval', 'globalThis.eval', 'this.eval']);
const FUNCTION_CONSTRUCTORS = new Set(['Function', 'window.Function', 'globalThis.Function']);
const STRING_TIMERS = new Set(['setTimeout', 'setInterval', 'window.setTimeout', 'window.setInterval']);
const SERVICENOW_EVALUATORS = new Set(['GlideEvaluator.evaluateString']);

// A constant string is not an injection vector, only a code smell, so it is reported with lower
// confidence (which the engine turns into a WARNING).
const LITERAL_CONFIDENCE = 0.6;

function describeCall(node) {
  const name = getCalleeName(node);
  const firstArgument = node.arguments[0];

  if (node.type === 'CallExpression' && EVAL_CALLEES.has(name)) {
    return { label: 'eval()', argument: firstArgument };
  }
  if (FUNCTION_CONSTRUCTORS.has(name)) {
    return { label: 'the Function constructor', argument: node.arguments[node.arguments.length - 1] };
  }
  if (node.type === 'CallExpression' && STRING_TIMERS.has(name) && firstArgument && isStringOrConcatenation(firstArgument)) {
    return { label: `${name}() with a string argument`, argument: firstArgument };
  }
  if (node.type === 'CallExpression' && SERVICENOW_EVALUATORS.has(name)) {
    return { label: `${name}()`, argument: firstArgument };
  }
  return null;
}

function isStringOrConcatenation(node) {
  return (
    isStringLiteral(node) ||
    node.type === 'TemplateLiteral' ||
    (node.type === 'BinaryExpression' && node.operator === '+' && (isStringOrConcatenation(node.left) || isStringOrConcatenation(node.right)))
  );
}

export default {
  id: 'SEC-001',
  name: 'Dynamic code execution',
  category: 'security',
  severity: 'error',
  description: 'Detects eval(), the Function constructor, string timers, and GlideEvaluator.evaluateString().',
  contexts: ['any'],
  fixable: false,

  create(context) {
    function check(node) {
      const call = describeCall(node);
      if (!call) {
        return;
      }

      const isConstant = call.argument !== undefined && isStringLiteral(call.argument);
      context.report({
        node,
        message: `Dynamic code execution with ${call.label}.`,
        explanation: isConstant
          ? 'The code being executed is a constant string, so it is not directly injectable, but it bypasses script review, is hard to debug, and is blocked in some scoped applications.'
          : 'The executed code is built at runtime. If any part of it comes from user input, record data, or an integration payload, an attacker can run arbitrary script with the privileges of this script.',
        recommendation:
          'Call the logic directly, use a lookup table or switch statement, or parse data with JSON.parse(). If a stored script really must run, use GlideScopedEvaluator against a protected, access-controlled field.',
        confidence: isConstant ? LITERAL_CONFIDENCE : 1
      });
    }

    return { CallExpression: check, NewExpression: check };
  }
};
