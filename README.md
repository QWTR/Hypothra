# Hypothra

**Understand the product. Challenge the launch. Test the path.**

Hypothra is an open-source product laboratory for developers and AI agents.
It connects evidence from a software project with an editable product model,
an AI-generated virtual audience, and real AI-directed browser visits to a local test app.

Our mission is to make the journey from an advertisement's promise to a product's
actual behavior inspectable before a team spends its launch budget.

```text
Project + your description
          ↓
Bounded source analysis → evidence, stack, screens, routes, data operations
          ↓
Editable understanding → your corrections → exact-revision approval
          ↓
AI-proposed costs, audience segments and reel script + published ad-price references
          ↓
Individual AI viewers → watch / click / try decisions, each with a saved reason
          ↓
Interested AI visitors → real local browser actions → observed failures + synthetic opinions
          ↓
Optimization recommendations, evidence, exact counts and saved launch variants
```

**v0.2.0 is a working local development release.** Initialization automatically asks
AI to turn source evidence into a filled, editable product understanding. It uses
a signed-in Codex CLI or a compatible engine configured once. Published
ad costs can be read from the public web without a Meta/TikTok account or API key.
Your own account history remains an optional additional source. Personas are synthetic,
and their reactions are hypotheses. A reproduced application error is runtime
evidence. Neither layer proves future demand or a real conversion rate.

The primary launch workflow no longer asks for CTR or signup percentages. AI fills
the plan, then evaluates each requested viewer individually in resumable batches.
Targets up to **100,000 viewers** and **5,000 local browser visitors** are accepted;
only actually completed records count. A large target can require thousands of model
requests and considerable account usage. The default is a 20-person pilot.

## Try the complete example

Requires Node.js **22+**, npm, and Git. On Windows, use `npm.cmd` when PowerShell
blocks `npm.ps1`.

```sh
git clone https://github.com/QWTR/Hypothra.git
cd Hypothra
npm ci --ignore-scripts
npm run browser:install
npm test
npm run demo
```

The demo prints two local URLs:

- `http://127.0.0.1:4317` — product review, experiment editing, and launch reports.
- `http://127.0.0.1:4179` — a synthetic route-planning product.

It scans an isolated copy under `work/demo-product`, approves **only that generated
fixture**, and runs three real browser paths: desktop signup, deliberately broken
mobile signup, and permission-denial fallback. The report shows how a failing
signup path could invalidate an otherwise attractive advertising scenario.

No real accounts, messages, advertisements, payments, or production services are
involved. Stop the demo with Ctrl+C. The ports must be free.

## Choose any project folder

Hypothra does **not** need to live inside the application being analyzed. From
the Hypothra checkout, run:

```powershell
cd D:\Hypothra
npm.cmd start
```

Open the printed local URL, click **Browse folders…**, and choose your project.
You can also paste an absolute path and click **Open & analyze project**. Hypothra
initializes its private analysis folder there and fills the product details with
AI automatically. App source files and dependencies stay where they are.

Use the same picker to switch projects. Each project retains its own understanding,
corrections, launch plan, and reports. The folder browser opens directly inside
the panel, with drive buttons, parent navigation, and an editable path. No desktop
popup is required. No project is scanned before
you select it. A private `.hypothra/.gitignore` keeps analysis artifacts out of Git.

In step 2, choose **Let AI prepare my virtual launch**. A reel idea and budget
constraints are optional. Review or edit the AI's script, audience, costs and
published price references, then start the audience. Pause/resume and inspect
individual decisions at any point. Step 3 can send interested synthetic installers
through a deliberately selected local app with dummy data. Step 4 recommends
marketing and product changes with evidence. See [AI rehearsal](docs/AI-REHEARSAL.md).

## Optional: install the CLI inside a project

Build a portable npm package from the source checkout:

```sh
npm run package
```

Then, from a **disposable copy** of your project, install the explicit generated
archive. Windows example:

```powershell
cd D:\MyTestProject
npm.cmd install --save-dev D:\Hypothra\work\releases\hypothra-0.2.0.tgz --ignore-scripts
npm.cmd exec --offline -- hypothra init .
npm.cmd exec --offline -- hypothra dashboard .
```

The archive bundles Hypothra's internal workspaces and declares public runtime
dependencies. It can be installed independently of the monorepo. Installation
still needs npm registry access for those dependencies. Browser execution additionally
needs Chromium; run `npm exec -- playwright install chromium` in the consumer project.

Nothing is published to npm. The generated package is marked private. Do not use
bare `npx hypothra` as an installation shortcut: ownership of the public npm name
has not been established.

## A real project workflow

