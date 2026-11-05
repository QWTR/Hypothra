#!/usr/bin/env node
import { lstat, open, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { exampleScenario, simulateGrowth } from "@hypothra/simulation-core";
import { inspectProject, scanProject } from "@hypothra/project-scanner";
import { approveProject, benchmarksSchema, enrichUnderstanding, fetchAccountCosts, importCostCsv, initializeProject,
  projectStatus, readJson, refreshProject, reviewProject, runLaunch, runProjectJourneys, saveExperimentFile,
  saveProjectDraft, startDashboard, workspace, inspectTestPage, readProjectContext, suggestJourneys, withLock, writeArtifact, findPublicPrices } from "@hypothra/product-lab";

const help = `Hypothra 0.2.0 — understand your product and test a launch

Usage:
  hypothra init [directory] --description "What the product does"
  hypothra analyze [directory]           Inspect allowlisted project files without executing them
  hypothra analyze [directory] --manifest  Legacy package.json (scanner scaffold)
  hypothra review [directory]            Show understanding, evidence, unknowns, and revision
  hypothra approve [directory] --revision <hash>
  hypothra refresh [directory]           Rescan; preserve previous model and invalidate approval
  hypothra dashboard [directory] [--port 4317]
  hypothra launch [directory] [--with-runtime]
  hypothra journeys [directory] [--screenshots]
  hypothra discover [directory] --url http://127.0.0.1:4179/
  hypothra plan-journeys [directory] --endpoint <chat-completions-url> --model <name> --allow-upload
  hypothra status [directory]
  hypothra enrich [directory] --endpoint <chat-completions-url> --model <name> --allow-upload
  hypothra ads import [directory] --file <csv> --platform meta --country PL --currency PLN
    --objective traffic --audience "Selected audience" --source <https-url> --id <benchmark-id>
  hypothra ads refresh [directory] --platform meta --account <numeric-id> --country PL
    --currency PLN --objective traffic --audience "Selected audience" --since YYYY-MM-DD --until YYYY-MM-DD
  hypothra ads research [directory] [--currency PLN]  Read published web benchmarks; no ad account needed
  hypothra simulate [--config <file>]     Legacy deterministic growth model
  hypothra --help
  hypothra --version

Initialize, correct .hypothra/project.json, review, and approve before launch or browser tests.
Browser journeys require an explicit local test origin and synthetic data.
No ads are bought. Optional AI uploads and account API reads require explicit commands.
Packages are local development workspaces; they are not published to npm.`;

const json = (value: unknown) => console.log(JSON.stringify(value, null, 2));
function flags(args: string[], names: string[], booleans: string[] = []) {
  const values = new Map<string, string>();
  let directory: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (!names.includes(key) && !booleans.includes(key) || values.has(key)) throw new Error(`Unknown or repeated option: ${arg}`);
      if (booleans.includes(key)) values.set(key, "true");
      else { const value = args[++index]; if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`); values.set(key, value); }
    } else if (!directory) directory = arg;
    else throw new Error("Only one project directory may be supplied.");
  }
  return { directory: directory ?? ".", values, required: (key: string) => { const value = values.get(key); if (!value) throw new Error(`Missing --${key}`); return value; } };
}

async function readCsv(path: string) {
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isFile() || info.size > 1024 * 1024) throw new Error("CSV must be a regular non-symlink file of at most 1 MiB.");
  const file = await open(path, "r");
  try {
    const buffer = Buffer.alloc(1024 * 1024 + 1); let count = 0;
    while (count < buffer.length) { const part = await file.read(buffer, count, buffer.length - count, count); if (!part.bytesRead) break; count += part.bytesRead; }
    if (count > 1024 * 1024) throw new Error("CSV exceeds its byte budget.");
    return buffer.subarray(0, count).toString("utf8");
  } finally { await file.close(); }
}

async function main(args: string[]) {
  const [command, ...rest] = args;
  if ((!command || command === "--help" || command === "help") && !rest.length) return console.log(help);
  if (command === "--version" && !rest.length) return console.log("0.2.0");
  if (command === "simulate") {
    if (!rest.length) return json(simulateGrowth(exampleScenario));
    if (rest.length === 2 && rest[0] === "--config" && rest[1]) return json(simulateGrowth(await readJson(rest[1], undefined, 65_536)));
    throw new Error("Use simulate or simulate --config <file>.");
  }
  if (command === "init") {
    const options = flags(rest, ["description"]);
    const result = await initializeProject(options.directory, options.values.get("description"));
    await writeFile(join(options.directory, "hypothra.scenario.json"), JSON.stringify(exampleScenario, null, 2) + "\n", { flag: "wx" }).catch((error: NodeJS.ErrnoException) => { if (error.code !== "EEXIST") throw error; });
    return json(result);
  }
  if (command === "analyze") {
    const options = flags(rest, [], ["manifest"]);
    return json(options.values.has("manifest") ? await scanProject(options.directory) : await inspectProject(options.directory));
  }
  if (command === "review" || command === "status" || command === "refresh") {
    const options = flags(rest, []);
    if (command === "review") { const review = await reviewProject(options.directory); console.log(review.markdown); return; }
    return json(command === "status" ? await projectStatus(options.directory) : await refreshProject(options.directory));
  }
  if (command === "approve") {
    const options = flags(rest, ["revision"]); return json(await approveProject(options.directory, options.required("revision")));
  }
  if (command === "launch") {
    const options = flags(rest, [], ["with-runtime"]); return json(await runLaunch(options.directory, options.values.has("with-runtime")));
  }
  if (command === "journeys") {
    const options = flags(rest, [], ["screenshots"]); return json(await runProjectJourneys(options.directory, { screenshots: options.values.has("screenshots") }));
  }
  if (command === "dashboard") {
    const options = flags(rest, ["port"]);
    const dashboard = await startDashboard(options.directory, options.values.has("port") ? Number(options.required("port")) : 4317);
    console.log(`Hypothra local dashboard: ${dashboard.url}`); return;
  }
  if (command === "enrich") {
    const options = flags(rest, ["endpoint", "model", "env-file"], ["allow-upload"]);
    if (options.values.has("env-file")) process.loadEnvFile(options.required("env-file"));
    const draft = await reviewProject(options.directory);
    const model = await enrichUnderstanding(draft.model, draft.inspection, { endpoint: options.required("endpoint"), model: options.required("model"), allowUpload: options.values.has("allow-upload") });
    return json(await saveProjectDraft(options.directory, model, draft.revision));
  }
  if (command === "discover") {
    const options = flags(rest, ["url"]);
    await readProjectContext(options.directory, true);
    const inventory = await inspectTestPage(options.required("url"));
    await withLock(options.directory, path => writeArtifact(path, "page-inventory.json", inventory));
    return json({ status: "discovered", inventory, next: "Use plan-journeys with a configured model, or write explicit journey steps from these observed selectors." });
  }
  if (command === "plan-journeys") {
    const options = flags(rest, ["endpoint", "model", "env-file"], ["allow-upload"]);
    if (options.values.has("env-file")) process.loadEnvFile(options.required("env-file"));
    const context = await readProjectContext(options.directory, true);
    const path = await workspace(options.directory);
    const inventory = await readJson<Parameters<typeof suggestJourneys>[1]>(join(path, "page-inventory.json"));
    const proposed = await suggestJourneys(context.model, inventory, { endpoint: options.required("endpoint"), model: options.required("model"), allowUpload: options.values.has("allow-upload") });
    await withLock(options.directory, work => writeArtifact(work, "journeys.proposed.json", proposed));
    return json({ status: "review-required", proposed, next: "Review journeys.proposed.json, then copy the approved content to journeys.json. Planning did not execute any interactions." });
  }
  if (command === "ads") {
    const [operation, ...tail] = rest;
    if (operation === "research") {
      const options = flags(tail, ["currency"]);
      const state = await projectStatus(options.directory);
      const result = await findPublicPrices(options.values.get("currency") ?? state.plan.currency);
      await saveExperimentFile(options.directory, "benchmarks", [...state.benchmarks.filter(item => !result.benchmarks.some(found => found.id === item.id)), ...result.benchmarks]);
      return json({ status: "saved", ...result, next: "Choose one of these cost estimates in your launch plan. No advertising account or API key was used." });
    }
    if (operation !== "import" && operation !== "refresh") throw new Error("Use ads research for public web data, or ads import / ads refresh for your own optional campaign history.");
    const options = flags(tail, ["file", "platform", "country", "currency", "objective", "audience", "source", "id", "account", "since", "until", "env-file"]);
    if (operation === "refresh" && options.values.has("env-file")) process.loadEnvFile(options.required("env-file"));
    const platform = options.required("platform"), objective = options.required("objective");
    if (!["meta", "tiktok"].includes(platform) || !["traffic", "conversions", "awareness"].includes(objective)) throw new Error("Invalid advertising platform or objective.");
    const common = { platform: platform as "meta" | "tiktok", country: options.required("country"), currency: options.required("currency"),
      objective: objective as "traffic" | "conversions" | "awareness", audience: options.required("audience"), collectedAt: new Date().toISOString().slice(0, 10) };
    const observation = operation === "import" ? importCostCsv(await readCsv(options.required("file")), { ...common, id: options.required("id"), sourceType: "account-export", sourceUrl: options.required("source") })
      : await fetchAccountCosts({ ...common, accountId: options.required("account"), since: options.required("since"), until: options.required("until") });
    const path = await workspace(options.directory);
    const current = await readJson(join(path, "benchmarks.json"), benchmarksSchema);
    await saveExperimentFile(options.directory, "benchmarks", [...current.filter(item => item.id !== observation.id), observation]);
    return json({ status: "saved", observation, next: "Set benchmarkId in .hypothra/launch.json to this observation ID. No ads were created or purchased." });
  }
  throw new Error("Invalid command or arguments. Run hypothra --help.");
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const detail = error instanceof Error ? error.message : "Unexpected failure.";
  console.error(`Hypothra: ${detail.slice(0, 4000)}`);
  process.exitCode = 1;
});
