import type { projectStatus } from "./workflow.js";
import type { findPublicPrices } from "./public-prices.js";
import type { DashboardUI } from "./dashboard-ui.js";

/** Serialized into the local page. Keep all runtime helpers inside this function. */
export function dashboardClient(token: string, ui: DashboardUI) {
  type State = Awaited<ReturnType<typeof projectStatus>> & { projectRoot: string };
  type Channel = State["plan"]["channels"][number];
  let state: State;
  let channels: Channel[] = [];
  let technologies: State["model"]["stack"] = [];
  let features: State["model"]["capabilities"] = [];
  let productJourneys: State["model"]["userJourneys"] = [];
  let aiPoll: ReturnType<typeof setTimeout> | undefined;
  let publicResults: Awaited<ReturnType<typeof findPublicPrices>> | null = null;
  let busy = false;
  let folderLocation = "";
  let folderParent: string | null = null;
  let folderRequest = 0;
  let folderEditing = false;
  const dirty = new Set<string>();
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const value = (id: string) => $<HTMLInputElement>(id).value;
  const number = (id: string) => Number(value(id));
  const put = (id: string, text: unknown) => { $<HTMLInputElement>(id).value = String(text); };
  const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = "") => {
    const result = document.createElement(tag); result.textContent = text; result.className = className; return result;
  };
  const money = (amount: number, currency = state?.plan.currency ?? "PLN") => new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  const format = (amount: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(amount);
  const sourceName = (type: string) => ({ "manual-assumption": "Your cost assumption", "public-benchmark": "Published web benchmark", "account-api": "Your campaign history", "account-export": "Your campaign export" })[type] ?? type;
  function step(index: number) {
    ui.navigate(index);
  }
  function message(text: string, kind = "") { $("status").textContent = text; $("status").className = `status ${kind}`; }
  function changed(scope: string) {
    dirty.add(scope);
    if (scope === "product") { $("approval-note").textContent = "Save your changes before continuing."; $<HTMLButtonElement>("approve").disabled = true; }
  }
  async function api(path: string, body?: unknown) {
    let response: Response;
    try { response = await fetch(path, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json", "X-Hypothra-Token": token, ...(state ? { "X-Hypothra-Project": state.projectRoot } : {}) } : {}, ...(body ? { body: JSON.stringify(body) } : {}) }); ui.connection(true); }
    catch { ui.connection(false); throw new Error("Connection interrupted. Your saved work is safe. Keep Hypothra running and try again."); }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
  }
  async function action(task: () => Promise<void>, success: string) {
    if (busy) return;
    busy = true;
    const trigger = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
    const labels: Record<string, string> = { "save-product": "Saving changes…", "approve": "Confirming product…", "open-project": "Reading your project…", "browse-project": "Opening project…", "run-checks": "Checking your app…", "run": "Calculating…", "find-prices": "Finding published prices…", "analyze-ai": "Starting AI analysis…" };
    ui.busy(trigger, true, labels[trigger?.id ?? ""] ?? "Working…");
    message(trigger ? labels[trigger.id] ?? "Working…" : "Loading your workspace…");
    try { await task(); await load(); message(state ? success : "Choose your project folder. AI will prepare the details automatically.", "success"); if (trigger) ui.announce(success); else $("status").classList.add("initial-ready"); }
    catch (error) { const text = error instanceof Error ? error.message : "Please try again."; message(text, "error"); if (trigger) ui.announce(text, true); }
    finally {
      busy = false;
      ui.busy(trigger, false);
      if (state) $<HTMLButtonElement>("approve").disabled = dirty.has("product");
      if (state) renderAI();
    }
  }
  function field(label: string, id: string, initial: unknown, options: { type?: string; min?: string; max?: string; help?: string; multiline?: boolean } = {}) {
    const wrapper = node("label", label, "field");
    const input = options.multiline ? node("textarea") : node("input");
    input.id = id; input.value = String(initial); input.required = true;
    if (input instanceof HTMLInputElement) { input.type = options.type ?? "text"; input.maxLength = 180; if (input.type === "number") { input.step = "any"; input.min = options.min ?? "0"; input.max = options.max ?? "1000000000"; } }
    else input.maxLength = 4000;
    wrapper.append(input); if (options.help) wrapper.append(node("small", options.help)); return wrapper;
  }
  function select(label: string, id: string, initial: string, choices: [string, string][]) {
    const wrapper = node("label", label, "field"), input = node("select"); input.id = id;
    for (const [key, text] of choices) { const option = node("option", text); option.value = key; input.append(option); }
    input.value = initial; wrapper.append(input); return wrapper;
  }
  function ensureOption(id: string, current: string) {
    const select = $<HTMLSelectElement>(id);
    if (![...select.options].some(option => option.value === current)) { const option = node("option", current); option.value = current; select.append(option); }
    select.value = current;
  }
  function renderProduct() {
    const project = state.model.project;
    for (const [id, text] of Object.entries({ "brief-name": project.name, "brief-description": project.description, "brief-audience": project.audience.join(" · "), "brief-value": project.valueProposition, "brief-avatar": project.name.slice(0, 1).toUpperCase() })) $(id).textContent = text;
    for (const [id, text] of Object.entries({ "product-name": project.name, "product-description": project.description, "product-audience": project.audience.join("; "), "product-value": project.valueProposition, "product-money": project.monetization })) put(id, text);
    technologies = structuredClone(state.model.stack); features = structuredClone(state.model.capabilities); productJourneys = structuredClone(state.model.userJourneys);
    put("unknown-notes", state.model.unknowns.join("\n"));
    renderTechnologies(); renderFeatures(); renderProductJourneys();
  }
  function renderTechnologies() {
    const container = $("technology-fields"); container.replaceChildren();
    technologies.forEach((item, index) => {
      const row = node("div", "", "tech-row");
      const name = node("input"), category = node("input");
      name.value = item.name; name.required = true; name.maxLength = 180; name.setAttribute("aria-label", `Technology ${index + 1}`);
      category.value = item.category; category.required = true; category.maxLength = 180; category.setAttribute("aria-label", `Technology category ${index + 1}`);
      name.oninput = () => { item.name = name.value; item.provenance = "user-corrected"; changed("product"); };
      category.oninput = () => { item.category = category.value; item.provenance = "user-corrected"; changed("product"); };
      const remove = node("button", "Remove", "muted-button"); remove.type = "button";
      remove.onclick = () => { technologies.splice(index, 1); changed("product"); renderTechnologies(); };
      row.append(name, category, remove); container.append(row);
    });
  }
  function renderFeatures() {
    const container = $("feature-fields"); container.replaceChildren(); $("feature-count").textContent = `(${features.length})`;
    features.forEach((item, index) => {
      const row = node("div", "", "feature-row"), name = node("input"), description = node("textarea");
      name.value = item.title; name.required = true; name.maxLength = 180; name.setAttribute("aria-label", `Feature ${index + 1}`);
      description.value = item.description; description.required = true; description.maxLength = 4000; description.setAttribute("aria-label", `Feature description ${index + 1}`);
      name.oninput = () => { item.title = name.value; item.status = "user-confirmed"; changed("product"); };
      description.oninput = () => { item.description = description.value; item.status = "user-confirmed"; changed("product"); };
      const status = node("span", item.status === "observed" ? "Found in code · not yet checked in the app" : item.status === "inferred" ? "Needs your review" : "Confirmed by you", "help");
      const remove = node("button", "Remove feature", "muted-button"); remove.type = "button";
      remove.onclick = () => { features.splice(index, 1); renderFeatures(); changed("product"); };
      row.append(name, description, status, remove); container.append(row);
    });
  }
  function renderProductJourneys() {
    const container = $("product-journeys"); container.replaceChildren();
    productJourneys.forEach((journey, index) => {
      const card = node("div", "", "subcard");
      const name = field("Journey name", `product-journey-${index}-name`, journey.name), goal = field("User's goal", `product-journey-${index}-goal`, journey.goal, { multiline: true }), steps = field("Steps · one per line", `product-journey-${index}-steps`, journey.steps.join("\n"), { multiline: true });
      for (const [key, wrapper] of [["name", name], ["goal", goal], ["steps", steps]] as const) wrapper.addEventListener("input", () => {
        const text = (wrapper.querySelector("input,textarea") as HTMLInputElement).value;
        if (key === "steps") journey.steps = text.split("\n").map(item => item.trim()).filter(Boolean); else journey[key] = text;
        changed("product");
      });
      const remove = node("button", "Remove journey", "muted-button"); remove.type = "button"; remove.onclick = () => { productJourneys.splice(index, 1); renderProductJourneys(); changed("product"); };
      card.append(name, goal, steps, remove); container.append(card);
    });
  }
  function renderAI() {
    const ai = state.ai;
    const running = ai.status === "running" || ai.status === "idle";
    $("ai-progress").dataset.working = String(running);
    $("ai-progress").dataset.complete = String(ai.status === "completed");
    (ai.status === "completed" ? $("product-ai-actions") : $("ai-progress")).append($("analyze-ai"));
    $("ai-live-track").hidden = !running;
    $("ai-heading").textContent = running ? "AI is understanding your project…" : ai.status === "completed" ? "Your project details were filled by AI" : ai.status === "disabled" ? "Automatic analysis is off for this run" : "AI analysis needs attention";
    $("ai-message").textContent = ai.message;
    $("ai-progress").className = `run-stage ai-progress ${["failed", "unavailable"].includes(ai.status) ? "warn" : ""}`;
    $("analyze-ai").hidden = running;
    $("analyze-ai").textContent = ai.status === "completed" ? "Re-analyze with AI" : "Analyze with AI";
    $("product-form").hidden = running && !dirty.has("product");
    $<HTMLButtonElement>("approve").disabled = running || dirty.has("product");
    if (aiPoll) clearTimeout(aiPoll);
    if (running) aiPoll = setTimeout(async () => {
      try {
        state.ai = await api("/api/ai/status");
        if (state.ai.status !== "running" && state.ai.status !== "idle") { await load(); message(state.ai.message, state.ai.status === "completed" ? "success" : "error"); }
        else renderAI();
      } catch { aiPoll = setTimeout(renderAI, 1500); }
    }, 1800);
  }
  function newChannel(platform: Channel["platform"] = "meta"): Channel {
    const benchmark = state.benchmarks.find(item => item.platform === platform && item.currency === value("currency"));
    return { id: `ad-${crypto.randomUUID().slice(0, 8)}`, platform, objective: "traffic", budget: 0, benchmarkId: benchmark?.id ?? "", audience: state.model.project.audience.join("; "),
      creative: { message: state.model.project.description, promise: state.model.project.valueProposition, callToAction: "Try the app", capabilityIds: [] },
      ctr: { low: 0.005, typical: 0.01, high: 0.02 }, signupRate: { low: 0.02, typical: 0.05, high: 0.1 }, activationRate: { low: 0.3, typical: 0.5, high: 0.7 }, paidRate: { low: 0.02, typical: 0.05, high: 0.1 } };
  }
  function collectChannels() {
    channels.forEach((item, i) => {
      item.platform = value(`channel-${i}-platform`) as Channel["platform"]; item.objective = value(`channel-${i}-objective`) as Channel["objective"];
      item.budget = number(`channel-${i}-budget`); item.benchmarkId = value(`channel-${i}-source`); item.audience = value(`channel-${i}-audience`);
      item.creative.message = value(`channel-${i}-message`); item.creative.promise = value(`channel-${i}-promise`); item.creative.callToAction = value(`channel-${i}-cta`);
      item.creative.capabilityIds = [...document.querySelectorAll<HTMLInputElement>(`[data-capability-channel="${i}"]:checked`)].map(input => input.value);
      const journey = value(`channel-${i}-journey`); if (journey) item.journeyId = journey; else delete item.journeyId;
      for (const key of ["ctr", "signupRate", "activationRate", "paidRate"] as const) for (const range of ["low", "typical", "high"] as const) item[key][range] = number(`channel-${i}-${key}-${range}`) / 100;
    });
  }
  function renderChannels() {
    const container = $("channel-fields"); container.replaceChildren();
    channels.forEach((channel, i) => {
      const card = node("div", "", "subcard"), header = node("div", "", "panel-head"); header.append(node("h3", `Ad channel ${i + 1}`));
      if (channels.length > 1) { const remove = node("button", "Remove", "muted-button"); remove.type = "button"; remove.onclick = () => { collectChannels(); channels.splice(i, 1); renderChannels(); changed("launch"); }; header.append(remove); }
      card.append(header);
      const grid = node("div", "", "form-grid");
      grid.append(select("Where will your ad run?", `channel-${i}-platform`, channel.platform, [["meta", "Facebook & Instagram"], ["tiktok", "TikTok"], ["other", "Another channel"]]),
        field("Ad budget", `channel-${i}-budget`, channel.budget, { type: "number" }),
        select("Main goal", `channel-${i}-objective`, channel.objective, [["traffic", "Bring people to the app"], ["conversions", "Get signups or purchases"], ["awareness", "Make the product known"]]),
        field("Who should see this ad?", `channel-${i}-audience`, channel.audience));
      const messageField = field("What will your ad say?", `channel-${i}-message`, channel.creative.message, { multiline: true }); messageField.classList.add("wide");
      grid.append(messageField, field("What does the ad promise?", `channel-${i}-promise`, channel.creative.promise, { multiline: true }), field("Call to action", `channel-${i}-cta`, channel.creative.callToAction));
      const sources = state.benchmarks.filter(item => item.platform === channel.platform);
      const options: [string, string][] = [["", "Choose a cost estimate"]];
      for (const source of sources) options.push([source.id, `${sourceName(source.source.type)} · ${money(source.price.typical, source.currency)} ${source.metric.toUpperCase()}`]);
      grid.append(select("Ad cost estimate", `channel-${i}-source`, channel.benchmarkId, options),
        select("Which app check matches this ad?", `channel-${i}-journey`, channel.journeyId ?? "", [["", "Do not attach an app check"], ...state.journeys.journeys.map(item => [item.id, item.persona] as [string, string])]));
      card.append(grid);
      const mapping = node("details"), summary = node("summary", "Which product features does this ad promise?"); mapping.append(summary);
      for (const feature of state.model.capabilities) {
        const label = node("label", "", "inline"), check = node("input"); check.type = "checkbox"; check.value = feature.id; check.dataset.capabilityChannel = String(i); check.checked = channel.creative.capabilityIds.includes(feature.id);
        label.append(check, document.createTextNode(feature.title)); mapping.append(label);
      }
      card.append(mapping);
      const rates = node("details"); rates.append(node("summary", "Conversion assumptions · percentages you can change"));
      const heading = node("div", "", "rate-grid"); for (const title of ["People who…", "Cautious %", "Expected %", "Optimistic %"]) heading.append(node("span", title)); rates.append(heading);
      for (const [key, title] of [["ctr", "Click after seeing the ad"], ["signupRate", "Sign up after clicking"], ["activationRate", "Reach the main benefit"], ["paidRate", "Choose to pay"]] as const) {
        const row = node("div", "", "rate-grid"); row.append(node("span", title));
        for (const range of ["low", "typical", "high"] as const) { const input = node("input"); input.type = "number"; input.min = "0"; input.max = "100"; input.step = "any"; input.required = true; input.id = `channel-${i}-${key}-${range}`; input.value = String(Number((channel[key][range] * 100).toFixed(8))); input.setAttribute("aria-label", `${title} ${range} percent`); row.append(input); }
        rates.append(row);
      }
      rates.append(node("p", "These are assumptions, not results from real customers. Published ad prices do not determine your signup or payment rates.", "help")); card.append(rates); container.append(card);
      $<HTMLSelectElement>(`channel-${i}-platform`).onchange = () => { collectChannels(); channels[i]!.benchmarkId = ""; renderChannels(); changed("launch"); };
    });
    updateBudget();
  }
  function updateBudget() {
    const adSpend = channels.reduce((sum, _item, i) => sum + (document.getElementById(`channel-${i}-budget`) ? number(`channel-${i}-budget`) : 0), 0);
    const fixed = number("fixed-costs"), left = number("total-budget") - fixed - adSpend;
    $("budget-ads").textContent = money(adSpend, value("currency")); $("budget-fixed").textContent = money(fixed, value("currency")); $("budget-left").textContent = money(left, value("currency"));
    $("budget-left").className = left < 0 ? "bad" : "good";
    $<HTMLInputElement>("total-budget").setCustomValidity(left < -0.001 ? "Your ad budgets and other costs exceed your total budget." : "");
  }
  function renderManualPrices() {
    const container = $("manual-prices"); container.replaceChildren();
    const manual = state.benchmarks.filter(item => item.source.type === "manual-assumption");
    if (!manual.length) container.append(node("p", "Your saved estimates come from sources. Use the advanced editor to add a separate manual assumption."));
    for (const item of manual) {
      const card = node("div", "", "subcard"); card.append(node("h3", `${item.platform === "meta" ? "Facebook & Instagram" : item.platform} · ${item.currency}`), node("p", item.metric === "cpm" ? "Assumed cost of showing the ad 1,000 times." : "Assumed cost for one click."));
      const grid = node("div", "", "price-grid");
      for (const key of ["low", "typical", "high"] as const) grid.append(field(key === "low" ? "Lower cost" : key === "high" ? "Higher cost" : "Typical cost", `price-${item.id}-${key}`, item.price[key], { type: "number", min: "0.000001" }));
      card.append(grid); container.append(card);
    }
  }
  function renderRuntime() {
    const runtime = state.runtime;
    $("test-target").textContent = `Local test app: ${state.journeys.baseUrl}`;
    const container = $("journey-list"); container.replaceChildren();
    for (const journey of state.journeys.journeys) {
      const finding = state.runtimeCurrent ? runtime?.findings.find(item => item.journeyId === journey.id) : undefined;
      const row = node("div", "", "journey"), description = node("div");
      description.append(node("h3", journey.goal), node("p", journey.persona), node("small", `${journey.steps.length} steps · ${journey.viewport.width < 700 ? "Phone-sized screen" : "Desktop screen"}`));
      if (finding?.status === "failed") description.append(node("p", `An expected step did not complete during ${finding.failedStage}.`, "bad"));
      row.append(description, node("span", finding ? finding.status === "passed" ? "Passed" : "Needs attention" : "Not checked yet", `outcome ${finding?.status === "passed" ? "good" : finding ? "bad" : ""}`)); container.append(row);
    }
    $<HTMLInputElement>("runtime").disabled = !state.runtimeCurrent;
    if (!state.runtimeCurrent) $<HTMLInputElement>("runtime").checked = false;
  }
  function renderResults() {
    const container = $("result-cards"), findings = $("findings-summary"); container.replaceChildren(); findings.replaceChildren();
    const report = state.report;
    $("result-notice").textContent = !report ? "Your scenario is ready to calculate. Save your launch plan, then use the button below." : !state.reportCurrent ? "Your settings changed. Recalculate to see results for the current plan." : "Scenario ready. These figures use your saved assumptions and the selected ad cost evidence.";
    $("report-link").hidden = !report || !state.reportCurrent;
    if (!report) return;
    const selected = report.totals.find(item => item.variant === value("result-variant"))!;
    for (const [label, amount, cash] of [["Expected visits", selected.clicks, false], ["Expected signups", selected.signups, false], ["First-month revenue", selected.firstMonthRevenue, true], ["First-month profit", selected.firstMonthProfit, true]] as const) {
      const card = node("div", "", "card"); card.append(node("div", label, "label"), node("div", cash ? money(amount, report.plan.currency) : format(amount), "number")); container.append(card);
    }
    const observed = report.channels.filter(item => item.runtimeEvidence?.status === "failed");
    if (observed.length) findings.append(node("div", "App checks found a problem in a path linked to your ad. If visitors hit the same problem, the assumed conversions may not happen. Open the full report for the observed steps.", "notice warn"));
    const manual = report.channels.some(item => item.benchmark.source.type === "manual-assumption");
    if (manual) findings.append(node("p", "This scenario still uses example or manually chosen ad costs. You can look up published costs in step 2.", "help"));
  }
  async function load() {
    const data = await api("/api/state");
    if (data.status === "choose-project") {
      document.querySelectorAll<HTMLElement>("[data-panel],.steps,.advanced").forEach(element => { element.hidden = true; });
      $("folder-current").textContent = "No project selected yet.";
      $("active-project").hidden = true; $("folder-controls").hidden = false; $("workspace-intro").hidden = false; $("sidebar-placeholder").hidden = false;
      return;
    }
    if (state?.projectRoot !== data.projectRoot) {
      if (state && dirty.size) throw new Error("Another window selected a different project. Copy any unsaved edits you want to keep, then use Reload saved data / discard edits.");
      publicResults = null; $("public-prices").replaceChildren();
      folderEditing = false;
    }
    state = data;
    $("active-project").hidden = false; $("folder-controls").hidden = !folderEditing; $("workspace-intro").hidden = true; $("sidebar-placeholder").hidden = true;
    $("active-project-name").textContent = state.model.project.name;
    $("workspace-project").textContent = state.model.project.name;
    $("project-monogram").textContent = state.model.project.name.slice(0, 1).toUpperCase();
    document.querySelector<HTMLElement>('.step[data-step="0"]')!.dataset.done = String(state.status === "approved");
    $("folder-current").textContent = "Current project: " + state.projectRoot;
    put("project-folder", state.projectRoot);
    document.querySelectorAll<HTMLElement>(".steps,.advanced").forEach(element => { element.hidden = false; });
    if (![...document.querySelectorAll<HTMLElement>("[data-panel]")].some(element => !element.hidden)) step(0);
    $("state").textContent = state.status === "approved" ? "Confirmed" : "Needs your review";
    $("approval-note").textContent = state.status === "approved" ? "Your description is confirmed." : "Confirm the saved description to continue.";
    $("approve").textContent = state.status === "approved" ? "Continue to launch plan" : "Looks right — continue";
    $("stack").replaceChildren(...state.model.stack.map(item => node("span", item.name, "chip")));
    $("unknowns").replaceChildren(...state.model.unknowns.map(text => node("li", text)));
    $("scan").textContent = `${state.inspection.filesScanned} files reviewed · ${state.inspection.evidence.length} source references`;
    $("evidence").textContent = state.markdown; $("revision").textContent = `Saved model revision: ${state.revision}`;
    if (!dirty.has("product")) renderProduct();
    if (!dirty.has("launch")) {
      for (const [id, val] of Object.entries({ "launch-idea": state.plan.description, "total-budget": state.plan.totalBudget, "fixed-costs": state.plan.fixedCosts, "monthly-price": state.plan.monthlyPrice, "period-days": state.plan.periodDays })) put(id, val);
      ensureOption("currency", state.plan.currency); ensureOption("country", state.plan.country);
      channels = structuredClone(state.plan.channels); renderChannels();
    } else {
      collectChannels();
      const valid = new Set(state.model.capabilities.map(item => item.id));
      for (const channel of channels) channel.creative.capabilityIds = channel.creative.capabilityIds.filter(id => valid.has(id));
      renderChannels();
    }
    if (!dirty.has("prices")) renderManualPrices();
    for (const [id, data] of [["project", state.model], ["launch", state.plan], ["benchmarks", state.benchmarks], ["journeys", state.journeys]] as const) if (!dirty.has(`json-${id}`)) put(id, JSON.stringify(data, null, 2));
    renderRuntime(); renderResults(); renderAI();
  }
  function renderPublicPrices() {
    const container = $("public-prices"); container.replaceChildren();
    if (!publicResults) return;
    container.append(node("div", "Published global benchmarks. The period and source are shown for each estimate. Local campaign prices may differ.", "notice"));
    for (const benchmark of publicResults.benchmarks) {
      const card = node("div", "", "source-card"); card.append(node("h3", `${benchmark.platform === "meta" ? "Facebook & Instagram" : "TikTok"} · ${benchmark.metric === "cpm" ? "Cost per 1,000 views" : "Cost per click"}`), node("div", `${money(benchmark.price.low, benchmark.currency)} – ${money(benchmark.price.high, benchmark.currency)}`, "price"), node("p", `Typical: ${money(benchmark.price.typical, benchmark.currency)} · ${benchmark.source.observedFrom} to ${benchmark.source.observedTo}`));
      const link = node("a", "Read the published source ↗"); link.href = benchmark.source.url!; link.target = "_blank"; link.rel = "noopener noreferrer"; card.append(link);
      if (benchmark.currencyConversion) card.append(node("p", `Converted from USD using a public NBP reference rate dated ${benchmark.currencyConversion.date}.`));
      const button = node("button", "Use this cost estimate"); button.type = "button";
      button.onclick = () => action(async () => {
        if (benchmark.currency !== value("currency")) throw new Error("Your currency changed. Look up prices again for the new currency.");
        collectChannels();
        await api("/api/experiment", { kind: "benchmarks", value: [...state.benchmarks.filter(item => item.id !== benchmark.id), benchmark] });
        state.benchmarks = [...state.benchmarks.filter(item => item.id !== benchmark.id), benchmark];
        let channel = channels.find(item => item.platform === benchmark.platform);
        if (!channel) { channel = newChannel(benchmark.platform); channels.push(channel); }
        channel.benchmarkId = benchmark.id; changed("launch"); renderChannels();
      }, "Cost estimate selected. Review your ad budget, then save the launch plan.");
      card.append(document.createElement("br"), button); container.append(card);
    }
  }
  document.querySelectorAll<HTMLButtonElement>("[data-step]").forEach(button => { button.onclick = () => step(Number(button.dataset.step)); });
  $("change-project").onclick = () => { folderEditing = !folderEditing; $("folder-controls").hidden = !folderEditing; if (folderEditing) { $("folder-controls").scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); $("browse-project").focus({ preventScroll: true }); } };
  async function openFolder(directory: string) {
    if (dirty.size) throw new Error("Save your current edits, or use Reload saved data / discard edits before switching projects.");
    message("Opening your project. AI will prepare its description automatically…");
    await api("/api/project/open", { directory });
    dirty.clear(); step(0);
  }
  $("folder-form").onsubmit = event => { event.preventDefault(); void action(() => openFolder(value("project-folder")), "Project opened. AI is preparing the details for you."); };
  async function browseFolder(directory?: string) {
    const requestId = ++folderRequest;
    $("folder-picker-status").textContent = "Loading folders…";
    $<HTMLButtonElement>("folder-select").disabled = true;
    try {
      const listing: { directory: string; parent: string | null; roots: string[]; folders: { name: string; path: string }[]; truncated: boolean } = await api("/api/project/browse", directory ? { directory } : {});
      if (requestId !== folderRequest) return;
      folderLocation = listing.directory; folderParent = listing.parent; put("folder-path", folderLocation);
      const roots = $("folder-roots"); roots.replaceChildren();
      for (const root of listing.roots) { const button = node("button", root); button.type = "button"; button.onclick = () => { void browseFolder(root); }; roots.append(button); }
      const list = $("folder-list"); list.replaceChildren();
      for (const folder of listing.folders) {
        const button = node("button", "▸  " + folder.name); button.type = "button"; button.setAttribute("aria-label", "Open folder " + folder.name); button.onclick = () => { void browseFolder(folder.path); }; list.append(button);
      }
      if (!listing.folders.length) list.append(node("p", "No subfolders here. You can select this folder below.", "help"));
      $("folder-picker-status").textContent = listing.truncated ? "Showing the first folders. Paste a path above if yours is not listed." : "Select this folder, or open a subfolder to continue.";
      $<HTMLButtonElement>("folder-parent").disabled = folderParent === null;
      $<HTMLButtonElement>("folder-select").disabled = false;
    } catch (error) {
      if (requestId !== folderRequest) return;
      $("folder-picker-status").textContent = error instanceof Error ? error.message : "This folder could not be opened.";
    }
  }
  $("browse-project").onclick = () => {
    if (busy) return;
    if (dirty.size) { message("Save or discard your current edits before choosing another project.", "error"); return; }
    $<HTMLDialogElement>("folder-picker").showModal();
    void browseFolder(value("project-folder") || undefined);
  };
  $("folder-cancel").onclick = () => { folderRequest++; $<HTMLDialogElement>("folder-picker").close(); };
  $("folder-path-form").onsubmit = event => { event.preventDefault(); void browseFolder(value("folder-path")); };
  $("folder-parent").onclick = () => { if (folderParent) void browseFolder(folderParent); };
  $("folder-select").onclick = () => {
    if (!folderLocation) return;
    $<HTMLDialogElement>("folder-picker").close();
    void action(() => openFolder(folderLocation), "Project opened. AI is preparing the details for you.");
  };
  $("product-form").addEventListener("input", () => changed("product"));
  $("launch-form").addEventListener("input", () => { changed("launch"); updateBudget(); });
  $("prices-form").addEventListener("input", () => changed("prices"));
  $("add-technology").onclick = () => { technologies.push({ name: "New technology", category: "Other", provenance: "user-corrected", evidenceIds: [] }); renderTechnologies(); changed("product"); };
  $("add-feature").onclick = () => { features.push({ id: `feature-${crypto.randomUUID().slice(0, 8)}`, title: "New feature", description: "Describe what your product does.", status: "user-confirmed", evidenceIds: [] }); renderFeatures(); changed("product"); };
  $("add-product-journey").onclick = () => { productJourneys.push({ id: `journey-${crypto.randomUUID().slice(0, 8)}`, name: "New user journey", goal: "Describe the user's goal", steps: ["Open the app"], evidenceIds: [] }); renderProductJourneys(); changed("product"); };
  $("add-channel").onclick = () => { collectChannels(); channels.push(newChannel()); renderChannels(); changed("launch"); };
  $("product-form").onsubmit = event => { event.preventDefault(); void action(async () => {
    const model = structuredClone(state.model);
    model.project = { name: value("product-name"), description: value("product-description"), audience: value("product-audience").split(";").map(item => item.trim()).filter(Boolean), valueProposition: value("product-value"), monetization: value("product-money"), descriptionBasis: "user" };
    model.stack = technologies; model.capabilities = features; model.userJourneys = productJourneys; model.unknowns = value("unknown-notes").split("\n").map(item => item.trim()).filter(Boolean);
    await api("/api/draft", { model, expectedRevision: state.revision }); dirty.delete("product");
  }, "Product updated. Check the saved description, then confirm it to continue."); };
  $("approve").onclick = () => { void action(async () => {
    if (dirty.has("product")) throw new Error("Save your product changes first.");
    await api("/api/approve", { revision: state.revision }); step(1);
  }, "Product confirmed. Next, describe your launch."); };
  $("launch-form").onsubmit = event => { event.preventDefault(); void action(async () => {
    collectChannels();
    for (const channel of channels) {
      const benchmark = state.benchmarks.find(item => item.id === channel.benchmarkId);
      if (!benchmark) throw new Error("Choose an ad cost estimate for every channel.");
      if (benchmark.currency !== value("currency")) throw new Error("An ad estimate uses a different currency. Look up published prices for your selected currency or correct your assumptions.");
      for (const key of ["ctr", "signupRate", "activationRate", "paidRate"] as const) if (channel[key].low > channel[key].typical || channel[key].typical > channel[key].high) throw new Error("Conversion assumptions must run from cautious to expected to optimistic.");
    }
    await api("/api/experiment", { kind: "launch", value: { ...state.plan, description: value("launch-idea"), totalBudget: number("total-budget"), fixedCosts: number("fixed-costs"), currency: value("currency"), country: value("country"), monthlyPrice: number("monthly-price"), periodDays: number("period-days"), channels } });
    dirty.delete("launch");
  }, "Launch plan saved. You can now run app checks or calculate your scenario."); };
  $("prices-form").onsubmit = event => { event.preventDefault(); void action(async () => {
    const benchmarks = structuredClone(state.benchmarks);
    for (const item of benchmarks.filter(item => item.source.type === "manual-assumption")) {
      for (const key of ["low", "typical", "high"] as const) item.price[key] = number(`price-${item.id}-${key}`);
      if (item.price.low > item.price.typical || item.price.typical > item.price.high) throw new Error("Ad cost assumptions must run from lower to typical to higher cost.");
    }
    await api("/api/experiment", { kind: "benchmarks", value: benchmarks }); dirty.delete("prices");
  }, "Your ad cost assumptions were saved."); };
  $("find-prices").onclick = () => { void action(async () => { publicResults = await api("/api/public-prices", { currency: value("currency") }); renderPublicPrices(); }, "Published prices found. Choose an estimate to use in your plan."); };
  $("run-checks").onclick = () => { void action(async () => {
    if (state.status !== "approved") { step(0); throw new Error("Confirm your product in step 1 before running app checks."); }
    message("Trying your configured paths in the local test app. This can take up to two minutes…");
    await api("/api/journeys", { runLocalTest: true }); $<HTMLInputElement>("runtime").checked = true;
  }, "App checks finished. Review the paths below, including any that need attention."); };
  $("run").onclick = () => { void action(async () => {
    if (dirty.has("launch") || dirty.has("prices") || dirty.has("product")) throw new Error("Save your changes before calculating the scenario.");
    if (state.status !== "approved") { step(0); throw new Error("Confirm your product in step 1 before calculating a launch scenario."); }
    await api("/api/launch", { useRuntime: $<HTMLInputElement>("runtime").checked });
  }, "Your launch scenario is ready."); };
  $("result-variant").onchange = renderResults;
  $("analyze-ai").onclick = () => { void action(async () => {
    if (dirty.has("product")) throw new Error("Save your corrections before asking AI to analyze the saved project again.");
    state.ai = await api("/api/ai/analyze", { reanalyze: true }); renderAI();
  }, "AI is preparing the project details. You can review and edit its summary when it is ready."); };
  for (const id of ["project", "launch", "benchmarks", "journeys"]) $(id).addEventListener("input", () => changed(`json-${id}`));
  $("save-project").onclick = () => { void action(async () => { await api("/api/draft", { model: JSON.parse(value("project")), expectedRevision: state.revision }); dirty.delete("json-project"); dirty.delete("product"); }, "Application model saved. Confirm the changes in step 1."); };
  document.querySelectorAll<HTMLButtonElement>("[data-save]").forEach(button => { button.onclick = () => { void action(async () => { const kind = button.dataset.save!; await api("/api/experiment", { kind, value: JSON.parse(value(kind)) }); dirty.delete(`json-${kind}`); if (kind === "launch") dirty.delete("launch"); if (kind === "benchmarks") dirty.delete("prices"); }, "Advanced settings saved."); }; });
  $("reload").onclick = () => { dirty.clear(); void action(async () => {}, "Saved settings reloaded."); };
  window.addEventListener("beforeunload", event => { if (dirty.size) { event.preventDefault(); event.returnValue = ""; } });
  setInterval(() => {
    const ai = state?.ai, element = $("ai-elapsed");
    if (!ai || ai.status !== "running" || !ai.startedAt) { element.textContent = ""; return; }
    const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(ai.startedAt)) / 1000));
    element.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} elapsed`;
  }, 1000);
  void action(async () => {}, "Start by checking your product brief. Each step takes you closer to a clearer launch.");
}
