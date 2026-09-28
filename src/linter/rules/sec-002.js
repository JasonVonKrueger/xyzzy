import { getPropertyName } from '../ast.js';
import { maskSecret, shannonEntropy } from './security-helpers.js';

const KNOWN_FORMATS = [
  { name: 'AWS access key', pattern: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', pattern: /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/ },
  { name: 'Slack token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'Stripe secret key', pattern: /\b[rs]k_live_[0-9a-zA-Z]{20,}/ },
  { name: 'private key', pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/ },
  { name: 'JSON Web Token', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'Basic authorization header', pattern: /^Basic [A-Za-z0-9+/]{8,}={0,2}$/ },
  { name: 'Bearer token', pattern: /^Bearer [A-Za-z0-9._~+/-]{16,}=*$/ },
  { name: 'Azure storage account key', pattern: /AccountKey=[A-Za-z0-9+/]{40,}={0,2}/ },
  { name: 'URL with embedded credentials', pattern: /^[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s:@]+@/i }
];

const SECRET_NAME = /(pass(word|wd|phrase)?|pwd|secret|token|api_?key|apikey|client_?secret|private_?key|credentials?|auth_?key|access_?key|signing_?key)$/i;

// Values that are clearly not secrets: empty, placeholders, sys_ids, sys_property and field names.
function isPlaceholder(value) {
  const trimmed = value.trim();
  return (
    trimmed.length < 4 ||
    /^(x+|\*+|\.+|<.*>|\$\{.*\}|\{\{.*\}\}|%.*%|your[_ -].*|changeme|change_me|password|secret|token|null|undefined|none|todo|tbd|n\/a)$/i.test(trimmed) ||
    /^[0-9a-f]{32}$/.test(trimmed) ||
    /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(trimmed) ||
    /^[a-z]+(_[a-z0-9]+)+$/.test(trimmed) ||
    /\s{2,}/.test(trimmed)
  );
}

// The name a string literal is stored under (secret names must end in the secret word, so
// passwordField or tokenUrl do not match): `var apiKey = '...'`, `cfg.password = '...'`, `{ token: '...' }`.
function targetName(literal) {
  const parent = literal.parent;
  if (parent.type === 'VariableDeclarator' && parent.init === literal && parent.id.type === 'Identifier') {
    return parent.id.name;
  }
  if (parent.type === 'AssignmentExpression' && parent.right === literal) {
    return parent.left.type === 'Identifier' ? parent.left.name : parent.left.type === 'MemberExpression' ? getPropertyName(parent.left) : null;
  }
  if (parent.type === 'Property' && parent.value === literal) {
    return parent.key.type === 'Identifier' ? parent.key.name : typeof parent.key.value === 'string' ? parent.key.value : null;
  }
  return null;
}

// setBasicAuth(user, 'pw'), setRequestHeader('Authorization', '...'), setMutualAuth / setPassword('pw').
function credentialArgument(literal) {
  const call = literal.parent;
  if (call.type !== 'CallExpression' || call.callee.type !== 'MemberExpression') {
    return null;
  }
  const method = getPropertyName(call.callee);
  const index = call.arguments.indexOf(literal);
  if (method === 'setBasicAuth' && index === 1) {
    return 'setBasicAuth() password';
  }
  if (method === 'setPassword' && index === 0) {
    return 'setPassword() value';
  }
  const header = call.arguments[0];
  if ((method === 'setRequestHeader' || method === 'setHeader') && index === 1 && /^(authorization|x-api-key|api-key)$/i.test(header?.value ?? '')) {
    return `${header.value} header`;
  }
  return null;
}

export default {
  id: 'SEC-002',
  name: 'Hardcoded secret',
  category: 'security',
  severity: 'error',
  description: 'Passwords, API keys, tokens, and private keys written into a script (known token formats, secret-named variables, setBasicAuth/Authorization header literals).',
  contexts: ['any'],
  fixable: false,

  create(context) {
    const client = context.execution.side === 'client';

    function report(node, what, value, confidence) {
      context.report({
        node,
        redact: node,
        confidence,
        message: `Hardcoded ${what}: ${maskSecret(value)}.`,
        explanation: `Script fields are stored in plain text, copied into update sets, clones, and source control, and are readable by every admin and anyone with access to the record${client ? '. This script runs in the browser, so every user who opens the page can read it' : ''}. A leaked credential stays valid until someone notices and rotates it.`,
        recommendation: 'Rotate this credential now, then store it outside the script: a Basic Auth or OAuth profile / Credential record for outbound calls (setAuthenticationProfile), or a password2 system property read with gs.getProperty().'
      });
    }

    function check(node, value) {
      if (!value || isPlaceholder(value)) {
        return;
      }
      const known = KNOWN_FORMATS.find((format) => format.pattern.test(value));
      if (known) {
        report(node, known.name, value, 0.95);
        return;
      }
      const credential = credentialArgument(node);
      if (credential) {
        report(node, credential, value, 0.9);
        return;
      }
      const name = targetName(node);
      if (name && SECRET_NAME.test(name) && shannonEntropy(value) >= 2) {
        report(node, `value in '${name}'`, value, 0.85);
      }
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string') {
          check(node, node.value);
        }
      },
      TemplateLiteral(node) {
        if (node.expressions.length === 0) {
          check(node, node.quasis[0].value.cooked ?? '');
        }
      }
    };
  }
};
