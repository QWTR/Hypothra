# Hypothra

**Understand the product. Challenge the launch. Test the path.**

Hypothra is an open-source product laboratory for developers and AI agents.
It connects evidence from a software project with an editable product model,
an advertising launch scenario, and real browser checks against a local test app.

Our mission is to make the journey from an advertisement's promise to a product's
actual behavior inspectable before a team spends its launch budget.

```text
Project + your description
          ↓
Bounded source analysis → evidence, stack, screens, routes, data operations
          ↓
Editable understanding → your corrections → exact-revision approval
          ↓
Launch plan + dated advertising evidence + explicit conversion assumptions
          ↓
Synthetic personas → real local browser journeys → observed failures
          ↓
Interactive report: scenarios, evidence, uncertainties, and conditional bug impact
```

**v0.2.0 is a working local development release.** Source analysis is structural;
semantic interpretation and AI-planned journeys are optional integrations. Price
connectors require your own authorized advertising account. Personas are synthetic,
and their reactions are hypotheses. A reproduced application error is runtime
evidence. Neither layer proves future demand or a real conversion rate.

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

## Install Hypothra inside another project

Build a portable npm package from the source checkout:

```sh
npm run package
```

Then, from a **disposable copy** of your project, install the explicit generated
archive. Windows example:

```powershell
cd D:\MyTestProject
npm.cmd install --save-dev D:\Hypothra\work\releases\hypothra-0.2.0.tgz --ignore-scripts
npm.cmd exec --offline -- hypothra init . --description "What this product does and who it serves"
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
npm exec -- hypothra init . --description "A route planner with a paid premium tier"
npm exec -- hypothra review .
# Correct .hypothra/project.json or use the local dashboard.
npm exec -- hypothra approve . --revision <hash-shown-by-review>
npm exec -- hypothra launch .
```

The project model contains the description, audience, value proposition, technology
stack, capabilities, user journeys, unknowns, and source evidence references.
The user can correct it before approving. Source or model edits invalidate approval;
`hypothra refresh` rescans and preserves the previous model for comparison.

Initialization never executes the inspected project's scripts. It creates private
working files under `.hypothra/` and keeps the legacy `hypothra.scenario.json`
example available for v0.1 commands. Add `.hypothra/` to your own project's ignore
file before sharing that project.

### Make the understanding model-assisted

Two paths are available:

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

## What the launch report means

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
| `@hypothra/product-lab` | Understanding, approval, ads, launch scenarios, browser tests, optional AI, reports, dashboard |
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
`simulate_product_launch`. Set `HYPOTHRA_ALLOW_BROWSER=1` explicitly to additionally
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

The default workflow makes no model or advertising-account requests. Optional
integrations require explicit commands and local credentials. Browser routing
limits requests to the chosen test origin, but the test application's backend can
still perform its own side effects. Use synthetic data and isolated services.
Screenshots may contain whatever you put in that test app and remain local.
Read [SECURITY.md](SECURITY.md) before using sensitive projects.

## Roadmap

- [x] Source evidence, editable understanding, and exact-revision approval
- [x] Launch funnel with explicit budgets, creatives, source dates, and assumptions
- [x] CSV cost import and optional read-only account connectors
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