Inside the source checkout you can use these same commands with an explicit project
directory instead of `.`:

```sh
npm exec -- hypothra init .
npm exec -- hypothra review .
# Correct .hypothra/project.json or use the local dashboard.
npm exec -- hypothra approve . --revision <hash-shown-by-review>
npm exec -- hypothra rehearse prepare . --viewers 20 --max-ai-calls 100
npm exec -- hypothra rehearse run . --max-ai-calls 100
```

The project model contains the description, audience, value proposition, technology
stack, capabilities, user journeys, unknowns, and source evidence references.
AI fills these fields from selected source excerpts; the owner reviews and corrects
them instead of completing an empty form. An optional `--description` supplies extra
context. `--no-ai` explicitly skips automatic inference. The user can correct any
project field before approving. Source or model edits invalidate approval;
`hypothra refresh` rescans and preserves the previous model for comparison.

Initialization never executes the inspected project's scripts. It creates private
working files under `.hypothra/`, with a local ignore file, and keeps the legacy
`hypothra.scenario.json` example available for v0.1 CLI commands.

The deterministic `launch` and `simulate` commands remain available as advanced
comparison tools. Their assumed funnels are separate from the AI viewer engine.

### Automatic AI understanding

`init` detects a signed-in local Codex CLI and uses it without requiring a separate
model API key. The dashboard also starts a first analysis for an existing structural
draft and shows progress until the fields are ready. It does not rerun an already
analyzed project or erase subsequent owner edits. **Re-analyze with AI** is an
explicit retry; a pre-analysis copy is saved as `project.before-ai.json`.

