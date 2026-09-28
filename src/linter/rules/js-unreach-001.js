const JUMPS = new Set(['ReturnStatement', 'ThrowStatement', 'BreakStatement', 'ContinueStatement']);

// True when control never falls through to the statement after `statement`.
function terminates(statement) {
  if (JUMPS.has(statement.type)) {
    return true;
  }
  switch (statement.type) {
    case 'BlockStatement':
      return statement.body.some(terminates);
    case 'IfStatement':
      return statement.alternate !== null && terminates(statement.consequent) && terminates(statement.alternate);
    case 'TryStatement': {
      if (statement.finalizer && terminates(statement.finalizer)) {
        return true;
      }
      const handlerTerminates = !statement.handler || terminates(statement.handler.body);
      return terminates(statement.block) && handlerTerminates;
    }
    default:
      return false;
  }
}

// Hoisted declarations still take effect after a return, so they are not dead code.
function isHoistedOnly(statement) {
  return (
    statement.type === 'FunctionDeclaration' ||
    statement.type === 'EmptyStatement' ||
    (statement.type === 'VariableDeclaration' &&
      statement.kind === 'var' &&
      statement.declarations.every((declarator) => declarator.init === null))
  );
}

const DESCRIBE = {
  ReturnStatement: 'return',
  ThrowStatement: 'throw',
  BreakStatement: 'break',
  ContinueStatement: 'continue'
};

export default {
  id: 'JS-UNREACH-001',
  name: 'Unreachable code',
  category: 'correctness',
  severity: 'warning',
  description: 'Statements after a return, throw, break, or continue can never run.',
  contexts: ['any'],
  fixable: false,

  create(context) {
    function check(statements) {
      const index = statements.findIndex(terminates);
      if (index === -1) {
        return;
      }

      const dead = statements.slice(index + 1).filter((statement) => !isHoistedOnly(statement));
      if (dead.length === 0) {
        return;
      }

      const exit = statements[index];
      const how = DESCRIBE[exit.type] ? `the ${DESCRIBE[exit.type]} on line ${exit.loc.start.line}` : `line ${exit.loc.start.line}, which always exits`;
      context.report({
        loc: { start: dead[0].loc.start, end: dead[dead.length - 1].loc.end },
        message: `Unreachable code after ${how}.`,
        explanation:
          'These statements can never execute. This is usually a bug: logic placed after an early return, or a return added while debugging and never removed.',
        recommendation: 'Move the statements before the exit if they should run, otherwise delete them.'
      });
    }

    return {
      Program: (node) => check(node.body),
      BlockStatement: (node) => check(node.body),
      SwitchCase: (node) => check(node.consequent),
      StaticBlock: (node) => check(node.body)
    };
  }
};
