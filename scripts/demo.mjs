import { cp, mkdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { approveProject, initializeProject, readJson, refreshProject, reviewProject, runLaunch, runProjectJourneys,
  saveExperimentFile, saveProjectDraft, startDashboard } from "@hypothra/product-lab";
import { startDemoApp } from "../examples/demo-product/server.mjs";

const repo = resolve(fileURLToPath(new URL("..", import.meta.url)));
const root = join(repo, "work", "demo-product");
await mkdir(root, { recursive: true });
await cp(join(repo, "examples", "demo-product"), root, { recursive: true });
const description = "Trailboard helps drivers save routes. This is a synthetic test product with mock signup and payment; mobile signup is deliberately broken.";
let draft;
try { await readFile(join(root, ".hypothra", "state.json")); }
catch { await initializeProject(root, description); }
try { draft = await reviewProject(root); }
catch { await refreshProject(root); draft = await reviewProject(root); }
const model = structuredClone(draft.model);
model.project = { name: "Trailboard · synthetic launch demo", description, descriptionBasis: "user", audience: ["Drivers planning weekend routes (synthetic example)"],
  valueProposition: "Save your first route after a quick signup", monetization: "Mock premium subscription: 19 PLN per month; no real billing" };
const saved = await saveProjectDraft(root, model, draft.revision);
// This approval is exclusively for this generated synthetic demo, never a user's project.
await approveProject(root, saved.revision);
const product = await startDemoApp(4179);
const journeys = JSON.parse(await readFile(join(repo, "examples", "demo-journeys.json"), "utf8"));
journeys.baseUrl = product.url;
await saveExperimentFile(root, "journeys", journeys);
const plan = await readJson(join(root, ".hypothra", "launch.json"));
plan.name = "TikTok route-planning launch · synthetic example";
plan.description = "Spend 2,000 PLN on a TikTok ad promising quick access to route saving. Compare assumed conversion with a real, deliberately broken mobile signup path.";
plan.channels[0].journeyId = "mobile-signup";
plan.channels[0].creative.message = "Your next great drive starts with a saved route.";
plan.channels[0].creative.promise = "Create an account and save your first route";
await saveExperimentFile(root, "launch", plan);
const runtime = await runProjectJourneys(root, { screenshots: true, stepTimeoutMs: 1500 });
const report = await runLaunch(root, true);
const dashboard = await startDashboard(root, 4317);
console.log(JSON.stringify({ dashboard: dashboard.url, testProduct: product.url, workspace: root,
  observedPaths: runtime.findings.map(item => ({ id: item.journeyId, status: item.status, failedStage: item.failedStage })),
  report: report.htmlPath, warning: "Synthetic demo data. No ads, real users, payments, or production services are involved." }, null, 2));
async function close() { await Promise.all([new Promise(resolve => dashboard.server.close(resolve)), new Promise(resolve => product.server.close(resolve))]); }
process.once("SIGINT", () => { void close(); });
process.once("SIGTERM", () => { void close(); });
