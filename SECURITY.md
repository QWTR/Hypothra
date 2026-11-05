# Security policy

Hypothra v0.2.0 is experimental local tooling. Use disposable project copies,
synthetic accounts, a test database, and mock payments. Do not run as administrator.

## Scanner and private files

The scanner never imports or executes inspected code. It traverses an allowlist
within a canonical root, rejects redirects and links, compares file identity,
and applies limits: 1,500 text files, 8 MiB total source, 128 KiB per source file,
32 KiB per README, 12 directory levels, and 12,000 entries. Generated/vendor trees,
environment files, credential-like names, and common private key/database files
are excluded. Root ignore files can narrow the scope further.

Findings contain selected structural declarations, labels, and references; source
content remains untrusted data. Redaction is best-effort and does not guarantee
that arbitrary hardcoded secrets can be recognized. Do not scan a repository
being concurrently modified by an adversary. These checks are not an OS sandbox.

`.hypothra/` contains project descriptions, source references, private reports,
optional DOM inventories, and optional screenshots. Ignore it in the inspected
project's Git configuration. Review any report before sharing it.
New workspaces create a private local ignore file automatically. Selecting a
project requires an explicit authenticated action in the panel; the chosen path
must resolve to a specific absolute directory. The in-panel folder browser returns
directory names only, through authenticated requests. It does not launch a shell,
desktop dialog, or project scripts.
UI writes include the selected project identity to reject stale cross-project edits.

## Approval and output

Human approval records the exact model revision and source digest. Source,
inspection, or model edits invalidate it. Refresh preserves a previous model and
requires new review. Agents can propose changes but cannot approve a model.
Journey-definition edits invalidate attached runtime evidence. Changes to experiment
inputs make saved dashboard reports stale. These are local integrity checks, not
cryptographic attestation against a malicious owner editing every artifact.

The dashboard binds only to `127.0.0.1`, checks Host and Origin, requires an
unpredictable session token for writes, caps request bodies, and escapes content.
It exposes no arbitrary file or shell endpoint. Do not proxy it to the internet.

## Browser experiments

Only explicit `http://127.0.0.1:<port>/` or `http://[::1]:<port>/` origins are
accepted. Browser contexts are fresh and do not inherit sign-ins. Requests to
other origins and external redirects are blocked; service workers, downloads,
popups, and WebSockets are blocked. Tests have step, request, and elapsed-time
budgets. DOM discovery records controls and labels, not values or storage.

This is a browser request boundary, not a network sandbox. Browser internals and
the tested app's server are outside that boundary. A local app can send emails,
write a real database, or contact a payment provider from its backend. Isolate
those services before testing. Native mobile and production load testing are
outside this release. A locally configured journey can submit synthetic forms.

## Optional model and advertising integrations

Public benchmark lookup needs no advertising credentials. An explicit panel,
CLI, or MCP action reads a fixed public AdKit benchmark URL and, when converting
currency, fixed public NBP exchange-rate endpoints. Responses have byte/time
limits, redirects are rejected, and ambiguous prices/dates are not imported.
Global samples stay global and currency conversion preserves original values.
The dashboard can run the saved local browser checks only through an explicit
authenticated POST action; the same approved-model and local-origin rules apply.

The standalone scanner, review, deterministic calculations, and `init --no-ai`
require no external model. Normal `init` and a first dashboard visit automatically
use a signed-in Codex CLI or a configured compatible model to prepare product data.
They send selected, bounded, redacted source excerpts and evidence to that account's
model. Source redaction is best-effort; use structural-only mode for sensitive
projects you do not want processed by a model. No Meta/TikTok credentials are needed.

The Codex adapter ignores user configuration and rules for its run, disables model
tools/apps/hooks/memory, uses read-only execution permissions, and operates in a
disposable directory. It does not give the model unrestricted project access.
Temporary cleanup retries Windows file locks. If a lock persists, the disposable
directory may remain in the current user's OS temp folder with its output schema
and generated response; cleanup failure does not invalidate an analysis result.
Raw source input is supplied on stdin rather than saved there. Account secrets
are never copied into the project.
AI only proposes understanding; human approval remains necessary. Newer saved
owner edits defeat stale AI results, and the previous model is backed up.

An explicit `enrich` or `plan-journeys` command with `--allow-upload` sends bounded,
redacted summaries or DOM inventory to your configured endpoint. Remote endpoints
must use HTTPS. Model output is schema/evidence checked and remains a draft.
Review it; prompt-injection mitigation cannot guarantee semantic correctness.

Read-only Meta/TikTok connectors use fixed HTTPS service endpoints, GET requests,
header authentication, timeouts, response budgets, and no redirects. They cannot
create, publish, modify, or buy campaigns. Partial reports and unverified metadata
are rejected. Tokens belong in an ignored local environment file and are not
included in reports. `.env` is read only when explicitly supplied via `--env-file`.
Do not paste tokens into issues, prompts, or chat.

## AI rehearsal boundaries

AI rehearsals explicitly consume the selected model account and enforce a request
cap before every inference. Automatic preparation researches published advertising
benchmarks and uploads selected model/evidence/creative data to that engine. Browser
exploration additionally uploads bounded visible text/control observations from
the chosen local test app. Inputs are redacted on a best-effort basis. Model and
page content are untrusted. The agent can use only inventoried controls and
host-generated dummy inputs; external origins, WebSockets, file inputs and
downloads are blocked. A conservative label heuristic rejects obvious payment,
destructive and outgoing-message controls; it cannot establish what arbitrary
application code behind an innocently named button will do.
These boundaries do not isolate the local app's backend. Explicit synthetic-data
confirmation is required. See the detailed [AI rehearsal boundaries](docs/AI-REHEARSAL.md).

## Reporting

Use GitHub private vulnerability reporting if enabled. Otherwise open an issue
requesting a private channel without including exploit details, credentials, or
private project data. Fixes target the latest development version; no response-time
guarantee is made for this early project.
