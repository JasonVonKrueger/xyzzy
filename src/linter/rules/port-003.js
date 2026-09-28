import { INSTANCE_HOST, literalString } from './portability-helpers.js';

export default {
  id: 'PORT-003',
  name: 'Hardcoded instance URL',
  category: 'portability',
  severity: 'warning',
  description: 'A literal *.service-now.com / *.servicenowservices.com host: links and calls point at one instance after cloning or promotion.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    function check(node, value) {
      const match = value?.match(INSTANCE_HOST);
      if (!match) {
        return;
      }
      const client = context.execution.side === 'client';
      context.report({
        node,
        confidence: 0.9,
        message: `Hardcoded instance host ${match[0]}.`,
        explanation: 'After a clone or promotion the script still points at this instance: production emails link to dev, or dev calls production.',
        recommendation: client
          ? 'Use a relative URL (/incident.do?sys_id=...) or window.location.origin.'
          : "Build URLs from gs.getProperty('glide.servlet.uri') (the current instance's base URL), or use a relative URL."
      });
    }

    return {
      Literal(node) {
        check(node, literalString(node));
      },
      TemplateLiteral(node) {
        check(node, node.quasis.map((quasi) => quasi.value.cooked ?? '').join(''));
      }
    };
  }
};
