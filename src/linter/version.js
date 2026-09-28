import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const TOOL_NAME = 'sn-lint';
export const TOOL_VERSION = require('../../package.json').version;
