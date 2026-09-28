# sn-lint — ServiceNow JavaScript linter

`sn-lint` reviews ServiceNow scripts (Business Rules, Script Includes, Client Scripts, Scripted REST resources, and so on) the way a senior ServiceNow developer would. It is not a generic style checker. Each finding says what is wrong, why it matters, where it is, and how to fix it. It also knows which execution context the script runs in, so the same code can be fine on the server and broken in the browser.

**Status: complete (Phase 10 of 10).** Phase 1 built the engine: parser, AST, execution context, metrics, safe auto-fix, and console/JSON/SARIF output. Phase 2 added scope analysis and the core JavaScript rules for correctness, error handling, and naming. Phase 3 added GlideRecord data-flow tracking and the GlideRecord rules, Phase 4 the Business Rule rules, Phase 5 the client script and GlideAjax rules, Phase 6 the security rules, Phase 7 the integration and portability rules, Phase 8 complexity rules on top of the metrics, Phase 9 more safe formatting fixers, and Phase 10 CI support: stable fingerprints, baselines, and a GitHub code-scanning workflow (see [Roadmap](#roadmap)).

## Usage

```sh
npm run lint:sn -- path/to/scripts            # or: node bin/sn-lint.js <files|dirs>
node bin/sn-lint.js --context business_rule my_rule.js
node bin/sn-lint.js --context business_rule --when after --table incident my_rule.js
node bin/sn-lint.js -f sarif -o results.sarif src/
node bin/sn-lint.js --fix src/                 # formatting-only fixes, written to disk
node bin/sn-lint.js --list-rules
node bin/sn-lint.js --list-contexts
```

Exit codes: `0` means no errors; `1` means at least one ERROR, or more warnings than `--max-warnings`; `2` means a usage or configuration problem.

Programmatic use:

```js
import { lintText, getFormatter } from './src/linter/index.js';

const result = lintText(source, { file: 'IncidentUtils.js', context: 'script_include' });

// Business Rule timing and table come from the sys_script record, not the script:
lintText(brSource, { context: 'business_rule', record: { table: 'incident', when: 'before' } });
console.log(getFormatter('stylish')([result]));
```

## Findings

```json
{
  "ruleId": "SN-CLIENT-001",
  "severity": "ERROR",
  "category": "servicenow",
  "message": "Server-only API GlideSystem (gs) used in client-side code.",
  "file": "sys_script_client/set_assignee.js",
  "line": 3, "column": 36, "endLine": 3, "endColumn": 38,
  "code": "g_form.setValue('assigned_to', gs.getUserID());",
  "explanation": "gs exists only on the ServiceNow server. In the browser it is undefined, ...",
  "recommendation": "Use g_user for details about the current user ...",
  "fixable": false,
  "confidence": 0.9
}
```

**Severity** is `ERROR`, `WARNING`, or `INFO`. **Confidence** runs from 0 to 1. An ERROR whose confidence is below `errorConfidenceThreshold` (0.8 by default) is reported as a WARNING. A finding from a rule scoped to one side (for example a client-only rule) can never be more confident than the linter's guess about that side, so uncertain context inference produces warnings rather than false errors.

## Execution context

Context decides which rules run. It is resolved in this order:

1. **Explicit**: `--context`, the `context` option, or `context` in the config file.
2. **Folder name**: the closest folder that matches a ServiceNow table or a friendly name, such as `sys_script`, `sys_script_include`, `sys_script_client`, `catalog_script_client`, `sys_ui_action`, `sys_ws_operation`, `sysauto_script`, `sys_script_fix`, `sysevent_script_action`, `sys_transform_script`, `business_rules/`, or `client_scripts/`. Confidence is 0.9.
3. **Inference from code**:
   - **Signatures** such as `function executeRule(current, previous)`, `function process(request, response)`, `Class.create()`, a top-level `onLoad`/`onChange`/`onSubmit`, `onCondition`, `api.controller = function`, and `gsftSubmit`.
   - **API usage** such as `gs`, `current`, and `GlideAggregate` versus `g_form`, `g_user`, and `GlideAjax`.
   - Mixed signals produce a low-confidence guess.

### Record metadata

Some facts live on the record, not in the script: when a Business Rule runs (`before`, `after`, `async`, `display`) and which table it runs on. Pass them with `--when`/`--table` or the `record` option (`async_always` counts as `async`). Rules read them from `execution.record` (`{ table, when }`, `null` when unknown). Rules that depend on them stay silent without them. The planned SPIE `lint_scripts` tool will fill them in from `sys_script`.

Scripts that extend `AbstractAjaxProcessor` get `traits.clientCallable = true`, which the Phase 5–6 rules will use.

The contexts are: `business_rule`, `script_include`, `script_action`, `scheduled_job`, `fix_script`, `background_script`, `transform_map`, `scripted_rest`, `flow_action`, `portal_server`, `server`, `client_script`, `catalog_client_script`, `ui_policy`, `portal_client`, `client`, `ui_action` (both sides), and `unknown`.

## CI

Run `sn-lint` from the repository root: finding fingerprints use paths relative to the working directory.

### Fingerprints

Every finding has a `fingerprint`, a hash of the rule id, the file path, and the code on the finding's line (normalized: whitespace and semicolons removed, quotes unified), plus an index when the same rule flags identical code more than once in a file. Line numbers are left out, so a finding keeps its identity when code above it moves, and `--fix` formatting changes do not alter it. Editing the flagged line itself, or renaming the file, produces a new fingerprint. SARIF output carries it as `partialFingerprints["snLint/v1"]`, which GitHub code scanning uses to track an alert across commits. Secrets are redacted before hashing (SEC-002), so fingerprints and baselines never contain them.

### Baselines

To adopt the linter on existing code without fixing everything first:

```sh
node bin/sn-lint.js --write-baseline sn-lint-baseline.json servicenow/   # once; commit the file
node bin/sn-lint.js --baseline sn-lint-baseline.json servicenow/         # in CI: only new findings count
```

- Findings recorded in the baseline are hidden; the summary says how many (`17 existing findings hidden by the baseline`). The exit code and `--max-warnings` only consider the rest.
- Matching is by fingerprint with counts, so fixing one of two identical findings does not hide a third.
- Baseline entries that no longer occur are reported on stderr. Refresh the file with `--write-baseline` so fixed problems cannot quietly come back.
- The file is sorted JSON without timestamps (`{ "version": 1, "tool": "sn-lint", "findings": { "<fingerprint>": { "ruleId", "file", "code", "count" } } }`), so changes to it are readable in pull requests.

Programmatic use: `createBaseline(results)`, `writeBaseline(path, baseline)`, `loadBaseline(path)`, and `applyBaseline(results, baseline)` from `src/linter/index.js`.

### GitHub code scanning

[examples/sn-lint-github.yml](examples/sn-lint-github.yml) is a ready-to-copy workflow with two jobs: one uploads all findings as SARIF (security rules carry `security-severity`, so GitHub ranks them), and one fails the build only on findings missing from the committed baseline.

## Configuration

`sn-lint` reads `.snlintrc.json` (or `.snlintrc`) from the current directory, or the file passed with `--config`.

```json
{
  "context": "business_rule",
  "globals": { "calculateRisk": "readonly", "sharedCache": "writable" },
  "rules": {
    "SEC-001": "error",
    "SN-CLIENT-001": ["warning", {}],
    "JS-FORMAT-001": "off"
  },
  "categories": { "formatting": "off" },
  "thresholds": {
    "maxFunctionLength": 75,
    "maxFileLength": 500,
    "maxComplexity": 10,
    "maxNestingDepth": 4,
    "maxParameters": 5
  },
  "errorConfidenceThreshold": 0.8,
  "minConfidence": 0,
  "ecmaVersion": "latest"
}
```

- **Rule values**: `"error"`, `"warning"`, `"info"`, or `"off"`; or `[severity, options]`; or `{ "severity": ..., "options": ... }`.
- **Precedence**: a rule setting beats its category setting, which beats the rule's default.
- **Unknown names**: unknown rule ids and thresholds only produce warnings. Invalid values are errors.
- **globals**: names provided by records the linter cannot see, such as functions from a global Business Rule or a UI Script. Use a list of read-only names or `{ name: "readonly" | "writable" }`. Used by JS-UNDEF-001 and JS-GLOBAL-001. PascalCase names (Script Includes, platform classes) and `sn_*`/`x_*` namespaces never need listing.
- **ecmaVersion**: set it to `5` to make newer syntax a syntax error for global-scope (Rhino ES5) code.

### Suppressing a finding

```js
gr.deleteMultiple(); // snlint-disable-line SN-GR-002 -- staging table, truncated nightly by design
// snlint-disable-next-line SEC-001
/* snlint-disable-file JS-FORMAT-001 */
```

Leaving out the rule ids suppresses every rule on that line. Text after `--` is the reason; please include one. Suppressed findings are counted in the summary.

## Auto-fix safety

Every rule is either `AUTO_FIXABLE` or `MANUAL_REVIEW`, and the policy is enforced in code:

- The registry rejects `fixable: true` on any rule outside the `formatting` category. Security, GlideRecord, Business Rule, and integration findings can never be auto-fixed.
- Fixed code must re-parse to exactly the same AST (positions and raw literal text aside). Otherwise **all** fixes for that file are discarded and the reason is reported.

## Rules

Run `node bin/sn-lint.js --list-rules` for the current list. Every rule is MANUAL_REVIEW except the JS-FORMAT-* rules.

### Engine, security, and client (Phase 1)

| ID | Severity | Contexts | Detects |
| --- | --- | --- | --- |
| JS-SYNTAX-001 | ERROR | any | Script cannot be parsed |
| JS-FORMAT-001 | INFO (auto-fix) | any | Trailing whitespace (one finding per file; skips string and template content) |
| SEC-001 | ERROR | any | `eval`, `new Function`, string `setTimeout`/`setInterval`, `GlideEvaluator.evaluateString`; a constant string argument drops the finding to a WARNING |
| SN-CLIENT-001 | ERROR | client | Server-only APIs (`gs`, `current`, `GlideAggregate`, `RESTMessageV2`, ...) in browser code; reported once per API; `typeof` guards and local variables are ignored |

### Core JavaScript: correctness (Phase 2)

| ID | Severity | Detects | Deliberately not reported |
| --- | --- | --- | --- |
| JS-UNDEF-001 | ERROR | Undeclared variables and functions, with a "did you mean" suggestion (`curent` → `current`) | Known JS, browser, and ServiceNow globals (including injected ones like `source`, `target`, `producer`, `data`); PascalCase names (Script Includes); `sn_*`/`x_*`; `typeof x` guards. Unknown lowercase *function calls* are WARNING only (they may come from a global Business Rule or UI Script) |
| JS-GLOBAL-001 | WARNING | Assignment to an undeclared name (implicit global, shared across the Rhino transaction or across client scripts on the form) | `answer`, transform-map `ignore`/`error`/`error_message`/`status_message`, portal `data`, Flow `outputs` |
| JS-UNUSED-001 | WARNING | Unused local variables and functions; "assigned but never read"; trailing unused parameters (INFO) | Top-level declarations (the script's public surface); entry-point parameters (`executeRule`, `onChange`, `process`, ...); `_`-prefixed names; catch parameters. Option: `{ "args": "none" }` |
| JS-UNREACH-001 | WARNING | Code after `return`/`throw`/`break`/`continue`, or after an if/else or try where every path exits | Hoisted function declarations and bare `var x;` |
| JS-DUP-001 | WARNING | A function declared twice, a function and variable sharing a name, a parameter overwritten by `var x = ...` | Repeated `var` (the `for (var i...)` idiom) |
| JS-DUP-002 | ERROR | Duplicate object keys, with a Script Include-specific message for duplicate prototype methods | getter/setter pairs, computed keys |
| JS-DUP-003 | WARNING | Duplicate `case` labels | `1` vs `'1'` |
| JS-COND-001 | WARNING | Constant conditions (`if (false)`, `if (typeof x)`, object literals as conditions) | `while (true)`, `for (;;)`, `do {} while (1)` |
| JS-COND-002 | ERROR | `if (gr.state = 7)` — assignment where a comparison was meant. In `while`/`for` conditions it is WARNING (confidence 0.6) | Double parentheses (`if ((m = re.exec(s)))`) mark intent |
| JS-EXPR-001 | WARNING | Statements with no effect: `gr.active == false;`, `gr.query;` (missing `()`), bare identifiers | Calls, assignments, directives, `a && b()`, `x ? f() : g()` |
| JS-FUNC-001 | INFO | Empty functions; empty `onLoad`/`onChange` client scripts | `initialize`, callbacks passed as arguments, bodies containing a comment |
| JS-SHADOW-001 | WARNING | Declaring `current`, `gs`, `g_form`, ... on the side where that global exists; redeclaring `undefined`/`NaN`/`eval`/`arguments` | Parameters named `current`/`previous`; server names in client code; files whose side is unknown |

### Core JavaScript: error handling (Phase 2)

| ID | Severity | Detects |
| --- | --- | --- |
| JS-ERR-001 | WARNING | Empty `catch` block (unless it contains a comment explaining why) |
| JS-ERR-002 | WARNING | `catch` that neither uses the error, logs, nor rethrows (e.g. `catch (e) { return null; }`) |
| JS-ERR-003 | WARNING | `throw 'message'` / `throw {...}`; Scripted REST resources get `sn_ws_err.*` advice |
| JS-ERR-004 | INFO | `gs.error(e)` / `gs.log(e.message)` in a catch: an error logged without saying what failed or for which record |
| JS-ERR-005 | WARNING | Statement-level promise chains (`$http`, `fetch`) without `.catch()` or a rejection handler |

### Core JavaScript: naming (Phase 2)

Both naming rules report **one finding per file** that lists the offenders, so legacy scripts don't drown real problems in style noise.

| ID | Severity | Detects |
| --- | --- | --- |
| JS-NAMING-001 | INFO | Declared names that are not camelCase, PascalCase, or UPPER_CASE (e.g. `sys_id`, `get_group`); `_`/`$` markers and the `g_` convention are accepted |
| JS-NAMING-002 | INFO | Single-letter names other than loop counters, catch parameters, and callback parameters |

The other naming checks in the spec (boolean `is`/`has` prefixes, abbreviations, "meaningful" names) are left out on purpose. They can't be judged reliably from syntax, and `gr`-style names are the ServiceNow idiom, so they would mostly add noise.

### GlideRecord (Phase 3)

Each `new GlideRecord(table)` / `GlideRecordSecure` / `GlideAggregate` bound to a variable is tracked: its table, the ordered calls made on it, direct field writes, and where it escapes (passed to a function, returned, stored). Conditions are graded **none**, **weak** (an encoded query from a variable or an empty/ORDERBY-only literal, or a filter added only inside a branch or callback), or **static**. If the object escapes before the call, the grade is unknown and the unfiltered rules stay silent, since a helper may add the conditions. All GlideRecord rules run in every context except client-side ones.

| ID | Severity | Detects | Deliberately not reported |
| --- | --- | --- | --- |
| SN-GR-001 | ERROR | `updateMultiple()` with no conditions; weak conditions give a WARNING (confidence 0.6) | Objects that escaped to a helper first; parameters of unknown origin |
| SN-GR-002 | ERROR | `deleteMultiple()` with no conditions; weak conditions give a WARNING | Same as SN-GR-001 |
| SN-GR-003 | ERROR | `update()`/`deleteRecord()` inside `while (gr.next())` over an unfiltered query | Queries batched with `setLimit()`/`chooseWindow()` |
| SN-GR-004 | WARNING | `query()` with no conditions and no `setLimit()`. Option: `{ "allowUnfilteredTables": ["u_settings"] }` | GlideAggregate; weak conditions |
| SN-GR-005 | WARNING | `query()`, `get()`, or `getRefRecord()` inside a loop or a `forEach`/`map`/... callback (N+1 queries) | Paging with `chooseWindow()`/`setLimit()` in the loop; functions that merely *might* be called in a loop |
| SN-GR-006 | WARNING | The same table and conditions queried twice in one function | A write to that table in between; if/else or switch branches; condition variables reassigned in between |
| SN-GR-007 | INFO | `if (gr.next())` reads one row but the query has no `setLimit(1)` | `sys_id` lookups; GlideAggregate; unfiltered queries (SN-GR-004) |
| SN-GR-008 | WARNING | `getRowCount()` on a GlideRecord whose rows are never read (use GlideAggregate COUNT) | Rows also iterated; GlideAggregate |
| SN-GR-009 | WARNING | `get('state', 7)` and other lookups on non-unique fields (`active`, `assigned_to`, `category`, ...) | `sys_id`, `number`, `user_name`, and field names from variables |
| SN-GR-010 | ERROR | `next()` before any `query()`/`get()`; conditions, limits, or ordering added after the last `query()` (WARNING) | Calls in other functions or callbacks; a later query in the same loop |
| SN-GR-011 | WARNING | `gr.field = value` followed by `updateMultiple()` (use `setValue()`) | Assignments inside a `while (gr.next())` loop that calls `update()` |

The analysis follows references in source order, which is exact for straight-line code. Loops, callbacks, and escapes lower confidence or silence the rule rather than guess.

### Business Rules (Phase 4)

Rules marked * need `when` (see [Record metadata](#record-metadata)) and report nothing without it. `current` and `previous` count only when they are the platform objects (undeclared, or parameters such as `executeRule(current, previous)`).

| ID | Severity | Contexts | Detects | Deliberately not reported |
| --- | --- | --- | --- | --- |
| SN-BR-001 | ERROR | business_rule | `current.update()` / `current.insert()`; the explanation depends on `when` (double save, recursion, a write on every form load). After an unconditional `current.setWorkflow(false)`: WARNING | UI Actions (where `current.update()` is normal); local variables named `current` |
| SN-BR-002 | ERROR | business_rule | A GlideRecord that loads the record being processed (`get(current.sys_id)`, `addQuery('sys_id', current.getUniqueValue())`) and updates or deletes it. With `--table`: writes to the rule's own table (WARNING, confidence 0.6) | Writes after `setWorkflow(false)` on the same table; reads only |
| SN-BR-003 | WARNING | any except client | `setWorkflow(false)` with no write after it on that object (no effect). With a write: INFO asking for a comment explaining why | A comment on the same line or the line above; objects handed to a helper |
| SN-BR-004 | WARNING | business_rule | `RESTMessageV2`/`SOAPMessageV2` `execute()`, `GlideHTTPRequest` `get/post/put/del`, `waitForResponse()` | Async Business Rules; `executeAsync()` without waiting |
| SN-BR-005 | WARNING | business_rule | Statements outside the `executeRule` wrapper (one finding per file) | The `executeRule` IIFE; the legacy `onBefore(); function onBefore() {}` template |
| SN-BR-006* | WARNING | business_rule | Field changes to `current` in after/async rules (never saved) | Scripts that also call `current.update()` (SN-BR-001) |
| SN-BR-007* | ERROR | business_rule | `previous.field` in async rules, where `previous` is null | Scripts that null-check `previous` |
| SN-BR-008* | ERROR | business_rule | `current.setAbortAction()` in after/async/display rules | before rules |

### Client scripts and GlideAjax (Phase 5)

GlideAjax objects are tracked the same way as GlideRecords (see [glide-ajax.js](../../src/linter/glide-ajax.js)). Rules marked "client + UI Action" also run on UI Actions, because the APIs they look for only exist in a UI Action's client half. Where a problem breaks Service Portal but only degrades the classic UI, the finding is an ERROR in Catalog Client Scripts and portal controllers and a WARNING elsewhere.

| ID | Severity | Contexts | Detects | Deliberately not reported |
| --- | --- | --- | --- | --- |
| SN-CLIENT-002 | ERROR (portal) / WARNING | client + UI Action | `getXMLWait()`: synchronous GlideAjax | |
| SN-CLIENT-003 | ERROR (portal) / WARNING | client + UI Action | `g_form.getReference(field)` without a callback | A second argument that is a variable (may be a callback) |
| SN-CLIENT-004 | WARNING | client | `new GlideRecord()` in client code; notes a synchronous `query()`/`get()` | UI Actions (their server half legitimately uses GlideRecord) |
| SN-CLIENT-005 | WARNING | client + UI Action | `document`, `gel()`, `$`/`$$`/`$j`/`jQuery`, `g_form.getControl()`/`getElement()`/`getFormElement()`; one finding per file | `typeof` guards; local variables; `gsftSubmit(null, g_form.getFormElement(), ...)` |
| SN-CLIENT-006 | WARNING | client | Top-level `onChange` that never references `isLoading` | Empty template bodies (JS-FUNC-001) |
| SN-AJAX-001 | WARNING | client + UI Action | GlideAjax or `getReference()` inside a loop or iteration callback; more than `maxRequests` (option, default 2) GlideAjax requests in one function (INFO) | Requests spread across functions |
| SN-AJAX-002 | ERROR | client + UI Action | A request sent without `addParam('sysparm_name', ...)` before it | Parameter names from variables; objects handed to a helper first |
| SN-AJAX-003 | ERROR | client + UI Action | `addParam()` names that do not start with `sysparm_` (the server never receives them) | Names from variables; `addParam` on non-GlideAjax objects |
| SN-AJAX-004 | ERROR | client | `return false` inside an asynchronous callback (GlideAjax, `getReference`, GlideRecord) in `onSubmit`: it cannot cancel the submit | The "return false, then g_form.submit() from the callback" pattern |

### Security (Phase 6)

SEC-002 masks every secret it finds, in the message and in the `code` snippet (`var token = '<redacted>';`), so reports and CI logs never repeat the credential.

| ID | Severity | Contexts | Detects | Deliberately not reported |
| --- | --- | --- | --- | --- |
| SEC-002 | ERROR | any | Hardcoded secrets: known formats anywhere (AWS, GitHub, Slack, Google, Stripe, private keys, JWTs, `Basic`/`Bearer` values, Azure keys, `user:pass@` URLs); literals in `setBasicAuth()`/`setPassword()`/`Authorization` headers; literals stored in names ending in `password`, `secret`, `token`, `apiKey`, `clientSecret`, ... | Placeholders (`''`, `<your key>`, `${TOKEN}`, `changeme`), sys_ids, property names (`x_app.api.password`), field names (`u_password`), dynamic values |
| SEC-003 | WARNING | script_include | A client-callable (`AbstractAjaxProcessor`) method that uses GlideRecord/GlideAggregate/GlideQuery/`getRefRecord()` with no `hasRole`/`canRead`/`canWrite`/... check, including in the `this._helpers()` it calls | `_private` methods; GlideRecordSecure; non-client-callable includes |
| SEC-004 | WARNING | script_include | `isPublic: function () { return true; }` | Conditional `isPublic()` |
| SEC-005 | ERROR | any except client | Request input (`getParameter()`, `request.queryParams/pathParams/body`, portal `input`) reaching a GlideRecord table name (ERROR), an encoded query, or a field name (WARNING); followed through variables | Input used as a value (`addQuery(field, input)`, `get(input)`); values passed through a validate/escape/sanitize function. Checked in an `if`/`switch` first: confidence 0.5. GlideRecordSecure table: WARNING |
| SEC-006 | WARNING (0.6) | scripted_rest | GlideRecord writes in a resource script with no authorization check anywhere in it | GlideRecordSecure; reads (resource ACLs usually cover them) |
| SEC-007 | WARNING | any except client | `GlideImpersonate`, `.impersonate()`, `GlideEncrypter` | |
| SEC-008 | WARNING | any | `innerHTML`/`outerHTML =`, `insertAdjacentHTML()`, `document.write()`, `$sce.trustAsHtml()`, jQuery `.html(x)` with a non-constant value (XSS) | Constant strings; escaped values; `.text()`/`textContent`; `.html()` getters |

### Integrations and portability (Phase 7)

`RESTMessageV2` / `SOAPMessageV2` objects and the responses from their `execute()`/`executeAsync()` calls are tracked like GlideRecords (see [outbound.js](../../src/linter/outbound.js)). A response that is returned or handed to another function is left alone.

| ID | Severity | Contexts | Detects | Deliberately not reported |
| --- | --- | --- | --- | --- |
| INT-001 | WARNING | any except client | `getBody()` on a response with no `getStatusCode()`/`haveError()`/`getErrorCode()`/`getErrorMessage()` | Responses returned or passed on; responses whose body is never read |
| INT-002 | WARNING / INFO | any except client | `JSON.parse(response.getBody())` (directly or through a variable) outside `try/catch` (WARNING); `execute()` outside `try/catch` (INFO) | `try/finally` without `catch` does not count as handling |
| INT-003 | INFO | any except client | Synchronous `execute()` with no `setHttpTimeout()` before it | `executeAsync()`; objects configured by a helper |
| PORT-001 | WARNING | any except client | A literal URL in `setEndpoint()` or `new GlideHTTPRequest()` (also the constant start of a concatenation) | REST Message records; `${variable}` substitution; properties; instance URLs (PORT-003) |
| PORT-002 | WARNING | any | 32-character sys_id literals, each value once; INFO in fix and background scripts | Comments; uppercase hex |
| PORT-003 | WARNING | any | `*.service-now.com` / `*.servicenowservices.com` hosts in strings | `docs.servicenow.com` and other non-instance hosts |
| PORT-004 | WARNING | any | `gs.getUserName()`, `gs.getUserID()`, `gs.getUser().getName()`, `g_user.userName`, ... compared with a literal | Comparisons with fields (`gs.getUserID() == current.assigned_to`) |

### Complexity (Phase 8)

These rules compare the per-function metrics (reported in every result under `metrics`) with the `thresholds` in the configuration. The top level of a script counts as its own unit, since fix scripts and scheduled jobs often have no functions. Nested functions are measured separately from the function that contains them.

| ID | Severity | Threshold (default) | Detects |
| --- | --- | --- | --- |
| CPLX-001 | INFO | `maxFunctionLength` (75) | Functions with more lines than the limit (the top level is covered by CPLX-002) |
| CPLX-002 | INFO | `maxFileLength` (500) | Scripts with more lines than the limit |
| CPLX-003 | WARNING | `maxComplexity` (10) | Cyclomatic complexity: 1 + each `if`, loop, `case`, `catch`, ternary, `&&`, `\|\|`, `??` |
| CPLX-004 | WARNING | `maxNestingDepth` (4) | Nested `if`/loop/`switch`/`try` blocks, reported at the statement that first goes too deep; `else if` does not add a level |
| CPLX-005 | INFO | `maxParameters` (5) | Functions with more parameters than the limit; platform entry points (`onCellEdit`, `executeRule`, ...) are exempt |

### Formatting fixers (Phase 9)

Every formatting rule is INFO, reports **one finding per file** (with a count), and is fixed by `--fix`. Text inside strings and template literals is never touched, and the AST-equivalence guard still applies to every fix. Running all fixers over this repository's own 211 JavaScript files (with the quote style forced to double) applied 4,873 edits with no rejections and no AST changes. Turn the whole group off with `"categories": { "formatting": "off" }`.

| ID | Fixes | Options | Leaves alone |
| --- | --- | --- | --- |
| JS-FORMAT-001 | Trailing whitespace | | Whitespace inside literals |
| JS-FORMAT-002 | Quotes to one style | `{ "style": "single" }` (default) or `"double"` | Strings containing the target quote or an escaped quote; directives (`'use strict'`); template literals |
| JS-FORMAT-003 | Missing semicolons (statements relying on automatic insertion) | | `for (...)` headers; block statements and declarations |
| JS-FORMAT-004 | Mixed tab/space indentation, expanded on tab stops | `{ "style": "spaces" \| "tabs", "tabWidth": 4 }`; default style: whatever the file mostly uses | Tabs followed by alignment spaces (in tabs style); lines inside literals; blank lines |
| JS-FORMAT-005 | Runs of blank lines longer than `max` | `{ "max": 2 }` | Blank lines inside literals; blank lines at the end of the file |

Full re-indentation (computing each line's expected depth) is deliberately not done: continuation lines, chained calls, and switch styles are ambiguous, which is a formatter's job (Prettier), not a linter's.

## Architecture

```
bin/sn-lint.js               CLI (argument parsing, config discovery, exit codes)
src/linter/
  index.js                   public API: lintText, lintFiles, collectFiles, formatters, registry
  engine.js                  pipeline: parse → scopes → context → rules → findings → metrics → fixes
  parser.js                  acorn wrapper (lenient ServiceNow settings, syntax error → location)
  ast.js                     traverse (sets parent pointers), walk (read-only subtree search), member-chain helpers
  scope.js                   scope analysis: declarations per scope, reference resolution, read/write, globals
  known-globals.js           JS/browser/ServiceNow globals, writable globals, entry points, logging-call detection
  execution-context.js       context catalogue, folder hints, signature and API-usage inference
  glide-record.js            object data flow (trackInstances); GlideRecord instances, filter strength, loops (context.glideRecords)
  glide-ajax.js              GlideAjax instances, requests, and parameters (context.glideAjax)
  outbound.js                RESTMessageV2/SOAPMessageV2 instances and responses (context.outbound)
  servicenow-apis.js         knowledge base of ServiceNow and browser globals (side, display name, alternative)
  rule-registry.js           rule validation (ids, categories, contexts, auto-fix policy)
  config.js                  config loading, validation, severity/category/threshold resolution
  suppressions.js            snlint-disable comments
  metrics.js                 per-function complexity, nesting, length, parameters; file totals
  fixer.js                   non-overlapping edits + AST-equivalence verification
  fingerprint.js             stable finding fingerprints (SARIF partialFingerprints, baselines)
  baseline.js                create, write, load, and apply baseline files
  formatters/                stylish (console), json, sarif (2.1.0)
  rules/                     one file per rule, registered in rules/index.js
```

Rules that need to search a subtree during traversal must use `walk()`, not `traverse()`: `traverse()` resets parent pointers.

The engine traverses the AST **once**. Each applicable rule contributes a visitor map, and the engine dispatches every node to every rule interested in it. A rule that throws is disabled for that file and reported under `errors`; the other rules keep running.

### Writing a rule

```js
// src/linter/rules/sn-example-001.js
import { getPropertyName } from '../ast.js';

export default {
  id: 'SN-EXAMPLE-001',
  name: 'Unrestricted deleteMultiple',
  category: 'servicenow',         // see RULE_CATEGORIES in rule-registry.js
  severity: 'error',              // default; users can override
  description: 'deleteMultiple() on a GlideRecord with no query conditions.',
  contexts: ['server'],           // 'any', 'server', 'client', or specific context names
  // excludeContexts: ['client'],  // optional; removes contexts matched by `contexts`
  fixable: false,

  create(context) {
    // context: report(), sourceCode, execution { type, side, confidence, traits, record { table, when } },
    //          scopes { globalScope, scopes, scopeByNode, globalReferences }, configuredGlobals,
    //          options, thresholds, file,
    //          glideRecords / glideAjax / outbound (lazy, shared data-flow analyses; read them from a visitor),
    //          metrics (metrics.js; read it in 'Program:exit')
    return {
      CallExpression(node) {
        if (node.callee.type === 'MemberExpression' && getPropertyName(node.callee) === 'deleteMultiple') {
          context.report({
            node,
            message: 'Unrestricted deleteMultiple() detected.',
            explanation: 'Without conditions this deletes every row in the table.',
            recommendation: 'Add addQuery()/addEncodedQuery() conditions and verify the count first.',
            confidence: 0.9,           // optional; lowers ERROR to WARNING below the threshold
            // redact: secretNode,       // optional; hides that node's text in the finding's code snippet
          });
        }
      },
      'Program:exit'() { /* whole-file checks */ }
    };
  }
};
```

Then add it to `BUILT_IN_RULES` in `rules/index.js` and create `test/linter/rules/<rule-id>.test.js` using `runRuleTests` from `test/linter/helpers.js`, with valid, invalid, edge, and context cases. A meta-test fails if a built-in rule has no test file. When a false positive is found, add it as a `valid` case.

## Roadmap

| Phase | Scope |
| --- | --- |
| 1 ✅ | Parser, AST, engine, context, config, suppressions, metrics, safe fixes, stylish/JSON/SARIF |
| 2 ✅ | Scope analysis; core JS correctness, error-handling, and naming rules |
| 3 ✅ | GlideRecord: data-flow tracking of each GlideRecord variable (table, conditions, setLimit) for unrestricted update/delete/query, queries in loops, repeated queries |
| 4 ✅ | Business Rules: `current.update()`, recursion risk, `setWorkflow(false)` awareness, synchronous REST calls |
| 5 ✅ | Client / GlideAjax: `getXMLWait`, client GlideRecord, excessive round trips, DOM manipulation |
| 6 ✅ | Security: secrets (entropy plus known formats), client-callable exposure, Scripted REST authorization, GlideRecordSecure |
| 7 ✅ | Integrations and portability: RESTMessageV2 status/error handling, hardcoded endpoints, sys_ids, instance URLs |
| 8 ✅ | Complexity rules built on `metrics.js` using the configured thresholds |
| 9 ✅ | More formatting fixers (quotes, semicolons, indentation) under the AST-equivalence guard |
| 10 ✅ | CI: GitHub code-scanning workflow example, SARIF fingerprints, baseline files |
