import type { RehearsalState } from "./rehearsal-schema.js";
import type { DashboardUI } from "./dashboard-ui.js";

/** Kept self-contained because the compiled function is serialized into the local page. */
export function rehearsalClient(token: string, ui: DashboardUI) {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const value = (id: string) => $<HTMLInputElement>(id).value;
  const node = (tag: string, text = "", className = "") => { const item = document.createElement(tag); item.textContent = text; item.className = className; return item; };
  let root: string | null = null, state: RehearsalState | null = null, planKey = "", inputRunId = "", dirty = false, busy = false, batch = 0, loadSequence = 0, worker = "idle", pausing = false, resultKey = "", visitsKey = "", mediaKey = "", presentationKey = "", appConfigKey = "";
  function notice(text: string, error = false) { $("virtual-message").textContent = text; $("virtual-message").hidden = false; $("virtual-message").className = `notice ${error ? "warn" : ""}`; ui.announce(text, error); }
  async function api(path: string, body?: unknown) {
    let response: Response;
    try { response = await fetch(path, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json", "X-Hypothra-Token": token, ...(root ? { "X-Hypothra-Project": root } : {}) }, body: JSON.stringify(body) }); ui.connection(true); }
    catch { ui.connection(false); throw new Error("Connection interrupted. Showing your last saved progress. Keep Hypothra running to reconnect."); }
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "Operation failed."); return result;
  }
  async function action(task: () => Promise<void>) {
    if (busy) return; busy = true;
    const trigger = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
    const labels: Record<string, string> = { "virtual-prepare": "Building your plan…", "virtual-start": "Starting your rehearsal…", "virtual-save-plan": "Saving your changes…", "virtual-app-start": "Opening the test app…", "virtual-pause": "Requesting pause…", "app-pause": "Requesting pause…", "virtual-sample-button": "Loading reactions…" };
    ui.busy(trigger, true, labels[trigger?.id ?? ""] ?? "Working…");
    try { await task(); await load(); } catch (error) { const text = error instanceof Error ? error.message : "Operation failed."; if (/Review and approve|Approval is stale/i.test(text)) ui.navigate(0); notice(text, true); }
    finally { busy = false; ui.busy(trigger, false); renderControls(); }
  }
  function renderPlan() {
    if (!state?.plan) return;
    const plan = state.plan, container = $("virtual-plan"); container.replaceChildren();
    const preview = $("virtual-plan-preview"); preview.replaceChildren(node("div", "The campaign proposal", "eyebrow"), node("h3", plan.name), node("p", plan.productSummary, "preview-description"));
    const creative = node("div", "", "creative-preview"); creative.append(node("small", "The opening hook"), node("strong", plan.creative.hook)); preview.append(creative);
    const stats = node("div", "", "plan-stats");
    for (const [label, value] of [["Proposed budget · AI estimate", new Intl.NumberFormat("en", { style: "currency", currency: state.input.currency, maximumFractionDigits: 0 }).format(plan.proposedBudget)], ["Audience groups", String(plan.segments.length)], ["Individual reactions to explore", state.input.viewers.toLocaleString()]] as const) { const block = node("div"); block.append(node("small", label), node("strong", value)); stats.append(block); }
    preview.append(stats);
    const cohort = node("div", "", "chips");
    for (const segment of plan.segments) { const chip = node("span", `${segment.label} · ${(segment.share * 100).toFixed(1)}%`, "chip"); chip.title = `${segment.context}\n${segment.motivation}\n${segment.skepticism}`; cohort.append(chip); }
    container.append(cohort);
    function field(label: string, id: string, content: string, multiline = false, numeric = false) {
      const wrapper = node("label", label, "field"), input = document.createElement(multiline ? "textarea" : "input");
      input.id = id; input.value = content; input.setAttribute("aria-label", label);
      if (numeric) { input.setAttribute("type", "number"); input.setAttribute("min", "0"); input.setAttribute("step", "0.01"); }
      input.disabled = state!.audience.evaluated > 0 || state!.status === "running";
      input.oninput = () => { dirty = true; $<HTMLButtonElement>("virtual-start").disabled = true; };
      wrapper.append(input); container.append(wrapper);
    }
    field("AI proposed launch budget", "virtual-budget", String(plan.proposedBudget), false, true);
    container.append(node("p", `${state.input.currency} · AI estimate: ${plan.budgetRationale}`, "help"));
    for (const [key, label] of [["hook", "Reel hook"], ["script", "Reel script / ad description"], ["promise", "Product promise"], ["callToAction", "Call to action"]] as const) field(label, `virtual-creative-${key}`, plan.creative[key], key !== "callToAction");
    container.append(node("p", "The AI evaluates this script or description. No video or audio has been watched.", "help"));
    plan.costs.forEach((cost, index) => { field(cost.item, `virtual-cost-${index}`, String(cost.amount), false, true); container.append(node("p", `${state!.input.currency} · AI estimate: ${cost.rationale}`, "help")); });
    const unknowns = node("ul"); for (const text of [...plan.uncertainties, ...plan.creative.limitations]) unknowns.append(node("li", text)); container.append(unknowns);
    $<HTMLTextAreaElement>("virtual-plan-json").value = JSON.stringify(plan, null, 2);
    dirty = false;
  }
  function cards(container: HTMLElement, entries: [string, number][]) {
    if (container.children.length !== entries.length) { container.replaceChildren(); for (const [label] of entries) { const card = node("div", "", "card"); card.append(node("div", label, "label"), node("strong", "", "number")); container.append(card); } }
    entries.forEach(([, count], index) => { const number = container.children[index]!.querySelector<HTMLElement>(".number")!, text = count.toLocaleString(); if (number.textContent !== text) { number.textContent = text; if (!matchMedia("(prefers-reduced-motion: reduce)").matches) number.animate([{ opacity: .45, transform: "translateY(3px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 220, easing: "ease-out" }); } });
  }
  function renderControls() {
    if (!state) return;
    const interrupted = ["interrupted", "idle"].includes(worker) && state.status === "running";
    const running = state.status === "running" && !interrupted;
    if (!running) pausing = false;
    ui.busy($<HTMLButtonElement>("virtual-prepare"), state.status === "planning", "Building your plan…");
    ui.busy($<HTMLButtonElement>("virtual-start"), running, state.phase === "optimization" ? "Writing your insights…" : "Rehearsal is running…");
    if (!running) $("virtual-start").textContent = state.audience.evaluated ? "Resume my rehearsal" : `Start ${state.input.viewers.toLocaleString()}-person ${state.input.viewers <= 20 ? "pilot" : "rehearsal"}`;
    $("virtual-start").hidden = state.status === "completed" || state.status === "planning" || state.phase === "experience";
    $<HTMLButtonElement>("virtual-start").disabled = dirty || !state.plan || state.status === "completed" || running;
    $("virtual-pause").hidden = !running || state.phase === "experience";
    for (const id of ["virtual-pause", "app-pause"]) { ui.busy($<HTMLButtonElement>(id), pausing && running, "Pausing after current work…"); $<HTMLButtonElement>(id).disabled = !running || worker !== "local" || pausing; }
    $<HTMLButtonElement>("virtual-prepare").disabled = state.status === "planning" || running;
    $<HTMLButtonElement>("virtual-save-plan").disabled = state.audience.evaluated > 0 || running;
    $<HTMLButtonElement>("virtual-app-start").disabled = state.audience.evaluated !== state.input.viewers || state.audience.installed <= state.experience.tested || running;
    $("virtual-app-start").textContent = state.phase === "experience" && state.experience.target > state.experience.tested ? "Resume app visits" : "Start exploring my app";
    $("virtual-view-results").hidden = !state.optimization;
    $("virtual-completed-next").hidden = state.status !== "completed" || !state.audience.installed;
    $("virtual-next-hint").textContent = dirty ? "Save your corrections to continue." : state.status === "ready" ? "Your plan is ready. Edit anything, or start your rehearsal." : running ? "Keep exploring the workspace. Your saved job will continue." : state.status === "completed" ? "Your reactions are saved. See what to improve next." : "Your completed work is saved. Resume whenever you are ready.";
  }
  function renderProgress() {
    if (!state) return;
    const interrupted = state.status === "running" && ["interrupted", "idle"].includes(worker);
    const working = ["running", "planning"].includes(state.status) && !interrupted;
    const titles = { planning: state.planningStep === "research" ? "Checking the cost references" : "Building your launch plan", ready: "Your campaign is ready", running: state.phase === "optimization" ? "Finding your next best moves" : state.phase === "experience" ? "Inside your app, with fresh eyes" : "Meeting your virtual audience", paused: "Paused. Nothing is lost.", failed: "This step needs a little attention", completed: "Your rehearsal is complete" };
    $("virtual-run-status").textContent = interrupted ? "Ready to pick up where you left off" : titles[state.status];
    $("virtual-run-status").dataset.status = state.status;
    $("virtual-stage-label").textContent = state.status === "ready" ? "Ready when you are" : state.status === "completed" ? "All saved" : working ? "Working on your launch" : "Saved progress";
    $("virtual-stage-detail").textContent = state.status === "failed" || state.status === "paused" ? state.message : state.activity.at(-1)?.label ?? state.message;
    $("virtual-stage").dataset.working = String(working);
    $("virtual-stage").dataset.compact = String(state.status === "ready" || state.status === "completed");
    const stages = [state.plan !== null || state.planningStep !== "research", state.plan !== null, state.audience.evaluated === state.input.viewers, state.optimization !== null];
    document.querySelectorAll<HTMLElement>("#virtual-phases li").forEach((element, index) => { element.dataset.state = stages[index] ? "done" : working && (index === 0 || stages[index - 1]) ? "active" : "waiting"; });
    const indeterminate = working && state.phase !== "audience";
    $("virtual-meter").hidden = state.status === "ready";
    $("virtual-progress-track").dataset.indeterminate = String(indeterminate);
    $("virtual-progress-fill").style.transform = `scaleX(${state.audience.evaluated / state.input.viewers})`;
    $("virtual-percent").textContent = indeterminate ? "Working…" : `${Math.floor(100 * state.audience.evaluated / state.input.viewers)}%`;
    $("virtual-progress-text").textContent = indeterminate ? state.phase === "planning" ? "No percentages to guess — the AI is preparing your proposal." : "Your reactions are saved. AI is preparing the recommendations." : `${state.audience.evaluated.toLocaleString()} of ${state.input.viewers.toLocaleString()} individual reactions saved`;
    const progress = $<HTMLProgressElement>("virtual-progress-bar"); progress.max = state.input.viewers; if (indeterminate) progress.removeAttribute("value"); else progress.value = state.audience.evaluated;
    const activity = state.activity.slice(-3);
    for (const id of ["virtual-activity", "app-activity"]) { $(id).replaceChildren(); for (const event of activity) { const item = node("li"); const time = node("time", new Date(event.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })); time.setAttribute("datetime", event.at); item.append(time, node("span", event.label)); $(id).append(item); } }
    $("app-live-stage").hidden = !(state.experience.target > 0 && (state.phase === "experience" || state.experience.tested > 0));
    $("app-live-stage").dataset.working = String(working && state.phase === "experience");
    $("app-run-status").textContent = state.phase === "experience" && working ? "Visitors are exploring your app" : state.status === "paused" ? "Visits paused. Your work is saved." : "Your app observations are saved";
    $("app-stage-detail").textContent = state.activity.at(-1)?.label ?? state.message;
    $("app-progress-text").textContent = `${state.experience.tested} of ${state.experience.target} visits saved`;
    $("app-percent").textContent = state.experience.target ? `${Math.floor(100 * state.experience.tested / state.experience.target)}%` : "";
    $("app-progress-fill").style.transform = `scaleX(${state.experience.target ? state.experience.tested / state.experience.target : 0})`;
    $("virtual-app-counts").hidden = !state.experience.tested;
    const configKey = `${state.id}:${state.experience.baseUrl}:${state.experience.target}`;
    if (state.experience.baseUrl && configKey !== appConfigKey) { $<HTMLInputElement>("virtual-test-url").value = state.experience.baseUrl; $<HTMLInputElement>("virtual-test-users").value = String(state.experience.target); appConfigKey = configKey; }
    $("virtual-counts").hidden = !state.audience.evaluated;
    $("virtual-rates").hidden = !state.audience.evaluated;
    const canExplore = state.audience.evaluated === state.input.viewers && state.audience.installed > 0;
    $("virtual-app-ready").hidden = !canExplore || state.phase === "experience" && working;
    $("virtual-app-gate").hidden = canExplore;
    if (!canExplore && state.audience.evaluated === state.input.viewers) $("virtual-app-gate-message").textContent = "None of these virtual viewers chose to try the product. Review their reasons, improve the idea, and rehearse a new version.";
    $("virtual-results-empty").hidden = !!state.optimization;
    $("app-insights-next").hidden = !state.optimization;
    document.querySelector<HTMLElement>('.step[data-step="1"]')!.dataset.done = String(state.audience.evaluated === state.input.viewers);
    document.querySelector<HTMLElement>('.step[data-step="2"]')!.dataset.done = String(state.experience.tested > 0);
    document.querySelector<HTMLElement>('.step[data-step="3"]')!.dataset.done = String(!!state.optimization);
  }
  async function load() {
    const sequence = ++loadSequence;
    const data = await api("/api/rehearsal/status");
    if (sequence !== loadSequence) return;
    if (root && root !== data.projectRoot && dirty) { notice("The selected project changed. Keep your unsaved plan corrections in this window before reloading.", true); return; }
    if (state && data.rehearsal && state.id !== data.rehearsal.id) {
      if (dirty) { notice("Another window prepared a new launch. Keep your unsaved plan corrections before reloading.", true); return; }
      batch = 0; $("virtual-records").replaceChildren(); planKey = "";
    }
    root = data.projectRoot; state = data.rehearsal; worker = data.worker;
    $("virtual-progress").hidden = !state; $("virtual-empty").hidden = !!state;
    $("virtual-app-summary").textContent = state ? `${state.experience.tested.toLocaleString()} actual local browser visits · ${state.audience.installed.toLocaleString()} synthetic install intentions` : "Run the virtual audience first. Then let interested AI visitors explore your local test app.";
    if (!state) {
      for (const id of ["virtual-plan", "virtual-plan-preview", "virtual-app-counts", "virtual-optimization", "virtual-experiences", "virtual-records", "virtual-history"]) $(id).replaceChildren();
      $("virtual-app-gate").hidden = false; $("virtual-app-ready").hidden = true; $("app-live-stage").hidden = true; $("virtual-results-empty").hidden = false;
      $<HTMLButtonElement>("virtual-prepare").disabled = !root; $<HTMLButtonElement>("virtual-app-start").disabled = true;
      planKey = ""; inputRunId = ""; resultKey = ""; visitsKey = ""; mediaKey = ""; presentationKey = ""; appConfigKey = ""; return;
    }
    if (inputRunId !== state.id) {
      for (const [id, content] of Object.entries({ "virtual-call-limit": state.input.maxAICalls, "virtual-viewers": state.input.viewers, "virtual-idea": state.input.idea, "virtual-constraints": state.input.constraints, "virtual-currency": state.input.currency })) $<HTMLInputElement>(id).value = String(content);
      inputRunId = state.id;
    }
    if (!state.plan) $("virtual-plan").replaceChildren();
    if (presentationKey !== state.id) { $<HTMLDetailsElement>("virtual-brief-settings").open = false; presentationKey = state.id; }
    $("virtual-plan-preview").hidden = !state.plan;
    $("virtual-plan-editor").hidden = !state.plan;
    $("virtual-source-details").hidden = !state.plan;
    $("virtual-decisions").hidden = !state.audience.evaluated;
    $("virtual-usage").textContent = `Reported usage: ${state.calls.inputTokens.toLocaleString()} input / ${state.calls.outputTokens.toLocaleString()} output tokens. ${state.calls.usageUnreported} calls did not report usage. AI money charges are unknown. Engine: ${state.calls.provider ?? "pending"} / ${state.calls.model ?? "pending"}.`;
    cards($("virtual-counts"), [["Evaluated people (synthetic)", state.audience.evaluated], ["Would watch", state.audience.watched], ["Would click", state.audience.clicked], ["Would try / install", state.audience.installed]]);
    $("virtual-rates").textContent = state.audience.evaluated ? `Among completed AI evaluations: ${(100 * state.audience.watched / state.audience.evaluated).toFixed(1)}% would watch, ${(100 * state.audience.clicked / state.audience.evaluated).toFixed(1)}% would click, ${(100 * state.audience.installed / state.audience.evaluated).toFixed(1)}% would try. These are synthetic intent ratios, not measured marketing effectiveness.` : "No individual evaluations completed yet.";
    cards($("virtual-app-counts"), [["Actually browser-tested", state.experience.tested], ["AI satisfied", state.experience.satisfied], ["AI would leave", state.experience.dropout], ["Blocked / step limit", state.experience.blocked + state.experience.stepLimit]]);
    const key = state.id + JSON.stringify(state.plan);
    if (key !== planKey && !dirty) { renderPlan(); planKey = key; }
    $("virtual-plan").querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input,textarea").forEach(input => { input.disabled = state!.audience.evaluated > 0 || state!.status === "running"; });
    renderProgress(); renderControls();
    $("virtual-sample-button").hidden = state.audience.batches === 0;
    const newMediaKey = JSON.stringify(data.mediaCosts);
    if (newMediaKey !== mediaKey) { mediaKey = newMediaKey; $("virtual-cost-sources").replaceChildren();
    for (const item of data.mediaCosts) {
      const card = node("div", "", "source-card");
      card.append(node("strong", `${item.platform} · ${item.hypothesisViews.toLocaleString()} hypothetical exposures`));
      card.append(node("p", item.costForRequestedViews ? `Published CPM reference: ${item.costForRequestedViews.low.toFixed(2)}–${item.costForRequestedViews.high.toFixed(2)} ${state.input.currency} for that reach. Global planning reference, not a guaranteed local auction price.` : "Media price unknown. No verifiable published CPM was selected."));
      if (item.benchmark) { const link = node("a", `${item.benchmark.source.label} · ${item.benchmark.source.observedFrom} to ${item.benchmark.source.observedTo}`) as HTMLAnchorElement; link.href = item.benchmark.source.url; link.target = "_blank"; link.rel = "noopener noreferrer"; card.append(link); }
      $("virtual-cost-sources").append(card);
    }
    }
    const newResultKey = JSON.stringify(state.optimization);
    if (newResultKey !== resultKey) { resultKey = newResultKey;
    const result = $("virtual-optimization"); result.replaceChildren();
    if (state.optimization) {
      result.append(node("h3", "What to improve next"), node("p", state.optimization.summary));
      for (const recommendation of state.optimization.recommendations) {
        const card = node("div", "", "subcard recommendation"), evidence = node("details"), summary = node("summary", "Why AI suggested this"); evidence.append(summary, node("p", `${recommendation.basis} · ${recommendation.evidenceIds.join(", ")}`, "help")); card.append(node("div", `${recommendation.priority.toUpperCase()} PRIORITY · ${recommendation.area}`, "recommendation-meta"), node("strong", recommendation.change), node("p", recommendation.rationale), evidence); result.append(card);
      }
    }
    }
    const newVisitsKey = JSON.stringify(state.experience);
    if (newVisitsKey !== visitsKey) { visitsKey = newVisitsKey;
    const experiences = $("virtual-experiences"); experiences.replaceChildren();
    for (const [error, issue] of Object.entries(state.experience.issues)) experiences.append(node("p", `${error} · ${issue.count} observed occurrences · example ${issue.exampleViewer}`, "notice warn"));
    for (const visit of state.experience.samples) {
      const card = node("div", "", "subcard");
      card.append(node("strong", `${visit.viewerId} · ${visit.outcome}`), node("p", `AI opinion: ${visit.feedback}`));
      for (const action of visit.actions) card.append(node("p", `${action.action} ${action.selector} · ${action.result} · ${action.reason}`, "help"));
      for (const error of visit.runtimeErrors) card.append(node("p", error, "help"));
      experiences.append(card);
    }
    }
    $("virtual-limitations").replaceChildren(); for (const limitation of state.limitations) $("virtual-limitations").append(node("li", limitation));
  }
  $("virtual-prepare-form").onsubmit = event => { event.preventDefault(); void action(async () => {
    if (dirty) throw new Error("Save your plan corrections before preparing a new variant.");
    const current = await api("/api/state"); root = current.projectRoot;
    if (!root) throw new Error("Choose your project folder first.");
    await api("/api/rehearsal/prepare", { input: { idea: value("virtual-idea"), constraints: value("virtual-constraints"), currency: value("virtual-currency"), viewers: Number(value("virtual-viewers")), batchSize: 10, maxAICalls: Number(value("virtual-call-limit")) } });
    notice("AI is preparing the audience, creative and cost assumptions. No conversion form is needed.");
  }); };
  $("virtual-start").onclick = () => { void action(async () => {
    if (!state || dirty) throw new Error("Save the proposed plan before starting.");
    await api("/api/rehearsal/resume", { runId: state.id, maxAICalls: Number(value("virtual-call-limit")) });
    notice("The AI audience is running. You can pause after the current batch. Every counted person has a saved individual decision.");
  }); };
  function pause() { void action(async () => { notice((await api("/api/rehearsal/pause", { runId: state!.id })).message); pausing = true; }); }
  $("virtual-pause").onclick = pause;
  $("app-pause").onclick = pause;
  $("virtual-save-plan").onclick = () => { void action(async () => {
    if (!state?.plan) return; const plan = structuredClone(state.plan);
    plan.proposedBudget = Number(value("virtual-budget"));
    for (const key of ["hook", "script", "promise", "callToAction"] as const) plan.creative[key] = value(`virtual-creative-${key}`);
    plan.costs.forEach((cost, index) => { cost.amount = Number(value(`virtual-cost-${index}`)); });
    await api("/api/rehearsal/plan", { runId: state.id, plan }); dirty = false; planKey = ""; notice("Plan corrections saved.");
  }); };
  $("virtual-save-json").onclick = () => { void action(async () => { await api("/api/rehearsal/plan", { runId: state!.id, plan: JSON.parse(value("virtual-plan-json")) }); dirty = false; planKey = ""; notice("Full AI plan saved."); }); };
  $("virtual-plan-json").oninput = () => { dirty = true; };
  $("virtual-viewers").onchange = () => { $<HTMLInputElement>("virtual-call-limit").value = String(Math.max(100, Math.ceil(Number(value("virtual-viewers")) / 10) + 2)); };
  $("virtual-app-form").onsubmit = event => { event.preventDefault(); void action(async () => {
    if (!state) throw new Error("Complete the virtual audience first.");
    if (!$<HTMLInputElement>("virtual-test-consent").checked) throw new Error("Confirm that this is a local app with synthetic test data.");
    await api("/api/rehearsal/experience", { runId: state.id, input: { baseUrl: value("virtual-test-url"), users: Number(value("virtual-test-users")), syntheticTestData: true } });
    await api("/api/rehearsal/resume", { runId: state.id, maxAICalls: Number(value("virtual-call-limit")) });
    notice("Interested virtual visitors are now exploring the selected local test app.");
  }); };
  async function records() {
    if (!state) return;
    const data = await api("/api/rehearsal/records", { runId: state.id, batch });
    const container = $("virtual-records"); container.replaceChildren(node("h3", `Individual decisions · batch ${batch + 1} / ${state.audience.batches}`));
    for (const viewer of data.viewers) { const card = node("div", "", "subcard"); card.append(node("strong", `${viewer.id} · ${viewer.profile.context}`), node("p", `Watch: ${viewer.watch ? "yes" : "no"} · click: ${viewer.click ? "yes" : "no"} · try/install: ${viewer.install ? "yes" : "no"}`), node("p", viewer.reason), node("p", `Expectation: ${viewer.expectation}`, "help")); container.append(card); }
    $<HTMLButtonElement>("virtual-prev").disabled = batch === 0; $<HTMLButtonElement>("virtual-next").disabled = batch + 1 >= state.audience.batches;
  }
  $("virtual-sample-button").onclick = () => { void action(async () => { batch = 0; await records(); }); };
  $("virtual-prev").onclick = () => { void action(async () => { batch--; await records(); }); };
  $("virtual-next").onclick = () => { void action(async () => { batch++; await records(); }); };
  $("virtual-history-button").onclick = () => { void action(async () => {
    const history = await api("/api/rehearsal/history"), container = $("virtual-history"); container.replaceChildren();
    for (const run of history) container.append(node("p", `${run.name} · ${run.createdAt} · ${run.status} · ${run.evaluated.toLocaleString()} evaluated / ${run.installed.toLocaleString()} would try / ${run.tested} browser-tested · version ${run.modelRevision.slice(0, 10)}`));
  }); };
  window.addEventListener("beforeunload", event => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });
  setInterval(() => {
    if (!state || !["running", "planning"].includes(state.status) || !state.runStartedAt) { $("virtual-elapsed").textContent = ""; return; }
    const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(state.runStartedAt)) / 1000));
    $("virtual-elapsed").textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} running`;
  }, 1000);
  async function poll() { try { if (!busy) await load(); } catch (error) { notice(error instanceof Error ? error.message : "Could not load virtual launch.", true); } setTimeout(poll, 2500); }
  void poll();
}
