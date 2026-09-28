import { runRuleTests } from '../helpers.js';

runRuleTests('PORT-002', {
  valid: [
    { name: 'property', code: "current.assignment_group = gs.getProperty('x_app.default_group');" },
    { name: 'not a sys_id', code: "var hash = 'D625DCCEC0A8016700A222A0F7900D06';\nvar short = 'd625dccec0a8016700a2';" },
    { name: 'sys_id in a comment', code: '// group d625dccec0a8016700a222a0f7900d06\nvar x = 1;' }
  ],
  invalid: [
    {
      name: 'assignment group sys_id',
      context: 'business_rule',
      code: "current.assignment_group = 'd625dccec0a8016700a222a0f7900d06';",
      findings: [{ line: 1, column: 28, severity: 'WARNING', message: /^Hardcoded sys_id 'd625dccec0a8016700a222a0f7900d06'\.$/ }]
    },
    {
      name: 'each value reported once',
      code: "var a = 'd625dccec0a8016700a222a0f7900d06';\nvar b = 'd625dccec0a8016700a222a0f7900d06';\nvar c = '8a5055c9c61122780043563ef53438e3';",
      findings: [{ line: 1 }, { line: 3 }]
    },
    {
      name: 'fix script is info',
      context: 'fix_script',
      code: "var gr = new GlideRecord('incident');\ngr.get('d625dccec0a8016700a222a0f7900d06');",
      findings: [{ severity: 'INFO', recommendation: /comment naming the record/ }]
    }
  ]
});
