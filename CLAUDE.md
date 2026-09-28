# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

SPIE (ServiceNow Platform Intelligence Engine) is a Node.js (>=18, ESM, plain JavaScript) stdio MCP server that exposes a ServiceNow instance's Table API to MCP clients (e.g. Claude Desktop) using OAuth 2.0. It also contains `sn-lint`, a ServiceNow-aware JavaScript linter (see below). Dependencies: `@modelcontextprotocol/sdk`, `zod`, `dotenv`, `acorn` (linter parser).

## Commands

- `npm install` — install dependencies
- `npm start` — run the server on stdio (`node src/index.js`); it is meant to be launched by an MCP client, not used interactively
- `npm test` — run all tests (`node --test`, built-in Node test runner)
- Single file: `node --test test/tools.test.js`
- Single test by name: `node --test --test-name-pattern="rejects tables outside" test/tools.test.js`

- `npm run lint:sn -- <files|dirs>` — run the ServiceNow script linter (`node bin/sn-lint.js`; `--help` for options)

There is no linter for this repo's own code and no build step. `.env.example` is the template for `.env`; `.env` is gitignored and holds real credentials. Keep `.env.example` in sync when adding config variables.

## Architecture

Request flow: `src/index.js` (stdio transport) → `src/server.js` (`McpServer`) → `src/tools/index.js` (registers tools) → `runtime.execute()` → `ServiceNowClient` → `ServiceNowOAuthClient`.

- **Lazy config/validation ([src/runtime.js](src/runtime.js))**: the server deliberately does *not* read `.env` or contact ServiceNow at startup. On the first tool call, `runtime.validate()` loads config, builds the auth + API clients, and does a `testConnection()` (GET `sys_user` limit 1); the result is cached for the process lifetime and concurrent first calls share one in-flight promise. `execute(operation)` catches `AuthError` (raised on HTTP 401), invalidates cached tokens, revalidates, and retries the operation exactly once.
- **Config ([src/config.js](src/config.js))**: reads `.env` from `process.cwd()` (not the project dir — the Claude Desktop config does `cd <project> && npm start` for this reason), merged with `process.env` (`.env` values win). Required variables depend on `SERVICENOW_OAUTH_GRANT_TYPE` (`client_credentials`, `password`, `authorization_code`, `refresh_token`, `interactive`).
- **Auth ([src/auth.js](src/auth.js))**: caches token state in memory, refreshes 60s before expiry, and prefers a held refresh token over re-running the configured grant. Posts to `/oauth_token.do`. The `interactive` grant ([src/interactive-login.js](src/interactive-login.js)) does browser sign-in (authorization code + PKCE, loopback redirect listener, tokens in memory only). A sign-in still pending after ~45s throws `SignInRequiredError` (deliberately *not* an `AuthError`, so `runtime.execute` does not retry and re-open the browser); the pending login is reused on the next call.
- **API client ([src/servicenow-client.js](src/servicenow-client.js))**: thin wrapper over `/api/now/table/...` (query, get by sys_id, create via POST, update via PATCH). `fetch` is injectable for tests. 401 → `AuthError`; other non-2xx → `ServiceNowApiError`.
- **Errors ([src/errors.js](src/errors.js))**: `ConfigError`, `AuthError`, `ServiceNowApiError`, and `toToolErrorResult()`, which maps them to MCP `isError` results. Unknown errors are intentionally reduced to a generic message.
- **Tools ([src/tools/](src/tools/))**: one file per tool (`query_table_records`, `get_record_by_sys_id`, `create_record`, `update_record`), each exporting a `register*Tool(server, executeTool)` function using `server.tool(name, description, zodShape, handler)`. Handlers wrap work in the shared `executeTool` from `tools/index.js`, which runs it through the runtime and formats via `results.js` (`displayText` in a payload overrides the JSON text output; `isError: true` in a payload yields an MCP error result).

- **`analyze_syslog`** ([src/tools/analyze-syslog.js](src/tools/analyze-syslog.js)): read-only analysis of `syslog` warnings/errors. Dates are parsed by [syslog-date-range.js](src/tools/syslog-date-range.js) (natural language, US month-first, current year assumed, 14-day inclusive UTC cap enforced before any network call); [syslog-analysis.js](src/tools/syslog-analysis.js) holds the pure pattern/category/spike analysis. Records are fetched one day at a time (1,500 newest-first per day; days that hit the cap are reported), and a 403 is rethrown with a hint about read access and the Table API auth scope. The table is hardcoded and only `queryTableRecords` is called; keep `syslog` out of `ALLOWED_CRUD_TABLES`.

### Write-path guardrails

