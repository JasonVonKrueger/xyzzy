import { runRuleTests } from '../helpers.js';

runRuleTests('JS-NAMING-002', {
  valid: [
    { name: 'loop counters', code: 'for (var i = 0; i < 3; i++) { for (let j in obj) {} }\nfor (const k of list) {}' },
    { name: 'catch parameter', code: 'try { run(); } catch (e) { gs.error("x: " + e.message); }' },
    { name: 'callback parameters', code: 'list.sort(function (a, b) { return a - b; });\nlist.map((x) => x * 2);' },
    { name: 'underscore', code: 'var _ = helper();' }
  ],
  invalid: [
    {
      name: 'single-letter GlideRecord and parameters',
      code: "function close(t, s) {\n  var g = new GlideRecord('task');\n  return g;\n}",
      findings: [{ line: 1, column: 16, severity: 'INFO', message: /3 single-character names: t \(line 1\), s \(line 1\), g \(line 2\)/ }]
    },
    {
      name: 'single offender',
      code: 'var x = getTotal();',
      findings: [{ message: /Single-character name 'x'/ }]
    }
  ]
});
