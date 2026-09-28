import { getMemberChain } from '../ast.js';
import { clientCallableMethods, findDataAccess, methodChecksAuthorization, methodMap } from './security-helpers.js';

// Not callable through GlideAjax: the processor refuses names starting with _, and these are plumbing.
const NOT_CALLABLE = new Set(['initialize', 'type', 'isPublic', 'process']);

export function isPublicScriptInclude(methods) {
  const isPublic = methods.get('isPublic');
  const body = isPublic?.fn.body.body;
  return body?.length === 1 && body[0].type === 'ReturnStatement' && body[0].argument?.type === 'Literal' && body[0].argument.value === true;
}

export default {
  id: 'SEC-003',
  name: 'Client-callable method without authorization',
  category: 'security',
  severity: 'warning',
  description: 'A GlideAjax-callable Script Include method reads or writes records with GlideRecord and never checks roles or ACLs.',
  contexts: ['script_include'],
  fixable: false,

  create(context) {
    return {
      Program(program) {
        const methods = methodMap(clientCallableMethods(program));
        const publicInclude = isPublicScriptInclude(methods);

        for (const [name, { property, fn }] of methods) {
          if (name.startsWith('_') || NOT_CALLABLE.has(name)) {
            continue;
          }
          const access = findDataAccess(fn.body);
          if (!access || methodChecksAuthorization(name, methods)) {
            continue;
          }
          const what = access.type === 'NewExpression' ? `new ${getMemberChain(access.callee)}()` : 'getRefRecord()';
          context.report({
            node: property.key,
            confidence: publicInclude ? 0.85 : 0.7,
            message: `Client-callable method ${name}() uses ${what} without checking the caller's roles or ACLs${publicInclude ? ', and isPublic() lets unauthenticated users call it' : ''}.`,
            explanation: `Anyone who can run JavaScript in a browser session can call ${name}() directly with GlideAjax and any parameters they like, not only through your form. GlideRecord ignores ACLs, so the method returns or changes whatever the parameters point at.`,
            recommendation: 'Use GlideRecordSecure (enforces ACLs for the calling user), check canRead()/canWrite() on the record, or check gs.hasRole() at the start of the method. Return only the fields the client needs.'
          });
        }
      }
    };
  }
};
