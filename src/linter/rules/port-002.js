import { literalString, SYS_ID } from './portability-helpers.js';

// Scripts that exist to act on specific records in one instance.
const ONE_OFF = new Set(['fix_script', 'background_script']);

export default {
  id: 'PORT-002',
  name: 'Hardcoded sys_id',
  category: 'portability',
  severity: 'warning',
  description: 'A 32-character sys_id literal. Records created separately on each instance have different sys_ids. INFO in fix and background scripts.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    const seen = new Set();
    const oneOff = ONE_OFF.has(context.execution.type);

    return {
      Literal(node) {
        const value = literalString(node);
        if (!value || !SYS_ID.test(value) || seen.has(value)) {
          return;
        }
        seen.add(value);
        context.report({
          node,
          severity: oneOff ? 'info' : undefined,
          confidence: 0.8,
          message: `Hardcoded sys_id '${value}'.`,
          explanation: 'A sys_id identifies one record on one instance. Groups, users, and other data created separately in dev, test, and production have different sys_ids, so this silently matches nothing (or the wrong record) after promotion, and nobody can tell what it refers to by reading the code.',
          recommendation: oneOff
            ? 'Fine for a one-off script, but add a comment naming the record.'
            : "Look the record up by a stable key (name, number, user_name), or store the sys_id in a system property (gs.getProperty('x_app.default_group')) set per instance."
        });
      }
    };
  }
};
