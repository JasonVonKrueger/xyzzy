import { describeUnit, unitsOver } from './complexity-helpers.js';

export default {
  id: 'CPLX-004',
  name: 'Nesting too deep',
  category: 'complexity',
  severity: 'warning',
  description: 'Blocks (if, loops, switch, try) nested deeper than thresholds.maxNestingDepth (default 4).',
  contexts: ['any'],
  fixable: false,

  create(context) {
    const limit = context.thresholds.maxNestingDepth;
    return {
      'Program:exit'() {
        for (const unit of unitsOver(context.metrics, 'maxNestingDepth', limit)) {
          const start = { line: unit.maxNestingLine, column: unit.maxNestingColumn - 1 };
          context.report({
            loc: { start, end: start },
            message: `${describeUnit(unit)} nests blocks ${unit.maxNestingDepth} levels deep (maximum ${limit}).`,
            explanation: 'Deeply nested code, typically a while (gr.next()) inside an if inside a loop, is hard to follow and usually hides a query in a loop or a missing early return.',
            recommendation: 'Return or continue early instead of wrapping the rest in an if, and move the inner loop body into its own function.'
          });
        }
      }
    };
  }
};
