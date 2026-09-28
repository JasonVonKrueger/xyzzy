import { clientCallableMethods, methodMap } from './security-helpers.js';
import { isPublicScriptInclude } from './sec-003.js';

export default {
  id: 'SEC-004',
  name: 'Public client-callable Script Include',
  category: 'security',
  severity: 'warning',
  description: 'isPublic() returning true makes a client-callable Script Include callable by users who are not logged in.',
  contexts: ['script_include'],
  fixable: false,

  create(context) {
    return {
      Program(program) {
        const methods = methodMap(clientCallableMethods(program));
        if (!isPublicScriptInclude(methods)) {
          return;
        }
        context.report({
          node: methods.get('isPublic').property.key,
          confidence: 0.9,
          message: 'isPublic() returns true: every method of this Script Include can be called without logging in.',
          explanation: 'Public Script Includes are reachable from public pages by anonymous users. Every method that is not prefixed with _ becomes an unauthenticated API into the instance.',
          recommendation: 'Remove isPublic() unless the Script Include must serve a public page. If it must, keep only the methods that page needs, validate every parameter, and use GlideRecordSecure.'
        });
      }
    };
  }
};
