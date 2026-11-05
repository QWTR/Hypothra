import type { RehearsalState } from "./rehearsal-schema.js";

/** Kept self-contained because the compiled function is serialized into the local page. */
export function rehearsalClient(token: string) {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const value = (id: string) => $<HTMLInputElement>(id).value;
  const node = (tag: string, text = "", className = "") => { const item = document.createElement(tag); item.textContent = text; item.className = className; return item; };
  let root: string | null = null, state: RehearsalState | null = null, planKey = "", inputRunId = "", dirty = false, busy = false, batch = 0, loadSequence = 0;
  function notice(text: string, error = false) { $("virtual-message").textContent = text; $("virtual-message").className = `notice ${error ? "warn" : ""}`; }
  async function api(path: string, body?: unknown) {
    const response = await fetch(path, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json", "X-Hypothra-Token": token, ...(root ? { "X-Hypothra-Project": root } : {}) }, body: JSON.stringify(body) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "Operation failed."); return result;
  }
  async function action(task: () => Promise<void>) {
    if (busy) return; busy = true;
    try { await task(); await load(); } catch (error) { notice(error instanceof Error ? error.message : "Operation failed.", true); }
    finally { busy = false; }
  }
  function renderPlan() {
    if (!state?.plan) return;
    const plan = state.plan, container = $("virtual-plan"); container.replaceChildren();
    container.append(node("h3", plan.name), node("p", plan.productSummary), node("p", plan.audienceRationale));
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
    container.replaceChildren(); for (const [label, count] of entries) { const card = node("div", "", "card"); card.append(node("div", label, "label"), node("strong", count.toLocaleString(), "number")); container.append(card); }
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
    root = data.projectRoot; state = data.rehearsal;
    $("virtual-progress").hidden = !state; $("virtual-empty").hidden = !!state;
    $("virtual-app-summary").textContent = state ? `${state.experience.tested.toLocaleString()} actual local browser visits · ${state.audience.installed.toLocaleString()} synthetic install intentions` : "Run the virtual audience first. Then let interested AI visitors explore your local test app.";
    if (!state) {
      for (const id of ["virtual-plan", "virtual-app-counts", "virtual-optimization", "virtual-experiences", "virtual-records", "virtual-history"]) $(id).replaceChildren();
      $<HTMLButtonElement>("virtual-prepare").disabled = !root; $<HTMLButtonElement>("virtual-app-start").disabled = true;
      planKey = ""; inputRunId = ""; return;
    }
    if (inputRunId !== state.id) {
      for (const [id, content] of Object.entries({ "virtual-call-limit": state.input.maxAICalls, "virtual-viewers": state.input.viewers, "virtual-idea": state.input.idea, "virtual-constraints": state.input.constraints, "virtual-currency": state.input.currency })) $<HTMLInputElement>(id).value = String(content);
      inputRunId = state.id;
    }
    if (!state.plan) $("virtual-plan").replaceChildren();
    const interrupted = state.status === "running" && ["interrupted", "idle"].includes(data.worker);
    $("virtual-run-status").textContent = interrupted ? "INTERRUPTED · Resume from the last saved batch." : `${state.status.toUpperCase()} · ${state.message}`;
    $("virtual-progress-text").textContent = `${state.audience.evaluated.toLocaleString()} / ${state.input.viewers.toLocaleString()} individual AI evaluations · ${state.calls.attempted.toLocaleString()} AI calls attempted (${state.calls.completed.toLocaleString()} completed)`;
    $<HTMLProgressElement>("virtual-progress-bar").max = state.input.viewers;
    $<HTMLProgressElement>("virtual-progress-bar").value = state.audience.evaluated;
    $("virtual-usage").textContent = `Reported usage: ${state.calls.inputTokens.toLocaleString()} input / ${state.calls.outputTokens.toLocaleString()} output tokens. ${state.calls.usageUnreported} calls did not report usage. AI money charges are unknown. Engine: ${state.calls.provider ?? "pending"} / ${state.calls.model ?? "pending"}.`;
    cards($("virtual-counts"), [["Evaluated people (synthetic)", state.audience.evaluated], ["Would watch", state.audience.watched], ["Would click", state.audience.clicked], ["Would try / install", state.audience.installed]]);
    $("virtual-rates").textContent = state.audience.evaluated ? `Among completed AI evaluations: ${(100 * state.audience.watched / state.audience.evaluated).toFixed(1)}% would watch, ${(100 * state.audience.clicked / state.audience.evaluated).toFixed(1)}% would click, ${(100 * state.audience.installed / state.audience.evaluated).toFixed(1)}% would try. These are synthetic intent ratios, not measured marketing effectiveness.` : "No individual evaluations completed yet.";
    cards($("virtual-app-counts"), [["Actually browser-tested", state.experience.tested], ["AI satisfied", state.experience.satisfied], ["AI would leave", state.experience.dropout], ["Blocked / step limit", state.experience.blocked + state.experience.stepLimit]]);
    const key = state.id + JSON.stringify(state.plan);
    if (key !== planKey && !dirty) { renderPlan(); planKey = key; }
    $("virtual-plan").querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input,textarea").forEach(input => { input.disabled = state!.audience.evaluated > 0 || state!.status === "running"; });
    $<HTMLButtonElement>("virtual-start").disabled = dirty || !state.plan || ["planning", "completed"].includes(state.status) || state.status === "running" && !interrupted;
    $<HTMLButtonElement>("virtual-pause").disabled = state.status !== "running" || data.worker !== "local";
    $<HTMLButtonElement>("virtual-prepare").disabled = ["planning", "running"].includes(state.status);
    $<HTMLButtonElement>("virtual-save-plan").disabled = state.audience.evaluated > 0 || state.status === "running";
    $<HTMLButtonElement>("virtual-app-start").disabled = state.audience.evaluated !== state.input.viewers || state.audience.installed <= state.experience.tested || state.status === "running";
    $("virtual-sample-button").hidden = state.audience.batches === 0;
    $("virtual-cost-sources").replaceChildren();
    for (const item of data.mediaCosts) {
      const card = node("div", "", "source-card");
      card.append(node("strong", `${item.platform} · ${item.hypothesisViews.toLocaleString()} hypothetical exposures`));
      card.append(node("p", item.costForRequestedViews ? `Published CPM reference: ${item.costForRequestedViews.low.toFixed(2)}–${item.costForRequestedViews.high.toFixed(2)} ${state.input.currency} for that reach. Global planning reference, not a guaranteed local auction price.` : "Media price unknown. No verifiable published CPM was selected."));
      if (item.benchmark) { const link = node("a", `${item.benchmark.source.label} · ${item.benchmark.source.observedFrom} to ${item.benchmark.source.observedTo}`) as HTMLAnchorElement; link.href = item.benchmark.source.url; link.target = "_blank"; link.rel = "noopener noreferrer"; card.append(link); }
      $("virtual-cost-sources").append(card);
    }
    const result = $("virtual-optimization"); result.replaceChildren();
    if (state.optimization) {
      result.append(node("h3", "What to improve next"), node("p", state.optimization.summary));
      for (const recommendation of state.optimization.recommendations) {
        const card = node("div", "", "subcard"); card.append(node("strong", `${recommendation.priority.toUpperCase()} · ${recommendation.change}`), node("p", recommendation.rationale), node("small", `${recommendation.basis} · ${recommendation.evidenceIds.join(", ")}`)); result.append(card);
      }
    }
    const experiences = $("virtual-experiences"); experiences.replaceChildren();
    for (const [error, issue] of Object.entries(state.experience.issues)) experiences.append(node("p", `${error} · ${issue.count} observed occurrences · example ${issue.exampleViewer}`, "notice warn"));
    for (const visit of state.experience.samples) {
      const card = node("div", "", "subcard");
      card.append(node("strong", `${visit.viewerId} · ${visit.outcome}`), node("p", `AI opinion: ${visit.feedback}`));
      for (const action of visit.actions) card.append(node("p", `${action.action} ${action.selector} · ${action.result} · ${action.reason}`, "help"));
      for (const error of visit.runtimeErrors) card.append(node("p", error, "help"));
      experiences.append(card);
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
  $("virtual-pause").onclick = () => { void action(async () => { notice((await api("/api/rehearsal/pause", { runId: state!.id })).message); }); };
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
  async function poll() { try { if (!busy) await load(); } catch (error) { notice(error instanceof Error ? error.message : "Could not load virtual launch.", true); } setTimeout(poll, 2500); }
  void poll();
}
