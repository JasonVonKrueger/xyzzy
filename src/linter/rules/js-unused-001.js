import { getFunctionName } from '../ast.js';
import { ENTRY_POINT_FUNCTIONS } from '../known-globals.js';
import { isVariableUsed } from '../scope.js';

const SKIPPED_KINDS = new Set(['implicit', 'catch', 'import', 'function-name']);

function isIgnoredName(name) {
  return name.startsWith('_');
}

function isEntryPoint(functionNode) {
  return ENTRY_POINT_FUNCTIONS.has(getFunctionName(functionNode));
}

function paramNames(param) {
  const target = param.type === 'AssignmentPattern' ? param.left : param;
  return target.type === 'Identifier' ? target.name : null;
}

// Top-level declarations are skipped: in a ServiceNow script they are the script's public surface (the
// Script Include class, a client script's onLoad, a global Business Rule's functions) and are used by
// other records the linter cannot see. Wrapping logic in an IIFE — as Business Rules do by default —
// is what makes locals checkable.
export default {
  id: 'JS-UNUSED-001',
  name: 'Unused variable, function, or parameter',
  category: 'correctness',
  severity: 'warning',
  description: 'A local variable, function, or trailing parameter is never read.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    const checkParams = context.options.args ?? 'after-used'; // 'after-used' | 'none'

    function reportVariable(variable) {
      const [def] = variable.defs;
      const isFunction = def.kind === 'function';
      const assigned =
        variable.defs.some((candidate) => candidate.node?.type === 'VariableDeclarator' && candidate.node.init) ||
        variable.references.some((reference) => reference.isWrite);

      context.report({
        node: def.identifier,
        message: isFunction
          ? `Function '${variable.name}' is defined but never called.`
          : assigned
            ? `'${variable.name}' is assigned a value but never read.`
            : `'${variable.name}' is declared but never used.`,
        explanation: 'Unused code makes the script harder to review and often means a variable was misspelled or a step was left unfinished.',
        recommendation: `Remove it, or use it where it was intended${isFunction ? '' : ' (check for a typo in a nearby variable name)'}.`
      });
    }

    function checkParameters(functionNode, scope) {
      if (checkParams === 'none' || isEntryPoint(functionNode)) {
        return;
      }
      const params = functionNode.params.map(paramNames);
      for (let index = params.length - 1; index >= 0; index -= 1) {
        const name = params[index];
        if (!name) {
          return;
        }
        const variable = scope.variables.get(name);
        if (!variable || isVariableUsed(variable)) {
          return;
        }
        if (!isIgnoredName(name)) {
          context.report({
            node: variable.defs[0].identifier,
            severity: 'info',
            message: `Parameter '${name}' is never used.`,
            explanation: 'Callers pass a value that the function ignores, which is misleading when reading call sites.',
            recommendation: `Remove the parameter, or prefix it with an underscore (_${name}) if its position must be kept.`
          });
        }
      }
    }

    return {
      Program() {
        for (const scope of context.scopes.scopes) {
          if (scope.type === 'global' || scope.type === 'module') {
            continue;
          }

          for (const variable of scope.variables.values()) {
            const kinds = variable.defs.map((def) => def.kind);
            if (kinds.some((kind) => SKIPPED_KINDS.has(kind) || kind === 'param') || isIgnoredName(variable.name)) {
              continue;
            }
            if (!isVariableUsed(variable)) {
              reportVariable(variable);
            }
          }

          if (scope.type === 'function') {
            checkParameters(scope.node, scope);
          }
        }
      }
    };
  }
};
