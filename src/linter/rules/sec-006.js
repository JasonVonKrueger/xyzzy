import { callsNamed, WRITE_METHODS } from '../glide-record.js';
import { containsAuthorizationCheck } from './security-helpers.js';

export default {
  id: 'SEC-006',
  name: 'Scripted REST write without authorization check',
  category: 'security',
  severity: 'warning',
  description: 'A Scripted REST resource writes with GlideRecord and the script never checks roles or ACLs.',
  contexts: ['scripted_rest'],
  fixable: false,

  create(context) {
    return {
      'Program:exit'(program) {
        if (containsAuthorizationCheck(program)) {
          return;
        }
        for (const instance of context.glideRecords.instances) {
          if (instance.className === 'GlideRecordSecure') {
            continue;
          }
          const [write] = callsNamed(instance, WRITE_METHODS);
          if (!write) {
            continue;
          }
          context.report({
            node: write.node,
            confidence: 0.6,
            message: `${instance.name}.${write.method}() writes ${instance.table ? `'${instance.table}'` : 'records'} from a Scripted REST resource with no role or ACL check in the script.`,
            explanation: 'GlideRecord ignores ACLs, so this write is limited only by the resource\'s "Requires authentication" and "Requires ACL authorization" settings. With the defaults, any authenticated user, including integration accounts, can make the change.',
            recommendation: 'Use GlideRecordSecure for the write, or check gs.hasRole() / canWrite() first and return 403 (sn_ws_err.ForbiddenError). Also confirm the resource requires authentication and an ACL.'
          });
          return;
        }
      }
    };
  }
};