- **Table allowlist**: `create_record` and `update_record` refuse any table not in `ALLOWED_CRUD_TABLES` ([src/tools/allowed-crud-tables.js](src/tools/allowed-crud-tables.js)) and return the allowed list in the error. The check happens *before* `executeTool`, so no auth/network happens for rejected tables. Read tools are not restricted. Extend the allowlist there when adding a writable table (tests assert every allowlisted table appears in the rejection message).
- **Script Include duplicate detection** ([src/tools/script-include-recommendations.js](src/tools/script-include-recommendations.js)): for `sys_script_include` create (and update when `fields.script` is set), the tool extracts function names from the script (plus optional `requestedFunctionNames`), queries existing Script Includes with `scriptLIKE…` encoded queries, and scores names (exact 100, normalized 95, else edit-distance similarity; threshold 85). Any match returns an error result with a markdown table and **does not write** to ServiceNow. On update, the record being edited is excluded via `excludeSysIds`.

## ServiceNow linter (`sn-lint`)

Lives in [src/linter/](src/linter/) with the CLI in [bin/sn-lint.js](bin/sn-lint.js); it is independent of the MCP server code. Full docs, including how to write a rule and the phase roadmap, are in [docs/linter/README.md](docs/linter/README.md).

- Pipeline ([engine.js](src/linter/engine.js)): acorn parse → `analyzeScopes` ([scope.js](src/linter/scope.js): per-scope declarations with hoisting, references resolved with read/write flags, unresolved globals) → execution context (explicit > folder name > code inference, [execution-context.js](src/linter/execution-context.js)) → one AST traversal dispatching to each applicable rule's visitor map → findings (severity from config, confidence caps, suppression comments) → metrics → optional fixes.
- Rules are one file each in [src/linter/rules/](src/linter/rules/), registered in `rules/index.js`, and validated by [rule-registry.js](src/linter/rule-registry.js). Only the `formatting` category may be `fixable`, and [fixer.js](src/linter/fixer.js) discards fixes unless the fixed code parses to an identical AST. Keep both guarantees.
- An ERROR below `errorConfidenceThreshold` (0.8) becomes a WARNING. Findings from side-specific rules are capped at the context-inference confidence.
- GlideRecord data flow lives in [glide-record.js](src/linter/glide-record.js) (instances bound to variables, ordered calls, filter strength none/weak/static/unknown, loop detection); rules read it lazily via `context.glideRecords`, computed once per pass. The generic tracker is `trackInstances()`; [glide-ajax.js](src/linter/glide-ajax.js) uses it for `context.glideAjax` and [outbound.js](src/linter/outbound.js) for `context.outbound` (RESTMessageV2/SOAPMessageV2 and their responses). New shared analyses go through the `analysis(key, fn)` helper in `createRuleContext`; `context.metrics` (metrics.js) is one of them and is the same object returned as the result's `metrics`, which the CPLX-* rules compare with `config.thresholds`. Rules may set `excludeContexts` (the SN-GR rules exclude `client`).
- Record metadata that is not in the script (Business Rule `when`, table) comes in through lintText's `record` option / the CLI's `--when`/`--table`, validated in `engine.js`, and reaches rules as `execution.record` (`{ table, when }`, null when unknown). Rules that depend on it must stay silent without it.
- A finding's `code` snippet is the raw source line; rules reporting sensitive values pass `redact: node` to `context.report()` (SEC-002 does), and must also mask the value in the message.
- Every finding gets a `fingerprint` ([fingerprint.js](src/linter/fingerprint.js): rule + cwd-relative path + normalized code line + occurrence index, no line numbers) used by SARIF `partialFingerprints` and by baselines ([baseline.js](src/linter/baseline.js), CLI `--baseline`/`--write-baseline`). Changing what goes into the hash invalidates every user's baseline; avoid it or bump `FINGERPRINT_KEY`'s version.
- ServiceNow API knowledge (server-only vs client-only globals) lives in [servicenow-apis.js](src/linter/servicenow-apis.js); injected/known globals, entry-point function names, and logging-call detection in [known-globals.js](src/linter/known-globals.js).
- Inside a rule, search subtrees with `walk()` from `ast.js`, never `traverse()` (which rewrites parent pointers mid-traversal).
- Each built-in rule needs `test/linter/rules/<rule-id-lowercase>.test.js` (enforced by a meta-test); use `runRuleTests` from `test/linter/helpers.js`. Add a `valid` case for every false positive found.

## Testing notes

Tests in `test/` use no network: tools are tested by passing a fake `server` (capturing the `server.tool` handler) and a stub `executeTool`/client; runtime and auth accept injected factories/`fetchImpl` (`configLoader`, `authFactory`, `clientFactory` options in `createServiceNowRuntime`).

## Other

- [docs/tools/](docs/tools/) has one markdown file per tool (parameters, behavior, requirements). Update the matching file when a tool's behavior changes.
- [docs/best-practices.md](docs/best-practices.md) is a generic ServiceNow best-practices reference, unrelated to the code.
- `.history/` holds editor local-history snapshots (listed in `.gitignore`, though a few files were committed before that); ignore it.
