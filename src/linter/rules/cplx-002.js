export default {
  id: 'CPLX-002',
  name: 'File too long',
  category: 'complexity',
  severity: 'info',
  description: 'A script longer than thresholds.maxFileLength lines (default 500).',
  contexts: ['any'],
  fixable: false,

  create(context) {
    const limit = context.thresholds.maxFileLength;
    return {
      'Program:exit'() {
        const { lines, totals } = context.metrics;
        if (lines <= limit) {
          return;
        }
        const start = { line: 1, column: 0 };
        context.report({
          loc: { start, end: start },
          message: `Script is ${lines} lines long (maximum ${limit}), with ${totals.functions} function${totals.functions === 1 ? '' : 's'}.`,
          explanation: 'A very long Business Rule or Script Include is usually several responsibilities in one record. Every change then touches (and risks) all of them, and update-set conflicts become more likely.',
          recommendation: 'Move independent parts into separate Script Includes, and keep Business Rules thin: a condition plus a call into a Script Include.'
        });
      }
    };
  }
};
