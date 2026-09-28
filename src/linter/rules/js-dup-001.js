// Repeated `var` declarations are deliberately allowed: `for (var i = 0; ...)` twice in one function is
// a harmless and very common idiom. What is reported are redeclarations that silently replace
// something: a function declared twice, a function and a variable sharing a name, or a parameter
// overwritten by a `var` with an initializer.
function describeConflict(defs) {
  const functions = defs.filter((def) => def.kind === 'function');
  if (functions.length > 1) {
    return {
      def: functions[1],
      message: (name, line) => `Function '${name}' is declared again; the declaration on line ${line} is silently replaced.`,
      first: functions[0]
    };
  }

  const variable = defs.find((def) => def.kind === 'var' || def.kind === 'let' || def.kind === 'const');
  if (functions.length === 1 && variable) {
    const [first, second] = functions[0].identifier.start < variable.identifier.start ? [functions[0], variable] : [variable, functions[0]];
    return {
      def: second,
      message: (name, line) => `'${name}' is declared as both a function and a variable (first on line ${line}); the variable overwrites the function.`,
      first
    };
  }

  const param = defs.find((def) => def.kind === 'param');
  const overwrite = defs.find((def) => def.kind === 'var' && def.node?.init);
  if (param && overwrite) {
    return {
      def: overwrite,
      message: (name, line) => `'${name}' redeclares the parameter on line ${line} and overwrites the value the caller passed.`,
      first: param
    };
  }

  return null;
}

export default {
  id: 'JS-DUP-001',
  name: 'Duplicate declaration',
  category: 'correctness',
  severity: 'warning',
  description: 'A name is declared twice in the same scope in a way that replaces the first declaration.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    return {
      Program() {
        for (const scope of context.scopes.scopes) {
          for (const variable of scope.variables.values()) {
            if (variable.defs.length < 2) {
              continue;
            }
            const conflict = describeConflict(variable.defs);
            if (!conflict) {
              continue;
            }
            context.report({
              node: conflict.def.identifier,
              message: conflict.message(variable.name, conflict.first.identifier.loc.start.line),
              explanation:
                'Only one of the declarations takes effect, so code that relies on the other one runs different logic than it appears to.',
              recommendation: 'Rename one of them, or delete the one that is no longer needed.'
            });
          }
        }
      }
    };
  }
};
