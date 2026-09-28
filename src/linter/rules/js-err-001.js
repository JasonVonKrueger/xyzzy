export default {
  id: 'JS-ERR-001',
  name: 'Empty catch block',
  category: 'error-handling',
  severity: 'warning',
  description: 'A catch block is empty, so failures disappear without a trace.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    return {
      CatchClause(node) {
        const body = node.body;
        if (body.body.length > 0) {
          return;
        }
        // A comment inside the block documents that ignoring the error is deliberate.
        if (context.sourceCode.comments.some((comment) => comment.start > body.start && comment.end < body.end)) {
          return;
        }

        context.report({
          loc: { start: node.loc.start, end: body.loc.start },
          message: 'Empty catch block swallows the exception.',
          explanation:
            'When the try block fails, nothing is logged and execution continues as if it succeeded. In ServiceNow this typically shows up later as half-updated records or integrations that "silently stopped working", with nothing in the system log to explain why.',
          recommendation:
            "Log the failure with context (gs.error('<what failed> for ' + id + ': ' + e.message, '<source>')), rethrow it, or add a comment explaining why ignoring it is safe."
        });
      }
    };
  }
};
