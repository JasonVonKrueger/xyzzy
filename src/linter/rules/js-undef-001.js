import { isTypeofOperand } from '../ast.js';
import { editDistance, isKnownGlobal, KNOWN_LOWERCASE_GLOBALS, looksLikePlatformName } from '../known-globals.js';

const VARIABLE_CONFIDENCE = 0.85;
// A lowercase function could be defined by a global Business Rule (server) or a UI Script (client),
// which the linter cannot see.
const CALL_CONFIDENCE = 0.6;
const SUGGESTION_CONFIDENCE = 0.95;

function visibleNames(scope) {
  const names = [];
  for (let current = scope; current; current = current.parent) {
    names.push(...current.variables.keys());
  }
  return names;
}

function suggest(name, scope) {
  let best = null;
  let bestDistance = Infinity;
  for (const candidate of [...visibleNames(scope), ...KNOWN_LOWERCASE_GLOBALS]) {
    const distance = editDistance(name.toLowerCase(), candidate.toLowerCase());
    if (distance < bestDistance && distance <= (name.length > 4 ? 2 : 1) && candidate !== name) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

// Reported once per name. Names that are assigned somewhere are left to JS-GLOBAL-001.
export default {
  id: 'JS-UNDEF-001',
  name: 'Undefined variable',
  category: 'correctness',
  severity: 'error',
  description: 'A variable or function is used but never declared and is not a known JavaScript, browser, or ServiceNow global.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    return {
      Program() {
        for (const [name, references] of context.scopes.globalReferences) {
          if (isKnownGlobal(name) || looksLikePlatformName(name) || context.configuredGlobals.has(name)) {
            continue;
          }
          if (references.some((reference) => reference.isWrite)) {
            continue;
          }

          const reads = references.filter((reference) => !isTypeofOperand(reference.identifier));
          if (reads.length === 0) {
            continue;
          }

          const [first] = reads;
          const isCall = first.identifier.parent.type === 'CallExpression' && first.identifier.parent.callee === first.identifier;
          const suggestion = suggest(name, first.from);
          const more = reads.length > 1 ? ` (${reads.length} uses)` : '';

          context.report({
            node: first.identifier,
            message: `'${name}' is not defined${more}.${suggestion ? ` Did you mean '${suggestion}'?` : ''}`,
            explanation: isCall
              ? `No function named ${name} is declared in this script. Unless it is defined by a global Business Rule or a UI Script, calling it throws a ReferenceError at runtime.`
              : `No variable named ${name} is declared in this script and it is not a known global, so reading it throws a ReferenceError at runtime.`,
            recommendation: suggestion
              ? `Check the spelling: '${suggestion}' is in scope.`
              : `Declare it with var/let/const, fix the spelling, or, if it really is provided elsewhere, list it under "globals" in .snlintrc.json.`,
            confidence: suggestion ? SUGGESTION_CONFIDENCE : isCall ? CALL_CONFIDENCE : VARIABLE_CONFIDENCE
          });
        }
      }
    };
  }
};
