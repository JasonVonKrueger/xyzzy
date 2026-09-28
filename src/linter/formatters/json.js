import { summarize } from '../engine.js';
import { TOOL_NAME, TOOL_VERSION } from '../version.js';

export function formatJson(results) {
  return `${JSON.stringify(
    {
      tool: { name: TOOL_NAME, version: TOOL_VERSION },
      summary: summarize(results),
      results: results.map(({ output, ...result }) => result)
    },
    null,
    2
  )}\n`;
}
