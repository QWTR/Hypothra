# Hypothra

**Don't guess what happens next. Simulate your assumptions.**

Hypothra is an open-source foundation for reproducible software business simulations.
It turns explicit assumptions about acquisition, retention, subscriptions, and costs
into inspectable results that developers and AI tools can reproduce.

Our mission is to make technical and business decisions easier to test before teams
commit time and money. The long-term direction combines project analysis, calibrated
models, and agent-accessible experiments. The first step is a small engine whose
arithmetic can be checked by hand.

> **v0.1.0 is an early local foundation.** It contains a deterministic growth model,
> a working CLI, a local MCP server exposing one simulation tool, and a manifest-only
> scanner scaffold. It does not predict startup success, infer infrastructure capacity,
> train an AI model, or run load tests.

## Quickstart

Requires Node.js **22 or newer**, npm, and Git. PowerShell users can use `npm.cmd`
if their execution policy blocks `npm.ps1`.

```sh
git clone https://github.com/QWTR/Hypothra.git
cd Hypothra
npm ci --ignore-scripts
npm run build
npm test
npm run simulate
```

The workspace CLI is available after installation and build:

```sh
npm exec -- hypothra --help
npm exec -- hypothra init
npm exec -- hypothra simulate --config hypothra.scenario.json
npm exec -- hypothra analyze ./packages/cli
```

`init` creates a JSON scenario in your current directory and refuses to overwrite
an existing file. `simulate` without flags runs the built-in example. `analyze`
reads only the selected directory's `package.json` and reports dependency names.

**Nothing has been published to npm.** These commands use local workspaces.
Do not use bare `npx hypothra` to install this project: the public npm name is
unverified and could belong to someone else. All packages are currently private
to prevent accidental publishing; the source code is public under MIT.

## A first experiment

The example starts with 1,000 active users, spends 500 USD per month at a cost
of 5 USD per acquired user, assumes 5% monthly churn and 2% organic growth,
and converts 10% of active users to a 10 USD monthly subscription.

Month one is deliberately easy to audit:

```text
Retained users  = 1,000 × (1 − 0.05)                    = 950
Active users    = 950 × (1 + 0.02) + 500 / 5            = 1,069
Paying users    = 1,069 × 0.10                         = 106.9
Revenue         = 106.9 × 10                           = 1,069 USD
Costs           = 500 + 200 + 1,069 × 0.10              = 806.90 USD
Profit          = 1,069 − 806.90                        = 262.10 USD
```

Fractional users represent expected population sizes. This is a scenario model,
not individual customer behavior. Rates stay constant, acquisition is immediate,
and every month's active users are eligible for conversion. There are no taxes,
refunds, annual plans, capacity constraints, or uncertainty distributions yet.
All monetary inputs must use the same currency; no currency conversion occurs.

Change one assumption in `hypothra.scenario.json`, rerun, and compare the JSON
results. The output includes the model version and a copy of the assumptions.
See [the model specification](docs/MODEL.md) for equations, bounds, and rounding.

## Architecture

```text
Developer ── CLI ───────────────┐
                               ├── simulation-core ── deterministic JSON result
AI host ── MCP (local stdio) ───┘

Developer ── CLI analyze ── project-scanner ── package.json dependency inventory
```

| Workspace | Responsibility | Current status |
| --- | --- | --- |
| `@hypothra/simulation-core` | Pure validation and simulation arithmetic | Working deterministic growth model |
| `@hypothra/cli` | Local commands and explicit JSON file input | `init`, `simulate`, `analyze`, help, version |
| `@hypothra/mcp-server` | Agent-facing tool interface | Working `simulate_growth` tool over stdio |
| `@hypothra/project-scanner` | Bounded project inventory | Scaffold: root manifest only |

The core has no runtime dependencies and performs no I/O. CLI and MCP use the
same core; the agent does not invent the arithmetic. There is no LLM API dependency,
cloud service, database, telemetry, or API key requirement.

See [architecture](docs/ARCHITECTURE.md) and [contributing](CONTRIBUTING.md).

## Connect an MCP host

Build first, then add a local stdio server to a compatible host's MCP configuration.
For the default Windows checkout:

```json
{
  "mcpServers": {
    "hypothra": {
      "command": "node",
      "args": ["D:/Hypothra/packages/mcp-server/dist/index.js"]
    }
  }
}
```

Replace the path for a different checkout. The host must be able to find `node`;
use the full executable path if necessary. Host-specific settings and support vary.
This repository does not modify your agent settings automatically.

The only exposed tool is `simulate_growth`. It accepts all fields from
[`examples/growth.scenario.json`](examples/growth.scenario.json) as tool arguments
and returns text JSON plus structured content. It cannot scan your disk, execute
commands, make requests, or edit files. Protocol output is reserved for stdout.
The implementation follows the [official TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk).

## Testing and security

```sh
npm test         # builds all workspaces, then runs unit and process integration tests
npm audit        # checks installed dependency advisories; requires registry access
```

Tests cover a hand-calculated reference case, repeatability, validation bounds,
real CLI processes, non-overwriting initialization, bounded scanner fixtures,
and a real MCP client/server exchange over stdio. No paid APIs or production
projects are involved. [Testing guide](docs/TESTING.md) explains the next layers.

Runtime simulations have no network access in their implementation. Installation
and dependency audits contact npm; `--ignore-scripts` prevents dependency lifecycle
scripts during installation. MCP accepts bounded numeric inputs only and exposes
no filesystem tool. The scanner is deliberately limited to a single manifest and
does not read `.env`, recurse into source, or run package scripts. Manifest contents
are untrusted data. These checks are not an operating-system sandbox: scan copies
or fixtures, not directories being actively modified by an adversary.

See [SECURITY.md](SECURITY.md) for the threat boundaries and vulnerability reporting.

## Roadmap

- [x] Deterministic growth model with explicit assumptions and bounded inputs
- [x] TypeScript npm workspaces, CLI, unit tests, and process integration tests
- [x] Local MCP transport with one working simulation tool
- [x] Manifest-only project scanner scaffold
- [ ] Scenario comparison, sensitivity analysis, and versioned result files
- [ ] Seeded stochastic models with documented distributions and calibration
- [ ] Scanner allowlists, ignore rules, AST extraction, and provenance for findings
- [ ] Explicitly authorized load testing against isolated local fixtures
- [ ] Host-level MCP validation in a real AI client
- [ ] Package-name checks, release automation, and an intentional first npm release
- [ ] Optional model-assisted interpretation with opt-in data sharing

Features on the roadmap are not implemented capabilities. Real infrastructure
claims will require measurements from controlled benchmarks.

## License

[MIT](LICENSE). We chose a short, permissive license to make the initial engine
easy to study, reuse, and contribute to. Third-party dependencies retain their
own licenses. No trademark or package-name availability claim is made.
