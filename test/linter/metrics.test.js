import assert from 'node:assert/strict';
import test from 'node:test';

import { lintText } from '../../src/linter/index.js';

const SCRIPT_INCLUDE = `var IncidentUtils = Class.create();
IncidentUtils.prototype = {
    initialize: function () {},

    closeStale: function (days, limit) {
        var gr = new GlideRecord('incident');
        gr.addQuery('active', true);
        gr.query();
        while (gr.next()) {
            if (gr.state == 1 && days > 5) {
                gr.state = 7;
                gr.update();
            } else if (gr.state == 2 || gr.priority == 1) {
                for (var i = 0; i < limit; i++) {
                    try {
                        notify(gr);
                    } catch (e) {
                        gs.error(e);
                    }
                }
            }
        }
        var rm = new sn_ws.RESTMessageV2('Notify', 'post');
        return days ? rm.execute() : null;
    },

    type: 'IncidentUtils'
};`;

test('computes per-function complexity, nesting, length, and parameters', () => {
  const { metrics } = lintText(SCRIPT_INCLUDE);
  const closeStale = metrics.functions.find((unit) => unit.name === 'closeStale');

  // 1 + while + if + && + else-if + || + for + catch + ternary
  assert.equal(closeStale.complexity, 9);
  // while > if/else-if (one level) > for > try
  assert.equal(closeStale.maxNestingDepth, 4);
  assert.equal(closeStale.column, 17);
  // The try statement is the first to reach depth 4 (while > else-if branch > for > try).
  assert.deepEqual([closeStale.maxNestingLine, closeStale.maxNestingColumn], [15, 21]);
  assert.equal(closeStale.parameters, 2);
  assert.equal(closeStale.line, 5);
  assert.equal(closeStale.length, 21);

  assert.deepEqual(
    metrics.functions.map((unit) => unit.name),
    ['(top level)', 'initialize', 'closeStale']
  );
});

test('computes file totals including database and external calls', () => {
  const { metrics } = lintText(SCRIPT_INCLUDE);

  assert.equal(metrics.lines, 28);
  assert.deepEqual(metrics.totals, {
    functions: 2,
    loops: 2,
    branches: 4,
    databaseOperations: 2,
    externalCalls: 1,
    maxComplexity: 9,
    maxNestingDepth: 4
  });
});

test('Map.get and other non-GlideRecord calls are not database operations', () => {
  const { metrics } = lintText('var cache = new Map(); cache.get("a"); cache.update && cache.update();');

  assert.equal(metrics.totals.databaseOperations, 0);
});
