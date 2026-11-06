import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { redact } from "@hypothra/project-scanner";
import { validateLocalTarget } from "./journeys.js";
import { browserDecisionSchema, experienceSchema } from "./rehearsal-schema.js";
import type { Experience, SyntheticViewer } from "./rehearsal-schema.js";
import type { ProjectModel } from "./schema.js";
import type { Infer } from "./inference.js";

const unsafeControl = /pay|purchase|buy|checkout|subscrib|donat|delet|remov|destroy|publish|send|invit|transfer|withdraw|upload|admin|płat|kup|usuń|wyślij|opublikuj/iu;

/** A real, bounded browser visit. Opinions are AI hypotheses; actions/errors are observations. */
export async function exploreAsViewer(viewer: SyntheticViewer, model: ProjectModel, baseUrl: string, infer: Infer, runId: string,
  onActivity?: (label: string, kind: "browser" | "thinking" | "saved") => Promise<void>): Promise<Experience> {
  const target = validateLocalTarget(baseUrl);
  if (!viewer.install) throw new Error("Only individually evaluated installers can enter the app stage.");
  const browser = await chromium.launch({ headless: true });
  const report: Experience = { viewerId: viewer.id, outcome: "step-limit", feedback: "The visitor reached the action limit; no success or dropout is inferred.", aiEvidenceIds: [], observations: [], actions: [], runtimeErrors: [], blockedRequests: 0 };
  let requests = 0;
  const recordError = (message: string) => { if (report.runtimeErrors.length < 30 && !report.runtimeErrors.includes(message)) report.runtimeErrors.push(message); };
  try {
    const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: false, permissions: [],
      viewport: Number.parseInt(createHash("sha256").update(viewer.id).digest("hex").slice(0, 2), 16) % 2 ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
    context.setDefaultTimeout(5000); context.setDefaultNavigationTimeout(8000);
    await context.routeWebSocket("**/*", socket => { report.blockedRequests++; socket.close(); });
    await context.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (++requests > 150 || url.origin !== target.origin || !["GET", "HEAD", "POST", "OPTIONS"].includes(request.method())) {
        report.blockedRequests++; await route.abort("blockedbyclient"); return;
      }
      try {
        const response = await route.fetch({ maxRedirects: 0, timeout: 8000 }), location = response.headers().location;
        if (location && new URL(location, url).origin !== target.origin) { report.blockedRequests++; await route.abort("blockedbyclient"); return; }
        await route.fulfill({ response });
      } catch { await route.abort("failed").catch(() => {}); }
    });
    const page = await context.newPage();
    page.on("popup", popup => { report.blockedRequests++; void popup.close(); });
    page.on("dialog", dialog => { void dialog.dismiss(); });
    page.on("pageerror", error => recordError("Browser error fingerprint: " + createHash("sha256").update(error.message).digest("hex").slice(0, 12)));
    page.on("response", response => { if (response.status() >= 400) recordError(`Observed HTTP ${response.status()} (${response.request().resourceType()})`); });
    await onActivity?.("Opening the local test app", "browser");
    try { const response = await page.goto(target.href, { waitUntil: "domcontentloaded" }); if (response && response.status() >= 400) report.outcome = "blocked"; }
    catch { report.outcome = "blocked"; report.feedback = "The selected local page could not be loaded. This is a browser observation."; recordError("Initial navigation failed"); return experienceSchema.parse(report); }
    for (let step = 0; step < 8; step++) {
      await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => {});
      const observation = await page.locator("body").evaluate(body => {
        const controls = Array.from(body.querySelectorAll('a,button,input:not([type="hidden"]),textarea,select,[role="button"]'))
          .filter(element => (element as HTMLElement).getClientRects().length > 0).slice(0, 80).map(element => {
            const tag = element.tagName.toLowerCase(), ownId = element.getAttribute("id"), testId = element.getAttribute("data-testid");
            const selector = ownId ? `#${CSS.escape(ownId)}` : testId ? `[data-testid=${CSS.escape(testId)}]` : `${tag} >> nth=${Array.from(document.querySelectorAll(tag)).indexOf(element)}`;
            const label = element.getAttribute("aria-label") || (element as HTMLInputElement).labels?.[0]?.textContent || element.getAttribute("placeholder") || (tag === "input" ? element.getAttribute("type") || "input" : (element as HTMLElement).innerText);
            return { selector: selector.slice(0, 220), label: (label ?? "").trim().slice(0, 180), tag, type: (element.getAttribute("type") ?? "").slice(0, 80) };
          });
        return { controls, visibleText: (body as HTMLElement).innerText.slice(0, 6000) };
      });
      const observationId = `s${step + 1}`;
      report.observations.push({ id: observationId, pagePath: new URL(page.url()).pathname.slice(0, 180),
        visibleText: redact(observation.visibleText), controls: observation.controls.map(item => ({ ...item, label: redact(item.label) })) });
      await onActivity?.(`Reading the actual page and choosing action ${step + 1}`, "thinking");
      const decision = (await infer(browserDecisionSchema,
        "Act as this specific synthetic installer trying to satisfy their expectation. Choose ONE next action using ONLY selectors in the current observation. You may inspect, click, fill a dummy input or finish with satisfied/dropout. For fill choose email/name/password/search; the host supplies synthetic values. Never request real payments, outgoing messages, uploads, admin or destructive actions. Do not invent missing users, content or errors. Distinguish your personal opinion from observed page facts. Reference only observation IDs actually supplied. A confusing/empty experience may motivate dropout; that opinion is not a proven defect. Finish when your goal is met or you would leave. No arbitrary navigation or scripts.",
        { project: model.project, viewer, currentObservation: report.observations.at(-1), previousObservations: report.observations.slice(-3, -1), previousActions: report.actions, runtimeErrors: report.runtimeErrors })).value;
      if (decision.evidenceIds.some(id => !report.observations.some(item => item.id === id))) throw new Error("AI feedback cited an observation that did not occur.");
      report.feedback = decision.feedback; report.aiEvidenceIds = decision.evidenceIds;
      if (decision.action === "finish") {
        if (decision.verdict === "continue" || !decision.evidenceIds.length) throw new Error("Final AI feedback needs a verdict and observed context.");
        report.outcome = report.runtimeErrors.length ? "blocked" : decision.verdict;
        break;
      }
      const action: Experience["actions"][number] = { action: decision.action, selector: decision.selector, reason: decision.reason, result: "blocked" };
      report.actions.push(action);
      if (decision.action === "inspect") { action.result = "performed"; continue; }
      const control = observation.controls.find(item => item.selector === decision.selector);
      if (!control || unsafeControl.test(control.label) || /file|submit.*payment/i.test(control.type)) {
        report.outcome = "blocked"; report.feedback = "The proposed action was blocked by the test boundary; this is not evidence of an application bug."; break;
      }
      try {
        await onActivity?.(`${decision.action === "click" ? "Clicking" : "Filling"} “${control.label.slice(0, 80)}”`, "browser");
        if (decision.action === "click") {
          if (!["a", "button", "input", "div", "span"].includes(control.tag)) throw new Error("Control cannot be clicked");
          await page.locator(decision.selector).click();
        } else {
          if (!["input", "textarea"].includes(control.tag) || /credit|card|cvv|iban|payment/i.test(control.label)) throw new Error("Input is outside the test boundary");
          const values = { email: `hypothra-${runId.slice(0, 8)}-${viewer.id}@example.invalid`, name: "Hypothra Test Visitor", password: "Hypothra-Dummy-Only-42!", search: viewer.profile.need.slice(0, 120), none: "" };
          if (decision.inputKind === "none") throw new Error("No synthetic input kind selected");
          await page.locator(decision.selector).fill(values[decision.inputKind]);
        }
        action.result = "performed";
        await onActivity?.(`${decision.action === "click" ? "Clicked" : "Filled"} “${control.label.slice(0, 80)}”`, "saved");
        await page.waitForLoadState("domcontentloaded").catch(() => {});
      } catch { action.result = "failed"; report.outcome = "blocked"; recordError(`Observed ${decision.action} failure at ${observationId}`); break; }
    }
    return experienceSchema.parse(report);
  } finally { await browser.close(); }
}
