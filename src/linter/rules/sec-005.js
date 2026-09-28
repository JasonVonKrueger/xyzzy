import { getCalleeName, getMemberChain, getPropertyName, isFunctionNode, isReference, walk } from '../ast.js';
import { glideRecordClass } from '../glide-record.js';
import { scopeOf } from '../scope.js';

const REQUEST_CHAINS = /^request\.(queryParams|pathParams|body|getHeader)/;
const FIELD_SINKS = new Set(['addQuery', 'addNullQuery', 'addNotNullQuery', 'orderBy', 'orderByDesc', 'setValue', 'getValue', 'getDisplayValue', 'getElement']);
const SANITIZER = /escape|sanitize|encode|isValid|validate/i;

function rootObject(member) {
  let node = member;
  while (node.type === 'MemberExpression') {
    node = node.object;
  }
  return node;
}

export default {
  id: 'SEC-005',
  name: 'Request input used as table, query, or field name',
  category: 'security',
  severity: 'error',
  description: 'Values from the caller (getParameter, request.queryParams/body, portal input) used as a GlideRecord table name, encoded query, or field name.',
  contexts: ['any'],
  excludeContexts: ['client'],
  fixable: false,

  create(context) {
    const { scopes } = context;
    const portal = context.execution.type === 'portal_server';

    function isSource(node) {
      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
        const method = getPropertyName(node.callee);
        return method === 'getParameter' || method === 'getParameterValue';
      }
      if (node.type === 'MemberExpression') {
        const chain = getMemberChain(node) ?? '';
        if (REQUEST_CHAINS.test(chain)) {
          return true;
        }
        if (portal && chain.startsWith('input.') && isSource(rootObject(node))) {
          return true;
        }
      }
      return portal && node.type === 'Identifier' && node.name === 'input' && !scopeOf(scopes, node).resolve('input');
    }

    const tainted = new Set();

    // Does evaluating `expression` read caller-controlled data? Returns the variable name or source text.
    function taintOf(expression) {
      let found = null;
      walk(expression, (node) => {
        if (found || (node !== expression && isFunctionNode(node))) {
          return false;
        }
        // A value passed through a validator or escaper is treated as clean.
        if (node.type === 'CallExpression' && SANITIZER.test((getCalleeName(node) ?? '').split('.').pop())) {
          return false;
        }
        if (isSource(node)) {
          found = { label: context.sourceCode.getText(node), variable: null };
        } else if (node.type === 'Identifier' && isReference(node)) {
          const variable = scopeOf(scopes, node).resolve(node.name);
          if (variable && tainted.has(variable)) {
            found = { label: node.name, variable };
          }
        }
        return undefined;
      });
      return found;
    }

    // `if (ALLOWED.indexOf(table) < 0) return;` and similar: the value is checked before use.
    function isChecked(variable) {
      return variable.references.some((reference) => {
        let child = reference.identifier;
        for (let parent = child.parent; parent && !/Statement$|Declaration$/.test(parent.type); parent = parent.parent) {
          child = parent;
        }
        const statement = child.parent;
        return (
          (statement?.type === 'IfStatement' && statement.test === child) ||
          (statement?.type === 'SwitchStatement' && statement.discriminant === child)
        );
      });
    }

    function report(node, sink, taint) {
      const checked = taint.variable && isChecked(taint.variable);
      const secure = sink.secure;
      context.report({
        node,
        severity: sink.kind === 'table' && !secure ? undefined : 'warning',
        confidence: checked ? 0.5 : secure ? 0.6 : sink.kind === 'table' ? 0.9 : 0.85,
        message: `${sink.label} comes from the request (${taint.label}).`,
        explanation: sink.explanation,
        recommendation: sink.recommendation
      });
    }

    return {
      'Program:exit'(program) {
        // Propagate taint through variables until nothing changes.
        const assignments = [];
        walk(program, (node) => {
          if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init) {
            assignments.push({ identifier: node.id, value: node.init, at: node });
          } else if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier') {
            assignments.push({ identifier: node.left, value: node.right, at: node });
          }
        });
        for (let pass = 0, changed = true; changed && pass < 5; pass += 1) {
          changed = false;
          for (const { identifier, value, at } of assignments) {
            const variable = scopeOf(scopes, at).resolve(identifier.name);
            if (variable && !tainted.has(variable) && taintOf(value)) {
              tainted.add(variable);
              changed = true;
            }
          }
        }

        walk(program, (node) => {
          if (node.type === 'NewExpression' && glideRecordClass(node) && node.arguments[0]) {
            const taint = taintOf(node.arguments[0]);
            if (taint) {
              const secure = glideRecordClass(node) === 'GlideRecordSecure';
              report(node.arguments[0], {
                kind: 'table',
                secure,
                label: `The table name of new ${glideRecordClass(node)}()`,
                explanation: secure
                  ? 'GlideRecordSecure still enforces ACLs, but the caller chooses which table to read, including tables whose ACLs are broad (sys_user, sys_properties, sys_audit).'
                  : 'The caller chooses which table is read or written. GlideRecord ignores ACLs, so this exposes any table in the instance (sys_user, sys_user_has_role, sys_properties) to whoever can send the request.',
                recommendation: "Map the input to a fixed allowlist (var TABLES = { incident: 'incident' }; var table = TABLES[input]; if (!table) return;) and use GlideRecordSecure."
              }, taint);
            }
            return undefined;
          }
          if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') {
            return undefined;
          }
          const method = getPropertyName(node.callee);
          const [first] = node.arguments;
          if (!first) {
            return undefined;
          }
          const encoded = method === 'addEncodedQuery' || (method === 'addQuery' && node.arguments.length === 1);
          if (encoded || FIELD_SINKS.has(method)) {
            const taint = taintOf(first);
            if (!taint) {
              return undefined;
            }
            report(first, encoded
              ? {
                  kind: 'query',
                  label: `The encoded query passed to ${method}()`,
                  explanation: 'The caller controls the whole condition: appending ^OR, ^NQ, or an always-true term widens the query to records they should not see or change.',
                  recommendation: 'Build the query from individual, validated values with addQuery(field, value) instead of accepting an encoded query from the client.'
                }
              : {
                  kind: 'field',
                  label: `The field name passed to ${method}()`,
                  explanation: 'The caller chooses which field is read, filtered, or written, which can expose or change fields the feature was never meant to touch (passwords, roles, sys_ fields).',
                  recommendation: 'Check the field name against an allowlist of the fields this feature works with before using it.'
                }, taint);
          }
          return undefined;
        });
      }
    };
  }
};
