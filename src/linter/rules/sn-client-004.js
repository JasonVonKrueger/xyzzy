import { isFunctionNode } from '../ast.js';
import { callsNamed } from '../glide-record.js';
import { runsInPortal } from './client-helpers.js';

const READS = new Set(['query', 'get', 'next']);

export default {
  id: 'SN-CLIENT-004',
  name: 'GlideRecord in client-side code',
  category: 'performance',
  severity: 'warning',
  description: 'Client-side GlideRecord fetches whole records over the network (often synchronously); use GlideAjax with a Script Include.',
  contexts: ['client'],
  fixable: false,

  create(context) {
    return {
      'Program:exit'() {
        for (const instance of context.glideRecords.instances) {
          if (instance.className !== 'GlideRecord') {
            continue;
          }
          // query(callback) / get(sysId, callback): an identifier may name a callback, so it counts as one.
          const sync = callsNamed(instance, READS).find(
            (call) =>
              call.method !== 'next' &&
              !call.args.slice(call.method === 'get' ? 1 : 0).some((arg) => isFunctionNode(arg) || arg.type === 'Identifier')
          );
          const table = instance.table ? ` on '${instance.table}'` : '';
          context.report({
            node: instance.node,
            confidence: 0.9,
            message: sync
              ? `GlideRecord${table} in client-side code, with a synchronous ${sync.method}() that freezes the browser.`
              : `GlideRecord${table} in client-side code.`,
            explanation: `The client GlideRecord API sends a request per query and returns every field of every matching record to the browser, where the user can inspect it. Without a callback, the request is synchronous and blocks the page.${runsInPortal(context.execution) ? ' Service Portal only supports the asynchronous form.' : ''}`,
            recommendation: 'Move the query into a client-callable Script Include and call it with GlideAjax (getXMLAnswer), returning only the values the form needs.'
          });
        }
      }
    };
  }
};
