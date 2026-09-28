import { getCalleeName, getMemberChain, getPropertyName, isStringLiteral } from '../ast.js';

const HTML_PROPERTIES = new Set(['innerHTML', 'outerHTML']);
const JQUERY_FACTORIES = new Set(['$', '$j', 'jQuery', 'angular.element']);
const ESCAPER = /escape|sanitize|encode|text/i;

// Constant strings (and concatenations of them) cannot carry user input.
function isConstant(node) {
  if (isStringLiteral(node) || (node.type === 'Literal' && typeof node.value !== 'object')) {
    return true;
  }
  return node.type === 'BinaryExpression' && node.operator === '+' && isConstant(node.left) && isConstant(node.right);
}

function isEscaped(node) {
  return node.type === 'CallExpression' && ESCAPER.test((getCalleeName(node) ?? '').split('.').pop());
}

function isJQueryObject(node) {
  if (node.type === 'CallExpression') {
    return JQUERY_FACTORIES.has(getCalleeName(node));
  }
  return node.type === 'Identifier' && node.name.startsWith('$');
}

export default {
  id: 'SEC-008',
  name: 'HTML built from dynamic values (XSS)',
  category: 'security',
  severity: 'warning',
  description: 'innerHTML/outerHTML, insertAdjacentHTML, document.write, $sce.trustAsHtml, or jQuery .html() with a value that is not a constant string.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    function check(sinkNode, value, sink) {
      if (!value || isConstant(value) || isEscaped(value)) {
        return;
      }
      context.report({
        node: sinkNode,
        confidence: 0.7,
        message: `${sink} receives a dynamic value (${context.sourceCode.getText(value).slice(0, 60)}) that is rendered as HTML.`,
        explanation: 'If any part of the value comes from a record field, URL parameter, or server response, a user can store markup such as <img src=x onerror=...> that runs script in the browser of everyone who views it (cross-site scripting), with their session.',
        recommendation: 'Insert text instead of HTML (textContent, jQuery .text(), Angular {{ }} bindings, g_form.showFieldMsg), or escape the value first (GlideStringUtil.escapeHTML on the server).'
      });
    }

    return {
      AssignmentExpression(node) {
        if (node.left.type === 'MemberExpression' && HTML_PROPERTIES.has(getPropertyName(node.left)) && node.operator === '=') {
          check(node, node.right, getPropertyName(node.left));
        }
      },
      CallExpression(node) {
        const chain = getCalleeName(node);
        if (chain === 'document.write' || chain === 'document.writeln') {
          check(node, node.arguments[0], `${chain}()`);
          return;
        }
        if (chain === '$sce.trustAsHtml') {
          check(node, node.arguments[0], '$sce.trustAsHtml()');
          return;
        }
        if (node.callee.type !== 'MemberExpression') {
          return;
        }
        const method = getPropertyName(node.callee);
        if (method === 'insertAdjacentHTML') {
          check(node, node.arguments[1], 'insertAdjacentHTML()');
        } else if (method === 'html' && node.arguments.length === 1 && isJQueryObject(node.callee.object)) {
          const target = node.callee.object;
          const label = target.type === 'CallExpression' ? `${getCalleeName(target)}(...)` : getMemberChain(target);
          check(node, node.arguments[0], `${label}.html()`);
        }
      }
    };
  }
};
