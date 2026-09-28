import { getCalleeName, getFunctionName, getMemberChain, getPropertyName, isFunctionNode, traverse } from './ast.js';

const GLIDE_DB_CLASSES = new Set(['GlideRecord', 'GlideRecordSecure', 'GlideAggregate']);
const DB_METHODS = new Set([
  'query',
  'get',
  'insert',
  'update',
  'updateMultiple',
  'deleteRecord',
  'deleteMultiple'
]);
const EXTERNAL_CLASSES = new Set([
  'RESTMessageV2',
  'sn_ws.RESTMessageV2',
  'SOAPMessageV2',
  'sn_ws.SOAPMessageV2',
  'GlideHTTPRequest'
]);

const LOOP_TYPES = new Set(['ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement']);
const NESTING_TYPES = new Set([...LOOP_TYPES, 'IfStatement', 'SwitchStatement', 'TryStatement', 'WithStatement']);
const BRANCH_TYPES = new Set(['IfStatement', 'ConditionalExpression', 'SwitchCase', 'CatchClause']);
const LOGICAL_OPERATORS = new Set(['&&', '||', '??']);

// `else if` continues the same level of nesting rather than adding one.
function isElseIf(node) {
  return node.type === 'IfStatement' && node.parent?.type === 'IfStatement' && node.parent.alternate === node;
}

// Cyclomatic complexity counts one per decision point: branches, loops, non-default switch cases,
// catch clauses, and short-circuit operators.
function addsComplexity(node) {
  if (node.type === 'SwitchCase') {
    return node.test !== null;
  }
  if (node.type === 'LogicalExpression') {
    return LOGICAL_OPERATORS.has(node.operator);
  }
  return BRANCH_TYPES.has(node.type) || LOOP_TYPES.has(node.type);
}

function newUnit(name, node, lineCount) {
  return {
    name,
    line: node.loc.start.line,
    column: node.loc.start.column + 1,
    endLine: node.type === 'Program' ? lineCount : node.loc.end.line,
    length: node.type === 'Program' ? lineCount : node.loc.end.line - node.loc.start.line + 1,
    parameters: node.params?.length ?? 0,
    complexity: 1,
    maxNestingDepth: 0,
    // Where the deepest nesting starts (the statement that first reaches maxNestingDepth).
    maxNestingLine: null,
    maxNestingColumn: null,
    depth: 0
  };
}

// Per-function and per-file metrics. The top level of the script is reported as its own unit because
// many ServiceNow scripts (fix scripts, scheduled jobs) have most of their logic outside any function.
export function computeMetrics(ast, sourceCode) {
  const lineCount = sourceCode.lines.length;
  const topLevel = newUnit('(top level)', ast, lineCount);
  const units = [topLevel];
  const stack = [topLevel];
  const glideRecordNames = new Set();

  const totals = { loops: 0, branches: 0, databaseOperations: 0, externalCalls: 0 };

  traverse(ast, {
    enter(node) {
      const unit = stack[stack.length - 1];

      if (isFunctionNode(node)) {
        const functionUnit = newUnit(getFunctionName(node), node, lineCount);
        units.push(functionUnit);
        stack.push(functionUnit);
        return;
      }

      if (addsComplexity(node)) {
        unit.complexity += 1;
      }
      if (LOOP_TYPES.has(node.type)) {
        totals.loops += 1;
      }
      if (BRANCH_TYPES.has(node.type) && !(node.type === 'SwitchCase' && node.test === null)) {
        totals.branches += 1;
      }
      if (NESTING_TYPES.has(node.type) && !isElseIf(node)) {
        unit.depth += 1;
        if (unit.depth > unit.maxNestingDepth) {
          unit.maxNestingDepth = unit.depth;
          unit.maxNestingLine = node.loc.start.line;
          unit.maxNestingColumn = node.loc.start.column + 1;
        }
      }

      if (node.type === 'NewExpression') {
        const className = getCalleeName(node);
        if (GLIDE_DB_CLASSES.has(className)) {
          const target = node.parent?.type === 'VariableDeclarator' ? node.parent.id : node.parent?.left;
          const targetName = target ? getMemberChain(target) : null;
          if (targetName) {
            glideRecordNames.add(targetName);
          }
        } else if (EXTERNAL_CLASSES.has(className)) {
          totals.externalCalls += 1;
        }
      }

      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
        const receiver = getMemberChain(node.callee.object);
        if (receiver && glideRecordNames.has(receiver) && DB_METHODS.has(getPropertyName(node.callee))) {
          totals.databaseOperations += 1;
        }
      }
    },
    leave(node) {
      if (isFunctionNode(node)) {
        stack.pop();
        return;
      }
      if (NESTING_TYPES.has(node.type) && !isElseIf(node)) {
        stack[stack.length - 1].depth -= 1;
      }
    }
  });

  const functions = units.map(({ depth, ...unit }) => unit);

  return {
    lines: lineCount,
    functions,
    totals: {
      functions: functions.length - 1,
      ...totals,
      maxComplexity: Math.max(...functions.map((unit) => unit.complexity)),
      maxNestingDepth: Math.max(...functions.map((unit) => unit.maxNestingDepth))
    }
  };
}
