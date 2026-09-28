import { ENTRY_POINT_FUNCTIONS } from '../known-globals.js';
import { describeUnit, unitLoc, unitsOver } from './complexity-helpers.js';

export default {
  id: 'CPLX-005',
  name: 'Too many parameters',
  category: 'complexity',
  severity: 'info',
  description: 'A function with more parameters than thresholds.maxParameters (default 5). Platform entry points are exempt.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    const limit = context.thresholds.maxParameters;
    return {
      'Program:exit'() {
        for (const unit of unitsOver(context.metrics, 'parameters', limit, { includeTopLevel: false })) {
          // The platform fixes these signatures (onCellEdit, executeRule, ...).
          if (ENTRY_POINT_FUNCTIONS.has(unit.name)) {
            continue;
          }
          context.report({
            loc: unitLoc(unit),
            message: `${describeUnit(unit)} takes ${unit.parameters} parameters (maximum ${limit}).`,
            explanation: 'Long parameter lists are easy to call with arguments in the wrong order, and every new option changes every caller.',
            recommendation: 'Pass a single options object ({ table: ..., limit: ..., notify: ... }), or split the function by responsibility.'
          });
        }
      }
    };
  }
};
