import { STATUS_CHECKS } from '../outbound.js';

const BODY_READS = new Set(['getBody', 'getXMLBody', 'getResponseBody']);

export default {
  id: 'INT-001',
  name: 'Response used without checking the status',
  category: 'integration',
  severity: 'warning',
  description: 'The body of a RESTMessageV2/SOAPMessageV2 response is read without getStatusCode() or haveError().',
  contexts: ['any'],
  excludeContexts: ['client'],
  fixable: false,

  create(context) {
    return {
      'Program:exit'() {
        for (const response of context.outbound.responses) {
          if (response.escapes || response.calls.some((call) => STATUS_CHECKS.has(call.method))) {
            continue;
          }
          const read = response.calls.find((call) => BODY_READS.has(call.method));
          if (!read) {
            continue;
          }
          const name = response.name ?? `${response.instance.name}.${response.method}()`;
          context.report({
            node: read.node,
            confidence: 0.8,
            message: `${name}.${read.method}() is used without checking the HTTP status.`,
            explanation: 'execute() does not throw on HTTP errors: a 401, 404, or 500 still returns a response, usually with an HTML or error body. Code that reads the body as success data then stores garbage, or fails later with a confusing JSON parse error.',
            recommendation: `Check ${response.name ?? 'the response'}.getStatusCode() (and haveError()/getErrorMessage() for connection failures) before using the body, and log the status and endpoint when it is not 2xx.`
          });
        }
      }
    };
  }
};
