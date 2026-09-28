import { describeUnit, unitLoc, unitsOver } from './complexity-helpers.js';

export default {
  id: 'CPLX-003',
  name: 'Cyclomatic complexity too high',
  category: 'complexity',
  severity: 'warning',
  description: 'A function (or the top-level code) with more decision points than thresholds.maxComplexity (default 10).',
  contexts: ['any'],
  fixable: false,

  create(context) {
    const limit = context.thresholds.maxComplexity;
    return {
      'Program:exit'() {
        for (const unit of unitsOver(context.metrics, 'complexity', limit)) {
          context.report({
            loc: unitLoc(unit),
            message: `${describeUnit(unit)} has a cyclomatic complexity of ${unit.complexity} (maximum ${limit}).`,
            explanation: `There are ${unit.complexity} independent paths through this code (each if, loop, case, catch, ternary, &&, and || adds one). Each path needs its own test, and a change on one path easily breaks another.`,
            recommendation: 'Extract branches into well-named helper functions, return early for guard conditions, and replace long if/else or switch chains with a lookup object.'
          });
        }
      }
    };
  }
};
