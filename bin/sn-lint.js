#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import {
  applyBaseline,
  createBaseline,
  createDefaultRegistry,
  EXECUTION_CONTEXTS,
  findConfigFile,
  getFormatter,
  lintFiles,
  loadBaseline,
  loadConfigFile,
  resolveConfig,
  summarize,
  writeBaseline
} from '../src/linter/index.js';

const USAGE = `Usage: sn-lint [options] <file|directory>...

Lints ServiceNow JavaScript (Business Rules, Script Includes, Client Scripts, ...).

Options:
  -f, --format <name>     stylish (default), json, or sarif
  -c, --config <path>     config file (default: .snlintrc.json in the current directory)
      --context <name>    execution context for every file, e.g. business_rule, client_script
      --when <when>       Business Rule timing for every file: before, after, async, or display
      --table <name>      table the scripts run on (e.g. incident), for rules that compare tables
      --fix               apply safe automatic fixes (formatting only) and write them to disk
  -o, --output <path>     write the report to a file instead of stdout
      --max-warnings <n>  exit with code 1 when there are more than n warnings
      --baseline <path>   hide findings recorded in this baseline file; only new findings count
      --write-baseline <path>
                          record the current findings as the baseline and exit 0
      --list-rules        print the available rules and exit
      --list-contexts     print the available execution contexts and exit
  -h, --help              show this help

Exit codes: 0 = no errors, 1 = errors (or too many warnings), 2 = usage or configuration problem.
Run from the repository root: finding fingerprints (SARIF, baselines) use paths relative to it.
`;

function listRules(registry) {
  return registry
    .all()
    .map((rule) => {
      const fix = rule.fixable ? 'AUTO_FIXABLE' : 'MANUAL_REVIEW';
      return `${rule.id.padEnd(16)} ${rule.severity.toUpperCase().padEnd(8)} ${fix.padEnd(14)} ${(rule.contexts.join(',') + (rule.excludeContexts ? ` -${rule.excludeContexts.join(',-')}` : '')).padEnd(17)} ${rule.name}`;
    })
    .join('\n');
}

function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      format: { type: 'string', short: 'f', default: 'stylish' },
      config: { type: 'string', short: 'c' },
      context: { type: 'string' },
      when: { type: 'string' },
      table: { type: 'string' },
      fix: { type: 'boolean', default: false },
      output: { type: 'string', short: 'o' },
      'max-warnings': { type: 'string' },
      baseline: { type: 'string' },
      'write-baseline': { type: 'string' },
      'list-rules': { type: 'boolean', default: false },
      'list-contexts': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false }
    }
  });

  const registry = createDefaultRegistry();

  if (values.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (values['list-rules']) {
    process.stdout.write(`${listRules(registry)}\n`);
    return 0;
  }
  if (values['list-contexts']) {
    const lines = Object.entries(EXECUTION_CONTEXTS).map(([name, { side, label }]) => `${name.padEnd(22)} ${side.padEnd(8)} ${label}`);
    process.stdout.write(`${lines.join('\n')}\n`);
    return 0;
  }
  if (positionals.length === 0) {
    process.stderr.write(USAGE);
    return 2;
  }

  let maxWarnings = Infinity;
  if (values['max-warnings'] !== undefined) {
    maxWarnings = Number(values['max-warnings']);
    if (!Number.isInteger(maxWarnings) || maxWarnings < 0) {
      throw new Error('--max-warnings must be a non-negative integer.');
    }
  }

  const format = getFormatter(values.format);
  const configPath = values.config ?? findConfigFile(process.cwd());
  const config = resolveConfig(configPath ? loadConfigFile(configPath) : {}, registry);
  for (const warning of config.warnings) {
    process.stderr.write(`sn-lint: warning: ${warning}\n`);
  }

  const linted = lintFiles(positionals, {
    config,
    context: values.context,
    record: { table: values.table, when: values.when },
    fix: values.fix,
    registry
  });

  if (values['write-baseline']) {
    const baseline = createBaseline(linted);
    writeBaseline(values['write-baseline'], baseline);
    const count = Object.values(baseline.findings).reduce((sum, entry) => sum + entry.count, 0);
    process.stderr.write(`sn-lint: wrote baseline with ${count} findings to ${values['write-baseline']}.\n`);
    return 0;
  }

  let results = linted;
  if (values.baseline) {
    const applied = applyBaseline(linted, loadBaseline(values.baseline));
    results = applied.results;
    if (applied.stale > 0) {
      process.stderr.write(
        `sn-lint: ${applied.stale} baseline ${applied.stale === 1 ? 'entry no longer occurs' : 'entries no longer occur'} (fixed?). Refresh it with --write-baseline.\n`
      );
    }
  }

  const report = format(results, { registry, cwd: process.cwd() });

  if (values.output) {
    writeFileSync(values.output, report);
  } else {
    process.stdout.write(report);
  }

  const summary = summarize(results);
  return summary.error > 0 || summary.warning > maxWarnings ? 1 : 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`sn-lint: ${error.message}\n`);
  process.exitCode = 2;
}
