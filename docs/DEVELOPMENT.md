# Changing Hypothra's code

Use an editor such as VS Code to open the source checkout, for example `D:\Hypothra`.
Edit `src` files; `dist` files are generated and will be replaced by the build.
Code, comments, UI, and documentation are English.

## Where to change each behavior

| What you want to change | File |
| --- | --- |
| Recognized frameworks and source evidence | `packages/project-scanner/src/inspect.ts` |
| Scan limits, ignored directories, redaction | `packages/project-scanner/src/inspect.ts` |
| Generated understanding and unknowns | `packages/product-lab/src/understanding.ts` |
| Editable fields and validation rules | `packages/product-lab/src/schema.ts` |
| Approval, refresh, stale evidence behavior | `packages/product-lab/src/workflow.ts` |
| Launch arithmetic, budget checks, default assumptions | `packages/product-lab/src/launch.ts` |
| Advertising CSV parsing and read-only integrations | `packages/product-lab/src/ads.ts` |
| Optional model instructions and output checks | `packages/product-lab/src/ai.ts` |
| Rendered control discovery | `packages/product-lab/src/discovery.ts` |
| Browser actions, assertions, and permissions | `packages/product-lab/src/journeys.ts` |
| Panel structure, forms, and local HTTP endpoints | `packages/product-lab/src/dashboard.ts` |
| Report layout, styling, and wording | `packages/product-lab/src/report.ts` |
| Terminal commands and help | `packages/cli/src/index.ts` |
| AI-host tools and root scope | `packages/mcp-server/src/server.ts` |
| Portable package contents | `scripts/package.mjs` |
| Synthetic test application | `examples/demo-product/server.mjs` |

## Normal edit/test loop

```powershell
cd D:\Hypothra
git status
# Edit source in your editor.
npm.cmd run build
npm.cmd test
npm.cmd run demo
```

Stop an existing demo before starting another; it uses ports 4317 and 4179.
Reloading the browser alone does not reload the Node server's source modules.
Restart the demo after code changes. You do not need to reinstall dependencies
after every edit. Run `npm install --ignore-scripts` when changing package dependencies.

To run only one relevant test file after building:

```powershell
node --test tests/lab.test.mjs
node --test tests/journeys.test.mjs
node --test tests/mcp-lab.test.mjs
```

The legacy CLI test uses npm's execution path; run that file through
`npm exec -- node --test tests/cli.test.mjs` or simply use `npm test`.

## Example: recognize another technology

Add a dependency mapping to the `technologies` object in `inspect.ts`:

```ts
"some-framework": ["Some Framework", "backend"],
```

Use the exact package name. Add a small scanner fixture proving that declaration
creates evidence at the correct file/line. Do not call a declared package a deployed
service or infer production capacity from it.

## Example: change a launch assumption

For a single experiment, edit `.hypothra/launch.json` or the panel instead of source.
For the default template used by future initializations, change `defaultLaunch`
in `launch.ts`. Existing workspaces keep their saved assumptions. Formula changes
need a hand-calculated test and an updated model identifier/specification.

## Example: change the optional AI behavior

Edit the system instructions in `ai.ts`, then test with a controlled synthetic
response. Preserve untrusted-data handling, evidence/selector validation, explicit
upload consent, generated-hypothesis labels, and human review. Do not let model
output become arbitrary executable code or automatic approval.

## Example: add a browser assertion

Add its schema to the discriminated union in `schema.ts`, implement it in
`journeys.ts`, and add a fixture where it both passes and fails. Keep execution
within the local target and time/request budgets. Update AI planning instructions
only after the action has a tested contract. Never add raw JavaScript evaluation
as an agent-supplied step.

## Update an independently installed copy

```powershell
cd D:\Hypothra
npm.cmd run package:verify
cd D:\MyTestProject
npm.cmd install --save-dev D:\Hypothra\work\releases\hypothra-0.2.0.tgz --ignore-scripts
```

The archive includes internal workspace code; installing only one workspace folder
is not the supported distribution method. A source edit does not automatically
update an archive already installed in another project.

## Save and publish code changes

Review your diff, run the tests, and commit intentional source files. Avoid
`git add .` in an inspected application until `.hypothra/` is ignored. In Hypothra's
own repository, working artifacts, dependencies, and generated code are ignored.

```powershell
git diff
git status
git add <specific-files>
git commit -m "Describe the behavior you changed"
git push
```

GitHub Actions checks Windows/Linux, Node 22/24, real browser fixtures, and independent
archive installation. A local pass and a green CI run are separate pieces of evidence.
Do not publish to npm until package ownership and release policy are deliberately set.
