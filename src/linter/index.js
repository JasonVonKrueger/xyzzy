import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { ensureResolvedConfig } from './config.js';
import { lintText } from './engine.js';
import { createDefaultRegistry } from './rules/index.js';

export { applyBaseline, createBaseline, loadBaseline, writeBaseline } from './baseline.js';
export { findConfigFile, loadConfigFile, LintConfigError, resolveConfig } from './config.js';
export { highestSeverity, lintText, summarize } from './engine.js';
export { EXECUTION_CONTEXTS } from './execution-context.js';
export { FINGERPRINT_KEY } from './fingerprint.js';
export { FORMATTERS, getFormatter } from './formatters/index.js';
export { RuleRegistry } from './rule-registry.js';
export { BUILT_IN_RULES, createDefaultRegistry } from './rules/index.js';

const SCRIPT_EXTENSIONS = new Set(['.js', '.cjs', '.mjs']);
const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', '.history']);

// Expands files and directories (recursively) into a sorted list of script files.
export function collectFiles(targets) {
  const files = new Set();

  function visit(target, explicit) {
    const stats = statSync(target);
    if (stats.isDirectory()) {
      for (const entry of readdirSync(target)) {
        if (!IGNORED_DIRECTORIES.has(entry)) {
          visit(path.join(target, entry), false);
        }
      }
    } else if (explicit || SCRIPT_EXTENSIONS.has(path.extname(target))) {
      files.add(target);
    }
  }

  for (const target of targets) {
    visit(target, true);
  }

  return [...files].sort();
}

// Lints files from disk. With `fix`, safe fixes are written back to the files.
export function lintFiles(targets, options = {}) {
  const registry = options.registry ?? createDefaultRegistry();
  const config = ensureResolvedConfig(options.config, registry);

  return collectFiles(targets).map((file) => {
    const text = readFileSync(file, 'utf8');
    const result = lintText(text, {
      file,
      context: options.context,
      record: options.record,
      config,
      registry,
      fix: options.fix
    });
    if (options.fix && result.fixesApplied > 0) {
      writeFileSync(file, result.output);
    }
    return result;
  });
}
