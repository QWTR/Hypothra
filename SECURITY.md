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

Scanning, review, and deterministic calculations require no external model.
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

## Reporting

Use GitHub private vulnerability reporting if enabled. Otherwise open an issue
requesting a private channel without including exploit details, credentials, or
private project data. Fixes target the latest development version; no response-time
guarantee is made for this early project.
