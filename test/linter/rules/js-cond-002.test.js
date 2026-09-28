import { runRuleTests } from '../helpers.js';

runRuleTests('JS-COND-002', {
  valid: [
    { name: 'comparison', code: 'if (gr.state == 7) { close(); }' },
    { name: 'explicitly compared assignment', code: 'while ((match = pattern.exec(text)) !== null) { use(match); }' },
    { name: 'assignment in the loop body', code: 'while (gr.next()) { gr.state = 7; }' },
    { name: 'double parentheses mark an intentional assignment', code: 'if ((match = text.match(/^a/))) { use(match); }\nwhile ( (node = node.next) ) { visit(node); }' }
  ],
  invalid: [
    {
      name: 'GlideRecord field assignment in if',
      code: "if (gr.state = 7) {\n  gr.update();\n}",
      findings: [{ line: 1, column: 5, severity: 'ERROR', confidence: 0.95, message: /'gr\.state = 7' used as a condition\. Did you mean 'gr\.state == 7'\?/, explanation: /saved by the next update\(\)/ }]
    },
    {
      name: 'assignment inside a logical condition',
      code: "if (active && (priority = 1)) { escalate(); }",
      findings: [{ message: /'priority = 1'/ }]
    },
    {
      name: 'ternary',
      code: 'var label = (x = 2) ? "a" : "b";',
      findings: [{ severity: 'ERROR' }]
    },
    {
      name: 'while loop idiom is only a WARNING',
      code: 'while (node = node.next) { visit(node); }',
      findings: [{ severity: 'WARNING', confidence: 0.6 }]
    }
  ]
});
