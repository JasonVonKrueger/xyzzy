import { describeUnit, unitLoc, unitsOver } from './complexity-helpers.js';

export default {
  id: 'CPLX-001',
  name: 'Function too long',
  category: 'complexity',
  severity: 'info',
  description: 'A function longer than thresholds.maxFunctionLength lines (default 75).',
  contexts: ['any'],
  fixable: false,

  create(context) {
    const limit = context.thresholds.maxFunctionLength;
    return {
      'Program:exit'() {
        for (const unit of unitsOver(context.metrics, 'length', limit, { includeTopLevel: false })) {
          context.report({
            loc: unitLoc(unit),
            message: `${describeUnit(unit)} is ${unit.length} lines long (maximum ${limit}).`,
            explanation: 'Long functions usually do several jobs at once, which makes them hard to review, test, and change safely, and tends to hide duplicated GlideRecord queries and error handling.',
            recommendation: 'Split it into smaller functions that each do one thing, for example as separate methods on the Script Include (prefix internal ones with _).'
          });
        }
      }
    };
  }
};
