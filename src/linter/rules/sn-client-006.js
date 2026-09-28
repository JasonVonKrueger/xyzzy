import { entryPoint } from './client-helpers.js';

const LOADING_PARAM = 3; // onChange(control, oldValue, newValue, isLoading, isTemplate)

export default {
  id: 'SN-CLIENT-006',
  name: 'onChange without an isLoading check',
  category: 'servicenow',
  severity: 'warning',
  description: 'onChange client scripts also run while the form loads; without checking isLoading they act on every form load.',
  contexts: ['client'],
  fixable: false,

  create(context) {
    return {
      Program(program) {
        const onChange = entryPoint(program, 'onChange');
        if (!onChange || onChange.body.body.length === 0) {
          return;
        }
        const param = onChange.params[LOADING_PARAM];
        const variable = param?.type === 'Identifier' ? context.scopes.scopeByNode.get(onChange).variables.get(param.name) : null;
        if (variable && variable.references.length > 0) {
          return;
        }
        context.report({
          node: onChange.id,
          confidence: 0.75,
          message: param ? `onChange never checks ${param.name}, so it also runs on every form load.` : 'onChange does not declare or check isLoading, so it also runs on every form load.',
          explanation: 'The platform calls onChange once for each field as the form loads, with isLoading = true. Without the check, the script clears or overwrites values, shows messages, and makes server calls every time a record is opened.',
          recommendation: "Start with the standard guard: if (isLoading || newValue === '') { return; }"
        });
      }
    };
  }
};
