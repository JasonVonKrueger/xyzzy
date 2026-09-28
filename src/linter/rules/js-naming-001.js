import { declaredIdentifiers, listNames } from './naming-helpers.js';

const CAMEL_CASE = /^[a-z][a-zA-Z0-9]*$/;
const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/;
const UPPER_CASE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

function isConventional(name) {
  // Leading/trailing _ and $ are accepted markers (private members, jQuery/Angular objects).
  const core = name.replace(/^[_$]+|[_$]+$/g, '');
  return core === '' || CAMEL_CASE.test(core) || PASCAL_CASE.test(core) || UPPER_CASE.test(core) || /^g_/.test(name);
}

// One finding per file listing the offenders, so legacy scripts do not produce a wall of style noise.
export default {
  id: 'JS-NAMING-001',
  name: 'Identifier naming convention',
  category: 'naming',
  severity: 'info',
  description: 'Variables and functions should be camelCase, constructors and Script Include classes PascalCase, constants UPPER_CASE.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    return {
      Program() {
        const offenders = declaredIdentifiers(context.scopes).filter(({ name }) => !isConventional(name));
        if (offenders.length === 0) {
          return;
        }

        context.report({
          node: offenders[0].identifier,
          message:
            offenders.length === 1
              ? `'${offenders[0].name}' does not follow camelCase naming.`
              : `${offenders.length} names do not follow camelCase naming: ${listNames(offenders)}.`,
          explanation:
            'ServiceNow platform code and most scoped apps use camelCase for variables and functions (grIncident, assignmentGroup) and PascalCase for Script Include classes. Mixing in snake_case makes it harder to tell local variables from field names such as assignment_group.',
          recommendation: 'Rename to camelCase (e.g. my_var → myVar). Renaming is not automatic because the names may be referenced from other scripts.'
        });
      }
    };
  }
};
