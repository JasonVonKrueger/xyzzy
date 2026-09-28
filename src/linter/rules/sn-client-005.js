import { isTypeofOperand } from '../ast.js';
import { CLIENT_AND_UI_ACTION, gFormMethod } from './client-helpers.js';

const DOM_GLOBALS = ['document', 'gel', '$', '$$', 'jQuery', '$j'];
const DOM_FORM_METHODS = new Set(['getControl', 'getElement', 'getFormElement']);

export default {
  id: 'SN-CLIENT-005',
  name: 'Direct DOM manipulation',
  category: 'servicenow',
  severity: 'warning',
  description: 'document, gel(), $/$$, jQuery, or g_form.getControl()/getElement() in client scripts: unsupported, and broken in Service Portal, Workspace, and isolated scripts.',
  contexts: CLIENT_AND_UI_ACTION,
  fixable: false,

  create(context) {
    const formCalls = [];

    return {
      CallExpression(node) {
        const method = gFormMethod(node, context.scopes);
        // gsftSubmit(null, g_form.getFormElement(), 'action_name') is the documented UI Action template.
        const inGsftSubmit = node.parent.type === 'CallExpression' && node.parent.callee.type === 'Identifier' && node.parent.callee.name === 'gsftSubmit';
        if (DOM_FORM_METHODS.has(method) && !inGsftSubmit) {
          formCalls.push({ node, name: `g_form.${method}()` });
        }
      },
      'Program:exit'() {
        const uses = [...formCalls];
        for (const name of DOM_GLOBALS) {
          for (const reference of context.scopes.globalReferences.get(name) ?? []) {
            if (!isTypeofOperand(reference.identifier)) {
              uses.push({ node: reference.identifier, name: name === 'gel' || name.startsWith('$') ? `${name}()` : name });
            }
          }
        }
        if (uses.length === 0) {
          return;
        }
        uses.sort((a, b) => a.node.start - b.node.start);
        const names = [...new Set(uses.map((use) => use.name))];
        context.report({
          node: uses[0].node,
          confidence: 0.85,
          message: `Direct DOM access (${names.join(', ')}) in this ${context.execution.label}${uses.length > 1 ? `, ${uses.length} uses` : ''}.`,
          explanation: 'The page structure is not a supported API: element ids and markup change between releases, so this breaks on upgrade. Scripts with "Isolate script" checked (the default for new scripts) cannot see document, window, or jQuery at all, and Service Portal and Workspace render the form differently, so the lookups find nothing.',
          recommendation: 'Use the g_form API (setDisplay, setReadOnly, setMandatory, showFieldMsg, addDecoration, flash) or a UI Policy. In Service Portal widgets, use Angular bindings and $element.'
        });
      }
    };
  }
};
