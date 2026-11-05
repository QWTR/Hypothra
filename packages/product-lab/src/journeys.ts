import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { journeysSchema } from "./schema.js";
import type { JourneyConfig, JourneyStage } from "./schema.js";
import type { RuntimeFinding, RuntimeReport } from "./launch.js";
import { revision } from "./storage.js";

export function validateLocalTarget(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password
    || url.pathname !== "/" || url.search || url.hash || !url.port) {
    throw new Error("Browser tests require an explicit http://127.0.0.1:<port>/ or http://[::1]:<port>/ local test origin.");
  }
  return url;
}

export async function runJourneys(input: unknown, modelRevision: string, options: {
  recordScreenshot?: (name: string, data: Buffer) => Promise<void>; stepTimeoutMs?: number;
} = {}): Promise<RuntimeReport> {
  const config = journeysSchema.parse(input);
  const target = validateLocalTarget(config.baseUrl);
  const timeout = options.stepTimeoutMs ?? 4000;
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 10_000) throw new Error("Step timeout must be 100–10,000 ms.");
  let browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch { throw new Error("Chromium is unavailable. Run npm exec -- playwright install chromium, then retry. No test was performed."); }
  const findings: RuntimeFinding[] = [];
  let requestCount = 0, blockedRequests = 0;
  const deadline = Date.now() + 120_000;
  try {
    for (const journey of config.journeys) {
      const context = await browser.newContext({ viewport: journey.viewport, serviceWorkers: "block", acceptDownloads: false,
        permissions: journey.denyPermissions ? [] : ["geolocation"], geolocation: { latitude: 0, longitude: 0 } });
      context.setDefaultTimeout(timeout);
      context.setDefaultNavigationTimeout(timeout);
      const observed = new Set<string>();
      let stage: JourneyStage = "landing";
      const completed = new Set<JourneyStage>();
      let failed = false;
      try {
        await context.routeWebSocket("**/*", socket => { blockedRequests++; socket.close(); });
        await context.route("**/*", async route => {
          requestCount++;
          const request = route.request();
          const url = new URL(request.url());
          if (requestCount > 250 || Date.now() > deadline || url.origin !== target.origin
            || !["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(request.method())) {
            blockedRequests++; await route.abort("blockedbyclient"); return;
          }
          try {
            const response = await route.fetch({ maxRedirects: 0, timeout });
            const location = response.headers().location;
            if (location && new URL(location, url).origin !== target.origin) {
              blockedRequests++; observed.add("An external redirect was blocked."); await route.abort("blockedbyclient"); return;
            }
            await route.fulfill({ response });
          } catch { await route.abort("failed").catch(() => {}); }
        });
        const page = await context.newPage();
        page.on("popup", popup => { void popup.close(); observed.add("A popup was blocked; the workflow requires review."); });
        page.on("dialog", dialog => { void dialog.dismiss(); });
        // Error text can contain user data, so record a fingerprint rather than raw messages.
        page.on("pageerror", error => { observed.add(`Uncaught browser error fingerprint: ${createHash("sha256").update(error.message).digest("hex").slice(0, 12)}`); });
        page.on("response", response => {
          if (response.status() >= 400) observed.add(`HTTP ${response.status()} on local test request (${response.request().resourceType()}).`);
        });
        let stepIndex = 0;
        for (const step of journey.steps) {
          stepIndex++;
          if (Date.now() > deadline || requestCount > 250) { observed.add("Run time or request budget was reached."); failed = true; break; }
          if ("stage" in step) stage = step.stage;
          try {
            if (step.action === "navigate") {
              const destination = new URL(step.path, target);
              if (destination.origin !== target.origin || destination.username || destination.password) throw new Error("Navigation escaped the selected local origin.");
              const response = await page.goto(destination.href, { waitUntil: "domcontentloaded", timeout });
              if (response && response.status() >= 400) throw new Error("Navigation returned an HTTP error.");
            } else if (step.action === "click") await page.locator(step.selector).click({ timeout });
            else if (step.action === "fill") await page.locator(step.selector).fill(step.value, { timeout });
            else if (step.action === "expectVisible") await page.locator(step.selector).waitFor({ state: "visible", timeout });
            else {
              const locator = page.locator(step.selector);
              await locator.filter({ hasText: step.text }).waitFor({ state: "visible", timeout });
              if (!(await locator.innerText({ timeout })).includes(step.text)) throw new Error("Expected text is missing.");
              completed.add(step.stage);
            }
            observed.add(`Step ${stepIndex}: ${step.action} passed.`);
          } catch {
            observed.add(`Step ${stepIndex}: ${step.action} failed in stage ${stage}. Expected interaction or assertion did not complete.`);
            failed = true;
            if (options.recordScreenshot) {
              const filename = `${journey.id}-failure.png`;
              try { await options.recordScreenshot(filename, await page.screenshot({ fullPage: false, timeout })); observed.add(`Local screenshot: ${filename}`); }
              catch { observed.add("Failure screenshot could not be captured."); }
            }
            break;
          }
        }
        if ([...observed].some(item => item.startsWith("Uncaught browser error") || item.startsWith("HTTP ") || item.startsWith("A popup"))) failed = true;
        findings.push({ journeyId: journey.id, persona: journey.persona, status: failed ? "failed" : "passed", failedStage: failed ? stage : null,
          completedStages: [...completed], evidence: [...observed].slice(0, 100), hypothesis: journey.hypothesis });
      } finally { await context.close(); }
      if (Date.now() > deadline || requestCount > 250) break;
    }
    if (findings.length !== config.journeys.length) throw new Error("The browser run exceeded its global budget; partial results are not accepted.");
    return { schemaVersion: 1, modelRevision, configurationRevision: revision(config), baseUrl: target.origin,
      recordedAt: new Date().toISOString(), findings, requestCount, blockedRequests,
      limitations: ["Personas and their motivations are synthetic test definitions, not interviewed people.",
        "Assertions and browser/HTTP failures are observed results for these exact local paths.",
        "A passing scripted path does not establish usability, conversion probability, security, or infrastructure capacity.",
        "Only the selected local HTTP origin is allowed. Service workers, downloads, popups, and WebSockets are blocked.",
        "New isolated browser contexts have no inherited sign-ins. Permission-denial behavior is used; real-device permission prompts are not emulated.",
        "Use a synthetic test database. The local app may perform server-side actions; browser routing is not an OS or backend network sandbox."] };
  } finally { await browser.close(); }
}

export function defaultJourneys(): JourneyConfig {
  return journeysSchema.parse({ schemaVersion: 1, baseUrl: "http://127.0.0.1:4179/", environment: "local-test", journeys: [{
    id: "first-visit", persona: "First-time visitor (synthetic)", goal: "Reach and understand the main product page",
    hypothesis: "A first-time visitor can see the promised feature. Replace this hypothesis and assertions for your app.",
    capabilityIds: [], viewport: { width: 390, height: 844 }, denyPermissions: true,
    steps: [{ action: "navigate", path: "/", stage: "landing" }, { action: "expectVisible", selector: "h1" }],
  }] });
}
