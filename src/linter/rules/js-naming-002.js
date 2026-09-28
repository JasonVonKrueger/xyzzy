import { declaredIdentifiers, listNames } from './naming-helpers.js';

const LOOP_TYPES = new Set(['ForStatement', 'ForInStatement', 'ForOfStatement']);

// Allowed: loop counters, catch parameters, `_`/`$`, and parameters of callbacks passed straight to a
// call (sort comparators, map/filter/forEach), where short names are idiomatic.
function isAllowed({ name, def }) {
  if (name === '_' || name === '$' || def.kind === 'catch') {
    return true;
  }
  if (def.kind === 'var' || def.kind === 'let' || def.kind === 'const') {
    const declaration = def.node.parent;
    return LOOP_TYPES.has(declaration.parent?.type) && (declaration.parent.init === declaration || declaration.parent.left === declaration);
  }
  if (def.kind === 'param') {
    const parent = def.node.parent;
    return (parent.type === 'CallExpression' || parent.type === 'NewExpression') && parent.arguments.includes(def.node);
  }
  return false;
}

export default {
  id: 'JS-NAMING-002',
  name: 'Single-character name',
  category: 'naming',
  severity: 'info',
  description: 'Single-letter names outside loop counters and short callbacks hide what a value is.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    return {
      Program() {
        const offenders = declaredIdentifiers(context.scopes).filter(
          (entry) => entry.name.length === 1 && !isAllowed(entry)
        );
        if (offenders.length === 0) {
          return;
        }

        context.report({
          node: offenders[0].identifier,
          message:
            offenders.length === 1
              ? `Single-character name '${offenders[0].name}'.`
              : `${offenders.length} single-character names: ${listNames(offenders)}.`,
          explanation:
            "A name like 'g' or 'x' forces the reader to trace back to the declaration to learn what it holds (is 'g' a GlideRecord? a group?), which slows down code review.",
          recommendation: 'Use a descriptive name (grIncident, assignmentGroup, retryCount). Single letters are fine for loop counters and short callbacks.'
        });
      }
    };
  }
};
