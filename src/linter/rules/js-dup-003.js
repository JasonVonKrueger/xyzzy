function caseKey(test, sourceCode) {
  if (test.type === 'Literal' && !test.regex) {
    return `literal:${typeof test.value}:${String(test.value)}`;
  }
  return `code:${sourceCode.getText(test).replace(/\s+/g, '')}`;
}

export default {
  id: 'JS-DUP-003',
  name: 'Duplicate case label',
  category: 'correctness',
  severity: 'warning',
  description: 'A switch statement has two case labels with the same value; the second can never match.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    return {
      SwitchStatement(node) {
        const seen = new Map();

        for (const switchCase of node.cases) {
          if (!switchCase.test) {
            continue;
          }
          const key = caseKey(switchCase.test, context.sourceCode);
          if (seen.has(key)) {
            context.report({
              node: switchCase.test,
              message: `Duplicate case ${context.sourceCode.getText(switchCase.test)}; the case on line ${seen.get(key)} always matches first.`,
              explanation: 'switch stops at the first matching case, so the code under this label never runs for that value.',
              recommendation: 'Merge the two cases, or fix the label if it was meant to be a different value (a copy-paste slip is typical).'
            });
          } else {
            seen.set(key, switchCase.test.loc.start.line);
          }
        }
      }
    };
  }
};
