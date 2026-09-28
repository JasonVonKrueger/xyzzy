import { getCalleeName, getPropertyName, isFunctionNode } from '../ast.js';
import { scopeOf } from '../scope.js';

function insideTry(node) {
  let child = node;
  for (let parent = node.parent; parent && !isFunctionNode(parent); parent = parent.parent) {
    if (parent.type === 'TryStatement' && parent.block === child && parent.handler) {
      return true;
    }
    child = parent;
  }
  return false;
}

function isGetBody(node) {
  return node?.type === 'CallExpression' && node.callee.type === 'MemberExpression' && getPropertyName(node.callee) === 'getBody';
}

export default {
  id: 'INT-002',
  name: 'Outbound call or response parsing without error handling',
  category: 'integration',
  severity: 'warning',
  description: 'JSON.parse() of a response body outside try/catch (WARNING); RESTMessageV2/SOAPMessageV2 execute() outside try/catch (INFO).',
  contexts: ['any'],
  excludeContexts: ['client'],
  fixable: false,

  create(context) {
    // `var body = response.getBody(); JSON.parse(body)` as well as `JSON.parse(response.getBody())`.
    function parsesBody(argument) {
      if (isGetBody(argument)) {
        return true;
      }
      if (argument?.type !== 'Identifier') {
        return false;
      }
      const def = scopeOf(context.scopes, argument).resolve(argument.name)?.defs[0];
      return def?.node?.type === 'VariableDeclarator' && isGetBody(def.node.init);
    }

    return {
      CallExpression(node) {
        if (getCalleeName(node) === 'JSON.parse' && parsesBody(node.arguments[0]) && !insideTry(node)) {
          context.report({
            node,
            confidence: 0.8,
            message: 'JSON.parse() of a response body outside try/catch.',
            explanation: 'Error pages, proxies, and timeouts return HTML or an empty body. JSON.parse() then throws, the rest of the script stops, and the log shows a syntax error instead of which call failed.',
            recommendation: 'Check the status code first, and wrap JSON.parse() in try/catch that logs the endpoint, status, and the first part of the body.'
          });
        }
      },
      'Program:exit'() {
        for (const response of context.outbound.responses) {
          if (insideTry(response.execute)) {
            continue;
          }
          context.report({
            node: response.execute,
            severity: 'info',
            confidence: 0.7,
            message: `${response.instance.name}.${response.method}() is not inside try/catch.`,
            explanation: 'execute() throws for problems such as an invalid endpoint, a missing REST Message record, or MID Server errors. Uncaught, the exception ends the whole script (the Business Rule, the job) with a generic error.',
            recommendation: 'Wrap the call in try/catch and log what was being called and for which record (gs.error with a source), then decide whether to retry, skip, or fail.'
          });
        }
      }
    };
  }
};
