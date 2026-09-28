import { getMemberChain, getPropertyName } from '../ast.js';

const RISKS = {
  impersonation: {
    message: 'User impersonation in a script',
    explanation: 'Code that impersonates another user acts with that user\'s roles, bypassing the normal access model, and the audit trail records the impersonated user rather than the caller. If the target user can be influenced by input, this is a privilege-escalation path.',
    recommendation: 'Avoid impersonation. Run the work as the current user, or use a dedicated integration user with only the roles it needs. If impersonation is unavoidable, hardcode the target, restore the session in a finally block, and log it.'
  },
  encrypter: {
    message: 'GlideEncrypter is deprecated and weak',
    explanation: 'GlideEncrypter uses 3DES with a key shared across the instance and is deprecated; values it protects are only obfuscated, not securely encrypted.',
    recommendation: 'Store secrets in password2 fields or Credential records, or use the Key Management Framework (sn_kmf) for encryption.'
  }
};

export default {
  id: 'SEC-007',
  name: 'Risky security API',
  category: 'security',
  severity: 'warning',
  description: 'User impersonation (GlideImpersonate, session.impersonate) and the deprecated GlideEncrypter.',
  contexts: ['any'],
  excludeContexts: ['client'],
  fixable: false,

  create(context) {
    const reported = new Set();

    function report(node, kind, api) {
      if (reported.has(kind)) {
        return;
      }
      reported.add(kind);
      const risk = RISKS[kind];
      context.report({ node, confidence: 0.85, message: `${risk.message} (${api}).`, explanation: risk.explanation, recommendation: risk.recommendation });
    }

    return {
      NewExpression(node) {
        const chain = getMemberChain(node.callee);
        if (chain === 'GlideImpersonate') {
          report(node, 'impersonation', 'new GlideImpersonate()');
        } else if (chain === 'GlideEncrypter') {
          report(node, 'encrypter', 'new GlideEncrypter()');
        }
      },
      CallExpression(node) {
        if (node.callee.type === 'MemberExpression' && getPropertyName(node.callee) === 'impersonate') {
          report(node, 'impersonation', `${context.sourceCode.getText(node.callee)}()`);
        }
      }
    };
  }
};
