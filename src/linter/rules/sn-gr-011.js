import { callsNamed, enclosingNextLoop } from '../glide-record.js';
import { GR_CONTEXTS } from './gr-helpers.js';

export default {
  id: 'SN-GR-011',
  name: 'Direct field assignment before updateMultiple',
  category: 'servicenow',
  severity: 'warning',
  description: 'gr.field = value followed by updateMultiple(): updateMultiple() only applies values set with setValue().',
  ...GR_CONTEXTS,
  fixable: false,

  create(context) {
    return {
      'Program:exit'() {
        for (const instance of context.glideRecords.instances) {
          const bulk = callsNamed(instance, new Set(['updateMultiple']))[0];
          if (!bulk) {
            continue;
          }
          const write = instance.fieldWrites.find(
            (candidate) =>
              candidate.field &&
              candidate.fn === bulk.fn &&
              candidate.node.start < bulk.node.start &&
              !enclosingNextLoop(instance, candidate.node)
          );
          if (!write) {
            continue;
          }
          const value = write.node.type === 'AssignmentExpression' ? context.sourceCode.getText(write.node.right) : 'value';
          context.report({
            node: write.node,
            confidence: 0.8,
            message: `${instance.name}.${write.field} is assigned directly before ${instance.name}.updateMultiple().`,
            explanation: 'updateMultiple() is documented to apply only values set with setValue(). Direct assignments may be ignored (always in scoped applications), so the bulk update silently changes nothing or only some fields.',
            recommendation: `Use ${instance.name}.setValue('${write.field}', ${value}) before updateMultiple().`
          });
        }
      }
    };
  }
};
