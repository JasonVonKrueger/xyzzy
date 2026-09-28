import { runRuleTests } from '../helpers.js';

runRuleTests('JS-ERR-005', {
  valid: [
    { name: 'catch at the end', code: "$http.get('/api/now/table/incident').then(function (r) { c.data = r.data; }).catch(function (e) { spUtil.addErrorMessage(e); });" },
    { name: 'then with a rejection handler', code: 'fetch(url).then(ok, fail);' },
    { name: 'returned promise is the caller\'s to handle', code: 'function load() { return $http.get(url).then(parse); }' },
    { name: 'assigned promise', code: 'var p = fetch(url).then(parse);' },
    { name: 'catch before finally', code: 'fetch(url).then(parse).catch(report).finally(done);' }
  ],
  invalid: [
    {
      name: 'then without catch',
      code: "api.controller = function ($http) {\n  $http.get('/api/x').then(function (r) { c.data = r.data; });\n};",
      findings: [{ line: 2, column: 3, severity: 'WARNING', confidence: 0.8, message: /no rejection handler/ }]
    },
    {
      name: 'finally without catch',
      code: 'fetch(url).then(parse).finally(done);',
      findings: [{ line: 1 }]
    }
  ]
});
