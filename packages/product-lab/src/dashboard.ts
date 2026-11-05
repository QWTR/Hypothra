import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { AddressInfo } from "node:net";
import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, join, parse } from "node:path";
import { approveProject, projectStatus, runLaunch, runProjectJourneys, saveExperimentFile, saveProjectDraft, initializeProject, refreshProject } from "./workflow.js";
import { escapeHtml as esc } from "./report.js";
import { dashboardHtml } from "./dashboard-view.js";
import { findPublicPrices } from "./public-prices.js";
import { queueAutomaticAnalysis, readAIStatus } from "./auto-ai.js";
import { listProjectFolders } from "./folder-picker.js";

export async function startDashboard(initialDirectory?: string, port = 4317, options: { autoAI?: boolean } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid dashboard port.");
  let currentDirectory = initialDirectory ? await realpath(initialDirectory) : null;
  if (currentDirectory) {
    await projectStatus(currentDirectory);
    if (options.autoAI !== false) await queueAutomaticAnalysis(currentDirectory);
  }
  const token = randomBytes(32).toString("hex");
  let origin = "";
  const server = createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const json = (status: number, value: unknown) => { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); response.end(JSON.stringify(value)); };
    try {
      if (request.headers.host !== new URL(origin).host || request.headers.origin && request.headers.origin !== origin) return json(403, { error: "Local origin check failed." });
      const path = new URL(request.url ?? "/", origin).pathname;
      const directory = currentDirectory;
      if (request.method === "GET" && path === "/") { response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); response.end(dashboardHtml(token)); return; }
      if (request.method === "GET" && path === "/api/state") return json(200, directory ? { ...await projectStatus(directory), projectRoot: directory } : { status: "choose-project", projectRoot: null });
      if (request.method === "GET" && path === "/api/ai/status" && directory) return json(200, await readAIStatus(directory));
      if (request.method === "GET" && path === "/report") {
        if (!directory) return json(404, { error: "Choose a project folder first." });
        const state = await projectStatus(directory);
        if (!state.report) return json(404, { error: "Run a launch scenario first." });
        if (!state.reportCurrent) return json(409, { error: "Saved report is stale. Rerun the launch scenario." });
        const { renderReport } = await import("./report.js");
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); response.end(renderReport(state.report)); return;
      }
      if (request.method !== "POST") return json(404, { error: "Not found." });
      const candidate = request.headers["x-hypothra-token"];
      if (typeof candidate !== "string" || candidate.length !== token.length || !timingSafeEqual(Buffer.from(candidate), Buffer.from(token))) return json(403, { error: "Local session token is missing or invalid." });
      if (!request.headers["content-type"]?.startsWith("application/json")) return json(415, { error: "JSON request required." });
      const chunks: Buffer[] = []; let bytes = 0;
      for await (const chunk of request) { bytes += chunk.length; if (bytes > 2 * 1024 * 1024) return json(413, { error: "Request exceeds its byte budget." }); chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
      if (path === "/api/project/browse") {
        if (body.directory !== undefined && typeof body.directory !== "string") throw new Error("Invalid folder path.");
        return json(200, await listProjectFolders(body.directory as string | undefined, directory ?? undefined));
      }
      if (path === "/api/project/open") {
        if (typeof body.directory !== "string" || !isAbsolute(body.directory)) throw new Error("Choose a project folder or paste its full absolute path.");
        const selected = await realpath(body.directory);
        if (!(await lstat(selected)).isDirectory() || parse(selected).root === selected) throw new Error("Choose a specific project folder, not an entire drive.");
        let initialized = false;
        try { initialized = (await lstat(join(selected, ".hypothra", "state.json"))).isFile(); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
        if (!initialized) await initializeProject(selected);
        else {
          try { await projectStatus(selected); }
          catch (error) { if (error instanceof Error && /source or scan evidence changed/.test(error.message)) await refreshProject(selected); else throw error; }
        }
        if (options.autoAI !== false) await queueAutomaticAnalysis(selected, { force: false });
        currentDirectory = selected;
        return json(200, { status: "opened", projectRoot: selected });
      }
      if (!directory) return json(400, { error: "Choose your project folder first. Hypothra can stay installed in its own folder." });
      const expectedProject = request.headers["x-hypothra-project"];
      if (typeof expectedProject === "string" && expectedProject !== directory) return json(409, { error: "The selected project changed in another window. Reload the saved project before making changes." });
      if (path === "/api/draft") return json(200, await saveProjectDraft(directory, body.model, String(body.expectedRevision)));
      if (path === "/api/approve") return json(200, await approveProject(directory, String(body.revision)));
      if (path === "/api/experiment" && ["launch", "benchmarks", "journeys"].includes(String(body.kind))) return json(200, await saveExperimentFile(directory, body.kind as "launch" | "benchmarks" | "journeys", body.value));
      if (path === "/api/launch" && typeof body.useRuntime === "boolean") return json(200, await runLaunch(directory, body.useRuntime));
      if (path === "/api/journeys" && body.runLocalTest === true) return json(200, await runProjectJourneys(directory));
      if (path === "/api/public-prices" && typeof body.currency === "string") return json(200, await findPublicPrices(body.currency));
      if (path === "/api/ai/analyze" && body.reanalyze === true) return json(202, await queueAutomaticAnalysis(directory, { force: true }));
      return json(404, { error: "Unknown operation." });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Operation failed.";
      return json(400, { error: detail.slice(0, 2000) });
    }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5000;
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, url: origin, title: esc("Hypothra product laboratory") };
}
