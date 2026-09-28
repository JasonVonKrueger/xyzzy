const MAX_SNIPPET_LENGTH = 160;

export class SourceCode {
  constructor(text, ast = null, comments = []) {
    this.text = text;
    this.ast = ast;
    this.comments = comments;
    this.lines = text.split(/\r\n|\r|\n/);
  }

  getText(node) {
    return this.text.slice(node.start, node.end);
  }

  // 1-based line number.
  getLine(line) {
    return this.lines[line - 1] ?? '';
  }

  // The `code` shown with a finding: the trimmed source line where it starts. `redact` (a node) is
  // replaced by a placeholder where it overlaps that line, so secrets never reach reports.
  getSnippet(line, redact = null) {
    let lineText = this.getLine(line);
    if (redact && redact.loc.start.line <= line && redact.loc.end.line >= line) {
      const from = redact.loc.start.line === line ? redact.loc.start.column : 0;
      const to = redact.loc.end.line === line ? redact.loc.end.column : lineText.length;
      lineText = `${lineText.slice(0, from)}'<redacted>'${lineText.slice(to)}`;
    }
    lineText = lineText.trim();
    return lineText.length > MAX_SNIPPET_LENGTH ? `${lineText.slice(0, MAX_SNIPPET_LENGTH - 3)}...` : lineText;
  }
}
