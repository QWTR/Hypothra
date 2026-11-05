# Using Hypothra

The primary launch workflow now uses an AI audience rather than owner-entered
conversion percentages. Follow [AI virtual launch](AI-REHEARSAL.md) for automatic
planning, individual viewer decisions, local AI browser visitors and optimization.
The manual funnel and scripted checks below remain under Advanced in the panel.

## 1. Start with the example

From the source checkout:

```powershell
cd D:\Hypothra
npm.cmd ci --ignore-scripts
npm.cmd run browser:install
npm.cmd run demo
```

Open `http://127.0.0.1:4317`. The example creates an isolated synthetic project,
an editable understanding, a launch plan, browser results, and an interactive
report. The deliberately broken mobile signup is expected to fail.

## 2. Choose your project — Hypothra stays separate

Run `npm start` from the Hypothra checkout, then open its local panel. Click
**Browse folders…** to choose an application or website, or paste its full path
and click **Open & analyze project**. Hypothra can stay in `D:\Hypothra` while
your app lives anywhere else. You do not need to move it or install Hypothra
as one of its dependencies.

The selected project gets a private `.hypothra/` analysis folder with its own
ignore file. AI fills the product description and fields automatically. Switching
folders reopens each project's own saved understanding, settings, and reports.
Save current edits before switching. **Browse folders…** opens a visible folder
browser inside the panel. Choose a drive, enter your project folder, then click
**Open & analyze this folder**. You can also paste a path in its address bar.

### Optional project-local CLI installation

First create the standalone archive:

```powershell
cd D:\Hypothra
npm.cmd run package
cd D:\MyTestProject
npm.cmd install --save-dev D:\Hypothra\work\releases\hypothra-0.2.0.tgz --ignore-scripts
npm.cmd exec --offline -- hypothra init .
```

Hypothra creates an ignore file inside its private analysis directory. Adding
`.hypothra/` to your root ignore file is optional. If you change root ignore rules
after analysis, refresh the scan because they form part of its source digest.
Initialization does not rewrite your source files or install the inspected
project's dependencies.

The package is not yet available from the public npm registry. Always install
the explicit local archive. After modifying Hypothra, rebuild its archive and
reinstall it in your test project to use the changes.

## 3. AI fills the details; you review and edit

You do not need to write a complete product description. `init` collects source
evidence and selected excerpts, then asks a signed-in Codex CLI or your configured
compatible engine to fill the name, description, target users, value proposition,
monetization, technology stack, features, and user journeys. You can optionally add
context with `--description`, but it is not required.

The first dashboard visit can finish this analysis automatically for a structural
draft. A progress card stays visible while AI works; the result appears in the
editable fields when ready. Review and correct it before confirming. Existing
owner-written descriptions are preserved, and editing during analysis never allows
an older result to overwrite newer saved corrections.

If Codex is not signed in, connect an engine once. A compatible endpoint can be
configured with `HYPOTHRA_AI_ENDPOINT`, `HYPOTHRA_AI_MODEL`, and a local token if
required. You can explicitly retry with **Analyze with AI**. Use `--no-ai` to opt
out for a project or `HYPOTHRA_AI_MODE=off` for a structural-only environment.

```powershell
npm.cmd exec --offline -- hypothra dashboard .
```

Use the local panel to inspect and correct the AI's interpretation. Normal fields
cover descriptions, technologies, features, user journeys, and remaining questions.
You can also edit `.hypothra/project.json` in your editor.

The panel now guides you through **Your product → Launch plan → App checks → Your
results**. Ordinary forms handle the description, audience, technologies, features,
budget, ads, and conversion assumptions. JSON stays under **Advanced**. Unsaved
changes remain in the forms while you move between steps or look up ad prices.

- `project`: name, description, target users, value proposition, and monetization.
- `stack`: technologies with observed evidence or user corrections.
- `capabilities`: what the product does, each with a stable ID and evidence status.
- `userJourneys`: human goals and textual steps.
- `unknowns`: questions that still need answers.
- `analysis`: generated metadata; preserve it.

Use `descriptionBasis: "user"` for your own description. Manual capability additions
can use `status: "user-confirmed"`; technology corrections can use
`provenance: "user-corrected"`. Do not invent evidence IDs. An observed declaration
does not prove the feature works.

