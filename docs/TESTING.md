# Testing Hypothra safely

## Run the suite

```sh
npm ci --ignore-scripts
npm run browser:install
npm test
npm run package:verify
npm audit
```

`npm test` builds every workspace before running Node's test runner.
Live model calls are disabled by the test launcher; controlled model responses
exercise automatic filling without using a developer's account. A real signed-in
Codex smoke test is separate evidence and is never silently run in CI.

Chromium is required: missing browser installation is a failure, not a silently skipped real
browser test. CI installs browser dependencies and runs Windows/Linux on Node 22/24.

## What is covered

| Layer | Evidence |
| --- | --- |
| Legacy engine | Hand-calculated case, deterministic output, bounds, nonmutation |
| Scanner | AST routes, screens, data declarations, ignores, secrets, binaries, size limits, junction containment |
| Understanding | Editable claims, authentic evidence IDs, exact revision, source-change detection |
| Launch | Independently calculated funnel, range ordering, budget checks, dated/matched sources |
| Advertising data | CSV weighting and segmentation; mocked provider responses, errors, auth headers, metadata |
| Browser | Actual Chromium: working desktop signup, deliberately failing mobile signup, permission denial, blocked external redirect |
| CLI | Actual subprocesses through init, review, approval, browser execution, launch, report, and stale journey rejection |
| MCP | Actual stdio client/server exchange; root scope, unavailable approval tools, proposals invalidating approval |
| Dashboard | Actual HTTP API; write token, origin checks, saved inputs, stale report rejection |
| Guided UI | Real browser product corrections, public price selection, preserved unsaved budgets, local checks, results, and phone-width layout |
| Automatic understanding | Controlled inference fills all fields, shows progress, protects owner edits, preserves confirmation gates, and refreshes untouched ad templates |
| AI input and cleanup | Large inputs stay within budget with explicit omissions; invalid inputs fail before process start; locked temp directories are nonfatal and cleanup cannot escape its temp boundary |
| AI rehearsal | Exact individual records, impossible/duplicate IDs rejected, 100,000-person target with partial-count honesty, request caps, pause/resume, single-worker lease, crash recovery, immutable started plans and source revisions |
| AI browser visitors | Real Chromium fills and clicks a synthetic signup form, records actual HTTP 500 separately from opinion, rejects invented selectors and requires a local synthetic-data opt-in |
| AI launch panel | Real HTTP/browser flow from optional creative to AI-filled costs, owner correction, individual audience records, evidence-linked recommendations and mobile layout |
| Workspace feedback | Real pending requests and controlled model gates: immediate button state, navigation during work, truthful indeterminate/count progress, reduced motion and preserved edits after errors |
| Windows artifact updates | Transient reader/antivirus rename locks are retried while the last complete file remains readable; permanent write failures still surface |
| Separate project selection | A standalone panel browses/opens two external folders, initializes their own state, and rejects stale cross-project writes |
| Public ad prices | Publisher-specific period/metric parsing, global scope, no credentials, currency conversion, and closed failure on unverifiable data |
| Model adapter | Mocked compatible endpoint, explicit upload gate, evidence and hypothesis checks |
| Journey planning | Actual rendered control inventory excludes values; mocked model proposals reject invented selectors and require consent |
| Distribution | Archive installed in an independent temporary project, without monorepo runtime dependencies |

The file-symlink test explicitly skips when OS privileges prevent creating its
fixture. Directory-junction containment is tested separately. Linux can exercise
the file-symlink case without Windows privileges.

Provider and model tests use synthetic responses. They prove request and validation
behavior; they do not establish that a particular live account, API version,
reporting dimension combination, or local model is available.

## Manual example

Run `npm run demo`. In the dashboard, inspect the product description and code
references, open the experiment inputs, and follow the report link. Change the
variant in the report: counts and financial outcomes must change consistently.
Change the draft or launch inputs and verify the old report becomes stale.

The test product's mobile signup failure is deliberately included. It should be
reported as a failure at signup while desktop signup and permission fallback pass.
This expected application failure is a successful test of Hypothra's detection.

## Live integration checks, when configured

1. **AI host:** bind a disposable initialized root, inspect the advertised tools,
   ask for a proposed correction, and confirm the host cannot approve the model.
   Approve locally, run the scenario, and compare actual tool output to CLI JSON.
2. **Model endpoint:** choose a compatible local server or authorized remote model,
   inspect the outgoing summary, opt in, and confirm output is a reviewable draft.
3. **Advertising accounts:** use read-only reporting permissions and a short known
   date range; compare spend/impressions/currency/country/objective against an
   account export. Verify CPM independently. Do not run any campaign mutation.
4. **A real project:** start with a disposable copy, ignore `.hypothra/`, review
   the scan omissions, correct understanding, and use synthetic backend services.

## Browser boundaries

Point journeys only at an isolated local service, never a production-backed app.
Inspect form fields and values before running. A new browser context prevents
inherited account sessions, but it does not isolate the application's own backend.
The runner is not a penetration test or a production capacity benchmark.

Do not convert a persona pass fraction into a real customer conversion rate.
Report observed assertions separately from assumptions and hypotheses.
