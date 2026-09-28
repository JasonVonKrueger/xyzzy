import { getMemberChain, getPropertyName } from '../ast.js';
import { INSTANCE_HOST, leadingText } from './portability-helpers.js';

const URL = /^[a-z][a-z0-9+.-]*:\/\/[^/\s]+/i;

export default {
  id: 'PORT-001',
  name: 'Hardcoded integration endpoint',
  category: 'portability',
  severity: 'warning',
  description: 'A literal URL passed to setEndpoint() or new GlideHTTPRequest(): the endpoint is the same in dev, test, and production.',
  contexts: ['any'],
  excludeContexts: ['client'],
  fixable: false,

  create(context) {
    function check(node, argument, where) {
      const text = leadingText(argument);
      // REST Message variable substitution (${host}) and instance URLs (PORT-003) are handled elsewhere.
      if (!text || !URL.test(text) || text.includes('${') || INSTANCE_HOST.test(text)) {
        return;
      }
      const host = text.match(URL)[0];
      context.report({
        node: argument,
        confidence: 0.85,
        message: `Hardcoded endpoint ${host} in ${where}.`,
        explanation: 'Every instance (dev, test, production, and clones) will call the same endpoint, so testing hits production systems, or production keeps calling a test system after a clone. Changing it needs a code change and a deployment.',
        recommendation: 'Put the endpoint on a REST Message record (new sn_ws.RESTMessageV2(name, method)), a connection alias, or a system property read with gs.getProperty(), set per instance.'
      });
    }

    return {
      CallExpression(node) {
        if (node.callee.type === 'MemberExpression' && getPropertyName(node.callee) === 'setEndpoint') {
          check(node.arguments[0], node.arguments[0], 'setEndpoint()');
        }
      },
      NewExpression(node) {
        if (getMemberChain(node.callee) === 'GlideHTTPRequest') {
          check(node.arguments[0], node.arguments[0], 'new GlideHTTPRequest()');
        }
      }
    };
  }
};
