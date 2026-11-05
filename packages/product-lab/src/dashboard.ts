import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { AddressInfo } from "node:net";
import { approveProject, projectStatus, runLaunch, runProjectJourneys, saveExperimentFile, saveProjectDraft } from "./workflow.js";
import { escapeHtml as esc } from "./report.js";
import { dashboardHtml } from "./dashboard-view.js";
import { findPublicPrices } from "./public-prices.js";

export async function startDashboard(directory: string, port = 4317) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid dashboard port.");
  await projectStatus(directory);
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
      if (request.method === "GET" && path === "/") { response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); response.end(dashboardHtml(token)); return; }
      if (request.method === "GET" && path === "/api/state") return json(200, await projectStatus(directory));
      if (request.method === "GET" && path === "/report") {
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
      if (path === "/api/draft") return json(200, await saveProjectDraft(directory, body.model, String(body.expectedRevision)));
      if (path === "/api/approve") return json(200, await approveProject(directory, String(body.revision)));
      if (path === "/api/experiment" && ["launch", "benchmarks", "journeys"].includes(String(body.kind))) return json(200, await saveExperimentFile(directory, body.kind as "launch" | "benchmarks" | "journeys", body.value));
      if (path === "/api/launch" && typeof body.useRuntime === "boolean") return json(200, await runLaunch(directory, body.useRuntime));
      if (path === "/api/journeys" && body.runLocalTest === true) return json(200, await runProjectJourneys(directory));
      if (path === "/api/public-prices" && typeof body.currency === "string") return json(200, await findPublicPrices(body.currency));
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
