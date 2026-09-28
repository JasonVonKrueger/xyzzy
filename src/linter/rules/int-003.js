import { callsBefore } from '../glide-record.js';

export default {
  id: 'INT-003',
  name: 'Synchronous outbound call without a timeout',
  category: 'integration',
  severity: 'info',
  description: 'RESTMessageV2/SOAPMessageV2 execute() without setHttpTimeout() waits for the platform default (minutes).',
  contexts: ['any'],
  excludeContexts: ['client'],
  fixable: false,

  create(context) {
    return {
      'Program:exit'() {
        for (const response of context.outbound.responses) {
          if (response.method !== 'execute') {
            continue;
          }
          const { instance } = response;
          if (callsBefore(instance, response.execute, new Set(['setHttpTimeout'])).length > 0 || instance.escapes.length > 0) {
            continue;
          }
          context.report({
            node: response.execute,
            confidence: 0.7,
            message: `${instance.name}.execute() has no setHttpTimeout(), so a slow endpoint can hold this transaction for minutes.`,
            explanation: 'Without an explicit timeout the call waits for the instance-wide default. A hung endpoint then blocks the user, the scheduled job, or the worker thread for that long, and many such calls at once can exhaust the semaphores.',
            recommendation: `Call ${instance.name}.setHttpTimeout(milliseconds) with a value that fits the endpoint (for example 10000–30000), and handle the timeout as an error.`
          });
        }
      }
    };
  }
};
