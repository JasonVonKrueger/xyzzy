import { runRuleTests } from '../helpers.js';

runRuleTests('JS-NAMING-001', {
  valid: [
    {
      name: 'camelCase, PascalCase, UPPER_CASE',
      code: "var IncidentUtils = Class.create();\nvar MAX_RETRIES = 3;\nfunction closeStale(grIncident, daysOpen) { var isActive = true; return isActive; }"
    },
    { name: 'underscore and dollar markers', code: 'var _private = 1; var $el = 2; function f($scope) { return $scope; }' },
    { name: 'g_ prefix convention', code: 'var g_myCache = {};' },
    { name: 'field names on records are not declarations', code: "current.assignment_group = gr.sys_id;\nvar data = { short_description: 'x' };" }
  ],
  invalid: [
    {
      name: 'snake_case variables reported once per file',
      code: "var sys_id = current.sys_id;\nfunction get_group(my_arg) { return my_arg; }",
      findings: [{
        line: 1,
        column: 5,
        severity: 'INFO',
        message: /3 names do not follow camelCase naming: sys_id \(line 1\), get_group \(line 2\), my_arg \(line 2\)\./
      }]
    },
    {
      name: 'single offender',
      code: 'var grp_name = "x";',
      findings: [{ message: /'grp_name' does not follow camelCase naming/ }]
    },
    {
      name: 'long lists are truncated',
      code: Array.from({ length: 7 }, (_, i) => `var name_${i} = ${i};`).join('\n'),
      findings: [{ message: /7 names .* and 2 more\./ }]
    }
  ]
});
