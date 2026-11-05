# Architecture

Hypothra uses npm workspaces, ESM, strict TypeScript, and project references.
`tsc -b` builds packages in dependency order. Runtime imports resolve to `dist`;
source launchers exist before build so npm can create command links on installation.
The scanner uses a separately pinned `typescript-ast` alias for the compiler API;
the workspace build uses TypeScript 7, whose package does not expose that API.

## Packages and boundaries

```text
project-scanner ──► product-lab ──► CLI
                          └─────► MCP server
simulation-core ────────────────► CLI / MCP server
```

- `project-scanner/inspect.ts`: source traversal, AST facts, selected configuration
  extraction, redaction, evidence IDs, and deterministic content digest.
- `product-lab/schema.ts`: strict contracts for editable models, prices, launches,
  browser definitions, and runtime reports.
- `understanding.ts`: structural draft, evidence validation, and review summary.
- `workflow.ts`: initialization, approval, stale-state checks, artifacts, and orchestration.
- `launch.ts`: deterministic funnel arithmetic and conditional bug-impact scenarios.
- `rehearsal.ts` / `rehearsal-schema.ts`: primary AI-first launch planning, per-person decisions, exact accounting, request limits, atomic batch/archive recovery, pause/resume and revision checks.
- `inference.ts`: bounded structured model calls through the signed-in Codex or configured compatible endpoint, with reported token accounting.
- `experience-agent.ts`: sequential AI-directed real browser visits for evaluated installers; inventories, dummy inputs, action checks and separate runtime evidence.
- `rehearsal-view.ts` / `rehearsal-client.ts`: optional-idea setup, AI-filled editable plan, progress, decision inspection and optimization UI.
- `ads.ts`: normalized CSV import and optional read-only account reporting adapters.
- `public-prices.ts`: public benchmark extraction and dated currency conversion; no ad credentials.
- `journeys.ts`: explicit local browser actions, assertions, and recorded observations.
- `discovery.ts`: rendered control inventory for planning; no captured input values.
- `ai.ts`: opt-in compatible model endpoint; validated model and journey proposals.
- `auto-ai.ts` / `codex-ai.ts`: automatic initialization, background progress, configured-engine detection, structured Codex inference, owner-edit protection, and backups.
- `dashboard.ts`: authenticated loopback endpoints, including explicit local checks and public cost lookup.
- `folder-picker.ts`: authenticated in-panel drive/folder navigation; Hypothra can run separately from every inspected project.
- `dashboard-view.ts` / `dashboard-client.ts`: guided forms, draft preservation, and plain-language results.
- `report.ts`: shared styling and escaped standalone report rendering.
- `storage.ts`: bounded reads, local operation lock, atomic artifact writes, canonical hashing.

The original simulation core remains pure and backward compatible. The primary
workflow is described in [AI-REHEARSAL.md](AI-REHEARSAL.md). The advanced deterministic
funnel remains specified in [LAUNCH-MODEL.md](LAUNCH-MODEL.md).

## State machine

```text
uninitialized → draft → corrected draft → approved
                      ↑                     │
                      └── source/model edit ─┘

approved + launch inputs → scenario report
approved + local journeys → runtime report
approved + both → scenario with separately labeled failure impact
```

`project.json` is editable. `inspection.json` is regenerated from source and
compared against a fresh scan before a draft is used. `approval.json` stores the
model revision and source digest. Approval belongs to the exact current model;
neither CLI initialization nor an AI tool auto-approves a user's project.

`refresh` saves `project.previous.json`, rescans, preserves the owner's project
description, rebuilds structural capabilities, and invalidates approval. Owners
must review and reapply relevant capability corrections after source changes.

`launch-report.json` contains the input revision. The dashboard compares it with
current model, plan, prices, and optional runtime evidence. Runtime reports also
record the journey configuration revision. A modified test plan needs a new run.

## AI is an interpreter, not the arithmetic engine

Structural analysis works without a model. Automatic initialization uses its
evidence plus bounded source excerpts to fill the product model. It observes
declarations and lists unknowns; it cannot prove arbitrary business behavior. A model can reinterpret
the evidence and propose product language and synthetic personas. Generated
descriptions are labeled hypotheses. Unknown evidence IDs, selectors, paths,
and incompatible JSON are rejected. Human review remains necessary.

The MCP host can provide that interpretation using the owner's existing model.
Alternatively the CLI can call a configured compatible chat-completions endpoint.
No model, provider account, or token is installed automatically.
The automatic path detects existing Codex authentication, or an explicitly
configured compatible endpoint. Codex executes with user config/rules ignored,
read-only permissions and model tools disabled, in a disposable directory that
contains the output schema and generated response. Source context is supplied on stdin.
The input budget samples repetitive structural claims, then drops uncited evidence
and trailing source excerpts as needed; the payload records omissions. Owner-written
project text and evidence cited by retained draft claims are preserved. Input is
validated before a process is started. Temporary cleanup retries filesystem locks
and cannot replace an analysis result or hide the original inference error. Generated
output is schema/evidence checked before saving, never auto-approved, and an older
in-flight result cannot overwrite newer owner edits. Untouched example ad templates
are updated to reference the new model; custom budgets and ad copy are preserved.

## MCP capabilities

No bound root: `simulate_growth` only. An initialized `HYPOTHRA_PROJECT_ROOT` adds
read-only context, draft proposals, and approved-model launch calculations.
`HYPOTHRA_ALLOW_BROWSER=1` adds page discovery, journey proposals, and active journey
execution. There is no arbitrary path argument, shell tool, or approval tool.
The stdio entry point caps buffered input at 256 KiB and reserves stdout for MCP.

## Distribution

`scripts/package.mjs` bundles internal workspaces into separate CLI/MCP ESM entries
and declares external runtime dependencies in one private npm package. The archive
is generated under `work/releases/`. `verify-package.mjs` installs it in an
independent temporary consumer and proves init/approval/launch plus offline command
resolution. It does not depend on unpublished `@hypothra/*` packages at runtime.

This is an explicit archive distribution workflow. Publishing to npm is separate.
