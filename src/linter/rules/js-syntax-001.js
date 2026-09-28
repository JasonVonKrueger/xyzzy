export const SYNTAX_RULE_ID = 'JS-SYNTAX-001';

// Reported by the engine when parsing fails (no visitors). Registered so it can be configured and
// appears in SARIF rule metadata like any other rule.
export default {
  id: SYNTAX_RULE_ID,
  name: 'Invalid syntax',
  category: 'correctness',
  severity: 'error',
  description: 'The script cannot be parsed as JavaScript.',
  contexts: ['any'],
  fixable: false,
  engine: true
};
