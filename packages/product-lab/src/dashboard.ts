import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { AddressInfo } from "node:net";
import { approveProject, projectStatus, runLaunch, saveExperimentFile, saveProjectDraft } from "./workflow.js";
import { escapeHtml as esc, inlineJson, style } from "./report.js";

function dashboardHtml(token: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hypothra · Product laboratory</title><style>${style}</style></head><body><main><div class="eyebrow">Hypothra / local product laboratory</div><h1>Understand. Challenge.<br>Then launch.</h1><p class="lead">Review your product model, correct what the analysis missed, and explore a launch experiment. Source evidence, assumptions, and browser observations stay visible.</p><div class="toolbar"><span class="pill" id="state">Loading</span><span class="meta" id="scan"></span></div><div id="status" class="status" role="status"></div><section><div class="toolbar"><h2 style="flex:1;margin:0">1 / Review the product</h2><button id="reload">Reload</button></div><p id="description"></p><div id="stack"></div><details><summary>Code evidence and unknowns</summary><pre id="evidence"></pre></details><details><summary>Edit the application model</summary><p class="small">Correct description, target users, technologies, capabilities, and journeys. Keep analysis metadata and evidence IDs intact. Use user-confirmed or user-corrected for your additions.</p><textarea id="project" spellcheck="false" aria-label="Application model JSON"></textarea><div class="toolbar"><button id="save-project">Save corrections</button></div></details><p class="meta code" id="revision"></p><button class="primary" id="approve">Approve this exact model</button></section><section><h2>2 / Define the launch</h2><p>Describe the advertisement, budget, audience, and funnel assumptions. Prices labeled manual-assumption are synthetic examples.</p><div class="two"><div><h3>Launch plan</h3><textarea id="launch" spellcheck="false" aria-label="Launch plan JSON"></textarea><button data-save="launch">Save launch plan</button></div><div><h3>Advertising cost evidence</h3><textarea id="benchmarks" spellcheck="false" aria-label="Benchmark JSON"></textarea><button data-save="benchmarks">Save cost evidence</button></div></div></section><section><h2>3 / Test a path through the app</h2><p>Run browser journeys explicitly from the terminal against a synthetic local test app. This page cannot start browser actions. Review selectors and synthetic inputs first.</p><pre>hypothra journeys . --screenshots</pre><details><summary>Edit local browser journeys</summary><textarea id="journeys" spellcheck="false" aria-label="Browser journey JSON"></textarea><button data-save="journeys">Save browser journeys</button></details></section><section><h2>4 / Explore the result</h2><div class="toolbar"><button class="primary" id="run">Run launch scenario</button><label><input id="runtime" type="checkbox"> Attach the last browser run</label><a href="/report" id="report-link" hidden>Open interactive report</a></div><div id="results" class="scroll"></div></section><footer>Local interface only. No ads are bought or published. API-based price refresh and optional model uploads require separate explicit commands.</footer></main><script>const token=${inlineJson(token)};let state;const message=text=>document.querySelector('#status').textContent=text;async function api(path,body){const response=await fetch(path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json','X-Hypothra-Token':token}:{},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed');return data;}function element(tag,text){const node=document.createElement(tag);node.textContent=text;return node;}async function load(){state=await api('/api/state');document.querySelector('#state').textContent=state.status;document.querySelector('#scan').textContent=state.inspection.filesScanned+' files · '+state.inspection.evidence.length+' evidence records';document.querySelector('#description').textContent=state.model.project.description;const stack=document.querySelector('#stack');stack.replaceChildren();for(const item of state.model.stack){const chip=element('span',item.name+' · '+item.provenance);chip.className='pill';stack.append(chip);}document.querySelector('#evidence').textContent=state.markdown;document.querySelector('#revision').textContent='Model revision: '+state.revision;for(const [id,value]of [['project',state.model],['launch',state.plan],['benchmarks',state.benchmarks],['journeys',state.journeys]])document.getElementById(id).value=JSON.stringify(value,null,2);document.querySelector('#approve').disabled=state.status==='approved';const results=document.querySelector('#results');results.replaceChildren();if(state.report){const table=document.createElement('table');const head=document.createElement('tr');for(const title of ['Variant','Signups','Paying','Revenue','Costs','Profit'])head.append(element('th',title));table.append(head);for(const item of state.report.totals){const row=document.createElement('tr');for(const value of [item.variant,item.signups,item.paying,item.firstMonthRevenue,item.costs,item.firstMonthProfit])row.append(element('td',String(value)));table.append(row);}results.append(table);if(!state.reportCurrent)results.prepend(element('p','This saved result is stale. Rerun with the current model and inputs.'));document.querySelector('#report-link').hidden=false;}}async function action(fn){try{message('Working…');await fn();await load();message('Done.');}catch(error){message(error.message);}}document.querySelector('#reload').onclick=()=>action(async()=>{});document.querySelector('#save-project').onclick=()=>action(()=>api('/api/draft',{model:JSON.parse(document.querySelector('#project').value),expectedRevision:state.revision}));document.querySelector('#approve').onclick=()=>action(()=>api('/api/approve',{revision:state.revision}));for(const button of document.querySelectorAll('[data-save]'))button.onclick=()=>action(()=>api('/api/experiment',{kind:button.dataset.save,value:JSON.parse(document.getElementById(button.dataset.save).value)}));document.querySelector('#run').onclick=()=>action(()=>api('/api/launch',{useRuntime:document.querySelector('#runtime').checked}));action(async()=>{});</script></body></html>`;
}

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
