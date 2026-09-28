import { getCalleeName, getMemberChain, getPropertyName } from '../ast.js';
import { literalString } from './portability-helpers.js';

const IDENTITY_CALLS = new Set(['gs.getUserName', 'gs.getUserID', 'gs.getUser.getName', 'gs.getUser.getID', 'gs.getUser.getEmail']);
const IDENTITY_PROPERTIES = new Set(['g_user.userName', 'g_user.userID', 'g_user.email']);

// gs.getUser().getName() has the chain gs.getUser().getName: normalize calls inside the chain.
function identityOf(node) {
  if (node.type === 'CallExpression') {
    const callee = node.callee;
    if (callee.type === 'MemberExpression' && callee.object.type === 'CallExpression') {
      const inner = getCalleeName(callee.object);
      const method = getPropertyName(callee);
      return IDENTITY_CALLS.has(`${inner}.${method}`) ? `${inner}().${method}()` : null;
    }
    const name = getCalleeName(node);
    return IDENTITY_CALLS.has(name) ? `${name}()` : null;
  }
  const chain = node.type === 'MemberExpression' ? getMemberChain(node) : null;
  return IDENTITY_PROPERTIES.has(chain) ? chain : null;
}

export default {
  id: 'PORT-004',
  name: 'Logic tied to a specific user',
  category: 'portability',
  severity: 'warning',
  description: "The current user's name, sys_id, or email compared with a literal (gs.getUserName() == 'admin').",
  contexts: ['any'],
  fixable: false,

  create(context) {
    return {
      BinaryExpression(node) {
        if (!['==', '===', '!=', '!=='].includes(node.operator)) {
          return;
        }
        for (const [side, other] of [[node.left, node.right], [node.right, node.left]]) {
          const identity = identityOf(side);
          const value = literalString(other);
          if (!identity || value === null) {
            continue;
          }
          context.report({
            node,
            confidence: 0.85,
            message: `${identity} compared with '${value}': behavior depends on one specific user.`,
            explanation: 'Access and behavior tied to an individual account break when the person leaves or the account is renamed, differ between instances, and are invisible to anyone reviewing roles and groups. Checks against admin also grant the behavior to anyone who can log in as or impersonate that account.',
            recommendation: "Check a role (gs.hasRole('x_app.manager')) or group membership (gs.getUser().isMemberOf('...')) instead."
          });
          return;
        }
      }
    };
  }
};
