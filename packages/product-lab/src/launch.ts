import { benchmarkSchema, benchmarksSchema, launchPlanSchema, projectModelSchema, runtimeReportSchema } from "./schema.js";
import type { Benchmark, LaunchPlan, ProjectModel, JourneyStage } from "./schema.js";

export interface RuntimeFinding {
  journeyId: string;
  persona: string;
  status: "passed" | "failed";
  failedStage: JourneyStage | null;
  completedStages: JourneyStage[];
  evidence: string[];
  hypothesis: string;
}
export interface RuntimeReport {
  schemaVersion: 1;
  modelRevision: string;
  configurationRevision: string;
  baseUrl: string;
  recordedAt: string;
  findings: RuntimeFinding[];
  requestCount: number;
  blockedRequests: number;
  limitations: string[];
}

const rounded = (value: number, digits = 2) => Number(value.toFixed(digits));
const daysBetween = (a: string, b: string) => Math.floor((Date.parse(b) - Date.parse(a)) / 86_400_000);

export function validateBenchmarks(input: unknown, asOf: string): Benchmark[] {
  const timestamp = Date.parse(asOf);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== asOf) throw new Error("asOf must be a valid calendar date.");
  const data = benchmarksSchema.parse(input);
  if (new Set(data.map(item => item.id)).size !== data.length) throw new Error("Benchmark IDs must be unique.");
  for (const item of data) {
    if (item.source.collectedAt > asOf) throw new Error("Benchmark collection date cannot be in the future.");
    if (item.source.type !== "manual-assumption" && !item.source.url) throw new Error("Measured or published benchmark sources need a provenance URL.");
    if (item.source.url) {
      const url = new URL(item.source.url);
      if (url.protocol !== "https:" || url.username || url.password || [...url.searchParams.keys()].some(key => /token|secret|password|api.?key|auth/i.test(key))) throw new Error("Source URL must be HTTPS without credentials or sensitive query parameters.");
    }
  }
  return data;
}