For optional semantic interpretation, use a bound AI host through MCP or the
explicit `enrich` command described in the README. No model is required for the
structural draft or arithmetic.

## 4. Approve the exact model

Approve in the panel, or:

```powershell
npm.cmd exec --offline -- hypothra review .
npm.cmd exec --offline -- hypothra approve . --revision <displayed-64-character-hash>
```

Changing source or model content invalidates approval. `refresh` preserves
`project.previous.json`, regenerates the evidence and structural draft, and asks
for review again. Your product description is preserved; inspect and reapply
relevant detailed capability corrections from the previous model.

## 5. Describe the advertisement and budget

Edit the launch plan in the panel or `.hypothra/launch.json`:

- Set country, currency, total budget, fixed costs, acquisition period, and price.
- Add one or more channels with their allocated budgets and audiences.
- Write the advertisement's message, promise, and call to action.
- Map the promise to product capability IDs.
- Supply explicit low/typical/high CTR, signup, activation, and payment assumptions.
- Select a dated cost observation using `benchmarkId`.

The generated observations in `benchmarks.json` are tutorial assumptions. In
**Launch plan**, click **Find published prices**, inspect the source and dates,
choose **Use this cost estimate**, then save your plan. Public Meta/TikTok cost
lookup needs no advertising account or API key. Global scope and currency
conversions stay visible. See [advertising data](AD-DATA.md) for details and
optional additional sources.

```powershell
npm.cmd exec --offline -- hypothra launch .
```

Open `.hypothra/report.html`, or follow the panel's report link.

## 6. Define real local browser paths

Start a test version of your app with synthetic services. Install Chromium if
needed, then capture an inventory:

```powershell
npm.cmd exec -- playwright install chromium
npm.cmd exec --offline -- hypothra discover . --url http://127.0.0.1:5173/
```

`page-inventory.json` lists observed controls, labels, and selectors without input
values. Use it to write `journeys.json`. Alternatively, `plan-journeys` can ask a
compatible model to propose a schema-checked test plan using that inventory:

```powershell
npm.cmd exec --offline -- hypothra plan-journeys . --endpoint http://127.0.0.1:11434/v1/chat/completions --model <your-model> --allow-upload
```

Review `.hypothra/journeys.proposed.json` before copying its approved contents to
`.hypothra/journeys.json`. Planning does not execute the proposed actions. The
local model example requires a separately installed and running compatible server.

A journey consists of a synthetic persona, a goal, a hypothesis, a viewport,
permission choice, capability IDs, and explicit actions/assertions. For example:

```json
{
  "id": "first-visit",
  "persona": "New visitor (synthetic)",
  "goal": "Find the product's main promise",
  "hypothesis": "A visitor can see the main value proposition",
  "capabilityIds": [],
  "viewport": { "width": 390, "height": 844 },
  "denyPermissions": true,
  "steps": [
    { "action": "navigate", "path": "/", "stage": "landing" },
    { "action": "expectText", "selector": "h1", "text": "Your product headline", "stage": "landing" }
  ]
}
```

The top-level file also contains `schemaVersion: 1`, your explicit `baseUrl`,
`environment: "local-test"`, and a `journeys` array. See the complete
[`demo-journeys.json`](../examples/demo-journeys.json) for signup and permission cases.
When `denyPermissions` is false, the runner grants only a synthetic geolocation at
0,0. It never uses your real location.

```powershell
npm.cmd exec --offline -- hypothra journeys . --screenshots
npm.cmd exec --offline -- hypothra launch . --with-runtime
```

You can also click **Run app checks** in step 3, then **Calculate launch scenario**
in step 4. The normal panel workflow requires no terminal commands after startup.

Map a channel's `journeyId` to a real configured journey to attach its findings.
An attached failed path produces a separately labeled conditional impact scenario.
Changing journey definitions requires rerunning the browser experiment.

## 7. Know what to change after a failure

- A missing selector can mean the test plan is wrong; review the screenshot and UI.
- A reproduced failing interaction with a correct assertion may reveal an app bug.
- A low assumed conversion rate may reflect an uncertain assumption, not a bug.
- An expensive observed CPM applies to the specific source and segment, not all ads.

Correct the application or experiment as appropriate, refresh source analysis if
code changed, review and approve again, then rerun. Keep observations separate
from explanations. Native mobile automation and production load tests are not
implemented in this release.