The CLI runs in a disposable directory with read-only permissions and model tools,
apps, hooks, and memory disabled. It receives bounded, redacted source excerpts
and existing evidence, not unrestricted project filesystem access. Normal model
account usage applies. [Codex supports saved authentication and structured exec
output](https://learn.chatgpt.com/docs/non-interactive-mode).

If no engine is connected, the panel explains that once instead of pretending a
structural template was generated by AI. Set `HYPOTHRA_AI_MODE=off` for structural-only
or CI runs. The regular test suite disables live inference automatically.

Two alternative integration paths remain available:

1. Bind the MCP server to the initialized project. Your existing AI host can read
   evidence and propose a corrected model. It cannot approve that model for you.
2. Explicitly call a compatible chat-completions endpoint:

```sh
hypothra enrich . --endpoint http://127.0.0.1:11434/v1/chat/completions --model <your-installed-model> --allow-upload
```

This example assumes you separately run a compatible local model server; Hypothra
does not install a model or claim one is running. Remote endpoints require HTTPS,
a locally configured token, and the same explicit upload flag. Only the sanitized,
bounded evidence and draft are sent, never the raw project tree. Redaction is
best-effort; inspect the data and provider terms before opting in.

### Define and test the launch

Edit `.hypothra/launch.json` with your total budget, fixed costs, audience, creative,
advertising allocation, pricing, and ranges for CTR, signup, activation, and payment.
Map each advertisement's promise to product capability IDs.

Advertising observations live in `.hypothra/benchmarks.json`. Each records its
platform, country, currency, objective, price range, source, and observation dates.
Generated prices are clearly marked **synthetic assumptions**. CSV imports and
read-only Meta/TikTok adapters can replace them with your own observed data.
Old or mismatched measured evidence is rejected. See [advertising data](docs/AD-DATA.md).

The normal panel uses four guided steps and ordinary forms; JSON is an advanced
option. In **Launch plan**, click **Find published prices** to read public Meta and
TikTok CPM/CPC benchmarks from AdKit, with the source period and published range.
Choose **Use this cost estimate**, then save the plan. No advertising API key is
needed. Global samples are labeled as global, and USD figures can be converted
with a dated public NBP reference rate. The CLI equivalent is:

```sh
hypothra ads research . --currency PLN
```

For a local test version of your app:

```sh
hypothra discover . --url http://127.0.0.1:5173/
# Write journeys from the observed selectors, or ask an explicitly configured model:
hypothra plan-journeys . --endpoint <chat-completions-url> --model <name> --allow-upload
# Review journeys.proposed.json, then adopt its approved contents as journeys.json.
hypothra journeys . --screenshots
hypothra launch . --with-runtime
```

Discovery reads rendered controls without capturing their input values. Model
proposals must use discovered selectors and paths. Planning never executes the
proposed interactions. Browser tests use new isolated Chromium contexts and an
explicit loopback origin. They do not yet automate native Android or iOS apps.

## Advanced deterministic report

The funnel calculates impressions, clicks, signups, activation, paying users,
first subscription-month revenue, service costs, and profit for three assumption
combinations. Expected counts can be fractional. These ranges are not statistical
confidence intervals. Creative text does not magically determine a conversion rate.

A channel can be mapped to a tested journey. If signup fails, the report preserves
the original assumed funnel and adds a **conditional impact scenario**: what if
every visitor takes that same failing path? It never turns a few synthetic personas
into a claimed population conversion measurement.

JSON, Markdown, and standalone interactive HTML reports are saved under `.hypothra/`.
The dashboard refuses to present stale reports as current after inputs change.

## Architecture

| Workspace | Responsibility |
| --- | --- |
| `@hypothra/project-scanner` | Bounded, read-only structural inspection and evidence |
| `@hypothra/product-lab` | Understanding, approval, AI audience jobs, AI browser visitors, ads, legacy scenarios, reports and dashboard |
| `@hypothra/simulation-core` | Original pure deterministic growth engine |
| `@hypothra/cli` | Commands for source and independently installed packages |
| `@hypothra/mcp-server` | Project-scoped tools for compatible AI hosts |

See [architecture](docs/ARCHITECTURE.md), [user guide](docs/USER-GUIDE.md),
[changing the code](docs/DEVELOPMENT.md), and [testing](docs/TESTING.md).

## MCP configuration

Example for the source checkout:

```json
{
  "mcpServers": {
    "hypothra": {
      "command": "node",
      "args": ["D:/Hypothra/packages/mcp-server/dist/index.js"],
      "env": { "HYPOTHRA_PROJECT_ROOT": "D:/MyTestProject" }
    }
  }
}
```

Without a root, only legacy `simulate_growth` is exposed. A bound initialized root
adds `get_project_understanding`, `propose_project_understanding`, and
`simulate_product_launch`, plus `research_ad_costs` for public web benchmarks.
Set `HYPOTHRA_ALLOW_BROWSER=1` explicitly to additionally
expose test-page discovery, journey proposals, and execution of the active local
journeys. Browser access is off by default. No approval or shell-execution tool exists.

The [official MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
handles stdio transport. Actual configuration in a specific AI host is a separate
validation step; protocol integration tests do not imply your host is connected.

## Security, testing, and limits

```sh
npm test                 # builds, then runs unit/process/MCP/real Chromium checks
npm run package:verify   # installs the archive in an independent disposable project
npm audit
```

CI runs Windows and Linux with Node 22 and 24. The scanner applies file, byte,
depth, and entry budgets, skips secrets and links, and honors root `.gitignore`
and `.hypothraignore` rules. JavaScript/TypeScript AST extraction, basic Python
routes, Prisma declarations, HTML/CSS, and selected manifests are supported;
dynamic behavior and arbitrary frameworks require review.

Automatic understanding uses your configured model account. Structural-only
commands and `init --no-ai` make no model calls. No advertising-account access is
needed for published price lookup. Optional account-history integrations require
explicit commands and local credentials. Browser routing
limits requests to the chosen test origin, but the test application's backend can
still perform its own side effects. Use synthetic data and isolated services.
Screenshots may contain whatever you put in that test app and remain local.
Read [SECURITY.md](SECURITY.md) before using sensitive projects.

## Roadmap

- [x] AI-proposed creative, audience, budget and costs without conversion forms
- [x] Individual AI viewer decisions, exact counts, request caps and resumable jobs
- [x] AI-directed local browser visitors, observed evidence and optimization recommendations
- [ ] Real-video/audio interpretation and empirical calibration against small real campaigns
- [ ] Native mobile exploration and separate concurrent load tests

- [x] Source evidence, editable understanding, and exact-revision approval
- [x] Launch funnel with explicit budgets, creatives, source dates, and assumptions
- [x] CSV cost import and optional read-only account connectors
- [x] Guided forms, in-panel local app checks, and public-web ad costs without account credentials
- [x] Real local browser journeys, DOM discovery, and observed failure reporting
- [x] Optional model-assisted interpretation and validated journey proposals
- [x] Local dashboard, interactive reports, scoped MCP tools, and portable archive
- [ ] Broader framework parsers and nested ignore semantics
- [ ] Calibrated response models and seeded stochastic experiments
- [ ] Native mobile automation and separately authorized staging environments
- [ ] Live account/provider validation and AI-host-specific compatibility matrix
- [ ] Intentional npm publication after package-name and release review
- [ ] Infrastructure benchmarks against isolated services

## License

[MIT](LICENSE): a short, permissive starting point for reuse and contributions.
Dependencies retain their own licenses. No trademark, domain, or npm-name
availability claim is made.