export function simulateLaunch(modelInput: unknown, planInput: unknown, benchmarksInput: unknown, options: {
  asOf: string; modelRevision: string; runtime?: RuntimeReport;
}) {
  const model: ProjectModel = projectModelSchema.parse(modelInput);
  const plan: LaunchPlan = launchPlanSchema.parse(planInput);
  const benchmarks = validateBenchmarks(benchmarksInput, options.asOf);
  if (options.runtime) runtimeReportSchema.parse(options.runtime);
  const capabilities = new Set(model.capabilities.map(item => item.id));
  const selected = new Map(benchmarks.map(item => [item.id, item]));
  const channelBudget = plan.channels.reduce((sum, channel) => sum + channel.budget, 0);
  if (channelBudget + plan.fixedCosts > plan.totalBudget + 1e-6) throw new Error("Channel budgets plus fixed costs exceed the total budget.");
  if (new Set(plan.channels.map(channel => channel.id)).size !== plan.channels.length) throw new Error("Channel IDs must be unique.");
  if (options.runtime && options.runtime.modelRevision !== options.modelRevision) throw new Error("Runtime evidence belongs to a different approved model.");
  const warnings = new Set<string>();
  const channels = plan.channels.map(channel => {
    const price = selected.get(channel.benchmarkId);
    if (!price) throw new Error(`Missing benchmark: ${channel.benchmarkId}`);
    if (price.platform !== channel.platform || price.country !== plan.country && price.country !== "ZZ" || price.currency !== plan.currency || price.objective !== channel.objective && price.objective !== "mixed") {
      throw new Error(`Benchmark does not match platform, country, currency, or objective for ${channel.id}.`);
    }
    if (price.country === "ZZ") warnings.add(`${price.id} is a global benchmark, not a price measured for ${plan.country}. Local results may differ.`);
    if (price.objective === "mixed") warnings.add(`${price.id} combines campaign objectives; it is a planning reference for ${channel.objective}, not an exact match.`);
    if (channel.creative.capabilityIds.some(id => !capabilities.has(id))) throw new Error(`Creative refers to an unknown capability in ${channel.id}.`);
    if (channel.creative.capabilityIds.length === 0) warnings.add(`Creative promise for ${channel.id} has no mapped product capability.`);
    const ageDays = daysBetween(price.source.observedTo, options.asOf);
    if (price.source.type !== "manual-assumption" && ageDays > plan.maxBenchmarkAgeDays) throw new Error(`Benchmark ${price.id} is stale (${ageDays} days). Refresh it or explicitly change maxBenchmarkAgeDays.`);
    if (price.source.type === "manual-assumption") warnings.add(`${price.id} is a synthetic price assumption, not current platform pricing.`);
    else warnings.add(`${price.id} describes a particular source and audience; it is not a guaranteed future auction price.`);
    if (price.audience !== channel.audience) warnings.add(`Audience for ${price.id} differs from ${channel.id}; transferability needs review.`);
    const runtime = channel.journeyId ? options.runtime?.findings.find(item => item.journeyId === channel.journeyId) : undefined;
    if (channel.journeyId && options.runtime && !runtime) throw new Error(`No runtime finding for mapped journey ${channel.journeyId}.`);
    const variants = (["conservative", "central", "optimistic"] as const).map(variant => {
      const key = variant === "conservative" ? "low" : variant === "optimistic" ? "high" : "typical";
      const costKey = variant === "conservative" ? "high" : variant === "optimistic" ? "low" : "typical";
      const unitPrice = price.price[costKey];
      const clicks = price.metric === "cpc" ? channel.budget / unitPrice : channel.budget / unitPrice * 1000 * channel.ctr[key];
      const impressions = price.metric === "cpm" ? channel.budget / unitPrice * 1000 : channel.ctr[key] > 0 ? clicks / channel.ctr[key] : null;
      const signups = clicks * channel.signupRate[key];
      const activated = signups * channel.activationRate[key];
      const paying = activated * channel.paidRate[key];
      const revenue = paying * plan.monthlyPrice;
      const variableCosts = activated * plan.costPerActivatedUser;
      const projected = { impressions: impressions === null ? null : rounded(impressions, 4), clicks: rounded(clicks, 4), signups: rounded(signups, 4),
        activated: rounded(activated, 4), paying: rounded(paying, 4), firstMonthRevenue: rounded(revenue), variableCosts: rounded(variableCosts),
        contribution: rounded(revenue - channel.budget - variableCosts) };
      let conditional = null;
      if (runtime?.status === "failed") {
        const stage = runtime.failedStage ?? "landing";
        const blockedSignups = ["landing", "signup"].includes(stage) ? 0 : signups;
        const blockedActivated = stage === "payment" ? activated : 0;
        const adjustedCosts = blockedActivated * plan.costPerActivatedUser;
        conditional = { assumption: "Every visitor follows the same failing tested journey. This is an impact scenario, not a measured conversion rate.",
          blockedAt: stage, signups: rounded(blockedSignups, 4), activated: rounded(blockedActivated, 4), paying: 0,
          firstMonthRevenue: 0, contribution: rounded(-channel.budget - adjustedCosts) };
      }
      return { variant, unitPrice, projected, conditionalOnTestedFailure: conditional };
    });
    return { id: channel.id, platform: channel.platform, budget: channel.budget, creative: channel.creative,
      benchmark: { ...benchmarkSchema.parse(price), ageDays, currentPriceClaim: false },
      runtimeEvidence: runtime ?? null, variants };
  });
  const totals = (["conservative", "central", "optimistic"] as const).map(variant => {
    const projections = channels.map(channel => channel.variants.find(item => item.variant === variant)!.projected);
    const sum = (key: "clicks" | "signups" | "activated" | "paying" | "firstMonthRevenue" | "variableCosts") => projections.reduce((total, item) => total + item[key], 0);
    const firstMonthRevenue = sum("firstMonthRevenue"), variableCosts = sum("variableCosts");
    return { variant, clicks: rounded(sum("clicks"), 4), signups: rounded(sum("signups"), 4), activated: rounded(sum("activated"), 4), paying: rounded(sum("paying"), 4),
      firstMonthRevenue: rounded(firstMonthRevenue), costs: rounded(channelBudget + plan.fixedCosts + variableCosts),
      firstMonthProfit: rounded(firstMonthRevenue - channelBudget - plan.fixedCosts - variableCosts),
      unusedBudgetBeforeVariableCosts: rounded(plan.totalBudget - channelBudget - plan.fixedCosts),
      exceedsTotalBudgetIncludingVariableCosts: channelBudget + plan.fixedCosts + variableCosts > plan.totalBudget + 1e-6 };
  });
  if (totals.some(item => item.exceedsTotalBudgetIncludingVariableCosts)) warnings.add("Some variants exceed the total budget after variable service costs. Reserve more budget or reduce advertising spend.");
  return { schemaVersion: 1 as const, model: "launch-funnel-v1", asOf: options.asOf, modelRevision: options.modelRevision,
    project: model.project.name, plan, channels, totals, warnings: [...warnings],
    limitations: ["Scenario ranges are assumed combinations, not calibrated statistical confidence intervals.",
      "Creative text and personas do not prove real customer demand. Conversion rates are explicit assumptions.",
      "Browser test results are reproducible path observations, not population conversion measurements.",
      "periodDays defines the acquisition window; revenue is a full first subscription month for acquired payers, not cash recognized within that window.",
      "No ads are purchased or published. No taxes, refunds, repeat subscriptions, retention, organic traffic, or infrastructure capacity are modeled."] };
}
export type LaunchReport = ReturnType<typeof simulateLaunch>;

export function defaultLaunch(model: ProjectModel): LaunchPlan {
  return launchPlanSchema.parse({ schemaVersion: 1, name: "First product launch", description: "Replace these synthetic assumptions with your actual launch idea and evidence.",
    currency: "PLN", country: "PL", totalBudget: 3000, fixedCosts: 500, periodDays: 30, monthlyPrice: 19,
    costPerActivatedUser: 0.5, maxBenchmarkAgeDays: 30,
    channels: [{ id: "tiktok-launch", platform: "tiktok", objective: "traffic", budget: 2000, benchmarkId: "example-tiktok",
      audience: "Example audience — replace before use", creative: { message: model.project.description,
        promise: model.project.valueProposition, callToAction: "Try the product", capabilityIds: model.capabilities.slice(0, 1).map(item => item.id) },
      ctr: { low: 0.005, typical: 0.01, high: 0.02 }, signupRate: { low: 0.02, typical: 0.05, high: 0.1 },
      activationRate: { low: 0.3, typical: 0.5, high: 0.7 }, paidRate: { low: 0.02, typical: 0.05, high: 0.1 } }],
  });
}

export function exampleBenchmarks(asOf: string): Benchmark[] {
  return benchmarksSchema.parse(["meta", "tiktok"].map(platform => ({ id: `example-${platform}`, platform,
    country: "PL", currency: "PLN", objective: "traffic", audience: "Example audience — replace before use", metric: "cpm",
    price: { low: 10, typical: 20, high: 40 }, source: { type: "manual-assumption", label: "Synthetic tutorial numbers; not sourced platform prices",
      observedFrom: asOf, observedTo: asOf, collectedAt: asOf } })));
}
