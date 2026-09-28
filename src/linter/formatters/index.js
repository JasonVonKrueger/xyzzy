import { formatJson } from './json.js';
import { formatSarif } from './sarif.js';
import { formatStylish } from './stylish.js';

export const FORMATTERS = {
  stylish: formatStylish,
  json: formatJson,
  sarif: formatSarif
};

export function getFormatter(name) {
  const formatter = FORMATTERS[name];
  if (!formatter) {
    throw new Error(`Unknown format "${name}". Use one of: ${Object.keys(FORMATTERS).join(', ')}.`);
  }
  return formatter;
}
