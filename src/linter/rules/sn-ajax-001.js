import { enclosingFunction, enclosingLoop } from '../glide-record.js';
import { chainedRequest, requestsOf } from '../glide-ajax.js';
import { CLIENT_AND_UI_ACTION, gFormMethod } from './client-helpers.js';

const DEFAULT_MAX_REQUESTS = 2;

export default {
  id: 'SN-AJAX-001',
  name: 'Excessive server round trips',
  category: 'performance',
  severity: 'warning',
  description: 'GlideAjax or getReference() inside a loop, or more than maxRequests (default 2) GlideAjax requests in one function.',
  contexts: CLIENT_AND_UI_ACTION,
  fixable: false,

  create(context) {
    const max = context.options?.maxRequests ?? DEFAULT_MAX_REQUESTS;
    const extra = [];

    return {
      NewExpression(node) {
        const chained = node.callee.type === 'Identifier' && node.callee.name === 'GlideAjax' ? chainedRequest(node) : null;
        if (chained) {
          extra.push({ node: chained.node, what: `GlideAjax ${chained.method}()` });
        }
      },
      CallExpression(node) {
        if (gFormMethod(node, context.scopes) === 'getReference') {
          extra.push({ node, what: 'g_form.getReference()' });
        }
      },
      'Program:exit'() {
        const requests = [...extra];
        for (const instance of context.glideAjax.instances) {
          for (const call of requestsOf(instance)) {
            requests.push({ node: call.node, what: `GlideAjax ${call.method}()`, ajax: true });
          }
        }
        requests.sort((a, b) => a.node.start - b.node.start);

        const reportedLoops = new Set();
        for (const request of requests) {
          const loop = enclosingLoop(request.node);
          if (loop && !reportedLoops.has(loop)) {
            reportedLoops.add(loop);
            context.report({
              node: request.node,
              confidence: 0.85,
              message: `${request.what} inside a loop (line ${loop.loc.start.line}) sends one server request per iteration.`,
              explanation: 'Every request is a separate HTTP round trip with its own server transaction. In a loop they pile up, slow the form down, and can arrive out of order.',
              recommendation: 'Send the whole list in one GlideAjax call (for example as a comma-separated sysparm value) and return all results together as JSON.'
            });
          }
        }

        const byFunction = new Map();
        for (const request of requests.filter((candidate) => candidate.ajax || candidate.what.startsWith('GlideAjax'))) {
          const fn = enclosingFunction(request.node);
          byFunction.set(fn, [...(byFunction.get(fn) ?? []), request]);
        }
        for (const list of byFunction.values()) {
          if (list.length > max) {
            context.report({
              node: list[max].node,
              severity: 'info',
              confidence: 0.7,
              message: `${list.length} GlideAjax requests in one function; consider combining them into one call.`,
              explanation: 'Each GlideAjax request is a separate round trip and server transaction. On form load in particular, several requests delay the form and compete for the same session.',
              recommendation: 'Add one Script Include method that returns everything the script needs as JSON, or pass the values in g_scratchpad from a display Business Rule.'
            });
          }
        }
      }
    };
  }
};
