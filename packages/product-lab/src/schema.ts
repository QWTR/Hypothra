import { z } from "zod";

const text = z.string().trim().min(1).max(4000);
const label = z.string().trim().min(1).max(180);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const ids = z.array(id).max(100);
export const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const time = Date.parse(value); return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}, "Invalid calendar date");
const fraction = z.number().min(0).max(1);
const range = z.object({ low: z.number().min(0).max(1e9), typical: z.number().min(0).max(1e9), high: z.number().min(0).max(1e9) }).strict()
  .refine(value => value.low <= value.typical && value.typical <= value.high, "Range must satisfy low <= typical <= high");
const rateRange = z.object({ low: fraction, typical: fraction, high: fraction }).strict()
  .refine(value => value.low <= value.typical && value.typical <= value.high, "Rate range must be ordered");

export const projectModelSchema = z.object({
  schemaVersion: z.literal(1),
  project: z.object({ name: label, description: text, audience: z.array(label).max(30), valueProposition: text,
    monetization: text, descriptionBasis: z.enum(["user", "model-hypothesis", "unreviewed"]) }).strict(),
  stack: z.array(z.object({ name: label, category: label, provenance: z.enum(["observed", "user-corrected", "hypothesis"]), evidenceIds: ids }).strict()).max(200),
  capabilities: z.array(z.object({ id, title: label, description: text, status: z.enum(["observed", "inferred", "user-confirmed"]), evidenceIds: ids }).strict()).max(200),
  userJourneys: z.array(z.object({ id, name: label, goal: text, steps: z.array(label).min(1).max(30), evidenceIds: ids }).strict()).max(50),
  unknowns: z.array(text).max(100),
  analysis: z.object({ engine: z.enum(["structural-v1", "model-assisted-v1"]), sourceDigest: digestSchema,
    filesScanned: z.number().int().nonnegative(), incomplete: z.boolean(), notes: z.array(text).max(100) }).strict(),
}).strict();
export type ProjectModel = z.infer<typeof projectModelSchema>;

export const benchmarkSchema = z.object({
  id, platform: z.enum(["meta", "tiktok", "other"]), country: z.string().regex(/^[A-Z]{2}$/),
  currency: z.string().regex(/^[A-Z]{3}$/), objective: z.enum(["traffic", "conversions", "awareness"]),
  audience: label, metric: z.enum(["cpm", "cpc"]), price: range,
  source: z.object({ type: z.enum(["manual-assumption", "account-export", "account-api", "public-benchmark"]),
    label, url: z.string().url().max(2000).optional(), observedFrom: date, observedTo: date, collectedAt: date,
    sampleImpressions: z.number().int().min(1).max(1e15).optional() }).strict(),
}).strict().superRefine((value, context) => {
  if (value.price.low <= 0) context.addIssue({ code: "custom", message: "Advertising price must be positive" });
  if (value.source.observedFrom > value.source.observedTo || value.source.observedTo > value.source.collectedAt) {
    context.addIssue({ code: "custom", message: "Observation dates must be ordered and precede collection" });
  }
});
export const benchmarksSchema = z.array(benchmarkSchema).max(100);
export type Benchmark = z.infer<typeof benchmarkSchema>;

export const launchPlanSchema = z.object({
  schemaVersion: z.literal(1), name: label, description: text,
  currency: z.string().regex(/^[A-Z]{3}$/), country: z.string().regex(/^[A-Z]{2}$/),
  totalBudget: z.number().min(0).max(1e9), fixedCosts: z.number().min(0).max(1e9),
  periodDays: z.number().int().min(1).max(365), monthlyPrice: z.number().min(0).max(1e6),
  costPerActivatedUser: z.number().min(0).max(1e6), maxBenchmarkAgeDays: z.number().int().min(0).max(365),
  channels: z.array(z.object({ id, platform: z.enum(["meta", "tiktok", "other"]), objective: z.enum(["traffic", "conversions", "awareness"]),
    budget: z.number().min(0).max(1e9), benchmarkId: id, audience: label,
    creative: z.object({ message: text, promise: text, callToAction: label, capabilityIds: ids }).strict(),
    ctr: rateRange, signupRate: rateRange, activationRate: rateRange, paidRate: rateRange,
    journeyId: id.optional(),
  }).strict()).min(1).max(20),
}).strict();
export type LaunchPlan = z.infer<typeof launchPlanSchema>;

const step = z.discriminatedUnion("action", [
  z.object({ action: z.literal("navigate"), path: z.string().startsWith("/").max(1000), stage: z.enum(["landing", "signup", "activation", "payment"]) }).strict(),
  z.object({ action: z.literal("click"), selector: label }).strict(),
  z.object({ action: z.literal("fill"), selector: label, value: z.string().max(500) }).strict(),
  z.object({ action: z.literal("expectVisible"), selector: label }).strict(),
  z.object({ action: z.literal("expectText"), selector: label, text: label, stage: z.enum(["landing", "signup", "activation", "payment"]) }).strict(),
]);
export const journeysSchema = z.object({
  schemaVersion: z.literal(1), baseUrl: z.string().url().max(1000), environment: z.literal("local-test"),
  journeys: z.array(z.object({ id, persona: label, goal: text,
    hypothesis: text, capabilityIds: ids,
    viewport: z.object({ width: z.number().int().min(320).max(1920), height: z.number().int().min(480).max(1440) }).strict(),
    denyPermissions: z.boolean(), steps: z.array(step).min(1).max(40),
  }).strict()).min(1).max(10),
}).strict().refine(value => new Set(value.journeys.map(item => item.id)).size === value.journeys.length, "Journey IDs must be unique");
export type JourneyConfig = z.infer<typeof journeysSchema>;
export type JourneyStage = "landing" | "signup" | "activation" | "payment";

export const runtimeReportSchema = z.object({
  schemaVersion: z.literal(1), modelRevision: digestSchema, configurationRevision: digestSchema,
  baseUrl: z.string().url().regex(/^http:\/\/(?:127\.0\.0\.1|\[::1\]):\d+\/?$/), recordedAt: z.string().datetime(),
  findings: z.array(z.object({ journeyId: id, persona: label, status: z.enum(["passed", "failed"]),
    failedStage: z.enum(["landing", "signup", "activation", "payment"]).nullable(),
    completedStages: z.array(z.enum(["landing", "signup", "activation", "payment"])).max(4),
    evidence: z.array(z.string().max(2000)).max(100), hypothesis: text }).strict()).min(1).max(10),
  requestCount: z.number().int().nonnegative(), blockedRequests: z.number().int().nonnegative(), limitations: z.array(text).max(30),
}).strict().refine(value => new Set(value.findings.map(item => item.journeyId)).size === value.findings.length, "Runtime journey IDs must be unique");
