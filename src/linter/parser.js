import { parse } from 'acorn';

function parseAs(text, sourceType, options, comments) {
  return parse(text, {
    ecmaVersion: options.ecmaVersion ?? 'latest',
    sourceType,
    allowReturnOutsideFunction: sourceType === 'script',
    allowHashBang: true,
    locations: true,
    onComment: comments
  });
}

// ServiceNow scripts are parsed leniently: global-scope code is ES5 (Rhino) while scoped apps may use
// ES2021, and several script fields allow a bare `return` outside any function. Files that only parse
// as ES modules (ServiceNow SDK / Fluent projects) are accepted as modules.
export function parseSource(text, options = {}) {
  const comments = [];

  try {
    return { ast: parseAs(text, 'script', options, comments), comments, syntaxError: null };
  } catch (error) {
    if (!(error instanceof SyntaxError) || !error.loc) {
      throw error;
    }

    const moduleComments = [];
    try {
      return { ast: parseAs(text, 'module', options, moduleComments), comments: moduleComments, syntaxError: null };
    } catch {
      // Report the script-mode error: it is the mode ServiceNow uses for almost every script field.
    }

    return {
      ast: null,
      comments,
      syntaxError: {
        // acorn appends "(line:column)" to the message; the location is reported separately.
        message: error.message.replace(/\s*\(\d+:\d+\)$/, ''),
        line: error.loc.line,
        column: error.loc.column + 1,
        index: error.pos
      }
    };
  }
}
