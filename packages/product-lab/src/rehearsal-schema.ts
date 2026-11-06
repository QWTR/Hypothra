import { z } from "zod";
import { benchmarkSchema, digestSchema } from "./schema.js";

const text = z.string().min(1).max(1600), short = z.string().min(1).max(180);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const rehearsalInputSchema = z.object({
  idea: z.string().max(8000).default(""), constraints: z.string().max(4000).default(""),
  currency: z.enum(["PLN", "USD", "EUR", "GBP"]).default("PLN"),
  viewers: z.number().int().min(1).max(100_000).default(20), batchSize: z.number().int().min(1).max(20).default(10),
  maxAICalls: z.number().int().min(2).max(200_000).default(100),
}).strict();
export const rehearsalPlanSchema = z.object({
  name: short, productSummary: text, audienceRationale: text,
  segments: z.array(z.object({ id, label: short, context: text, motivation: text, skepticism: text,
    share: z.number().positive().max(1) }).strict()).min(2).max(12),
  creative: z.object({ hook: text, script: text, callToAction: short, promise: text,
    format: z.enum(["script-only", "ad-description-only"]), limitations: z.array(text).min(1).max(12) }).strict(),
  costs: z.array(z.object({ item: short, amount: z.number().min(0).max(1e8), rationale: text,
    basis: z.literal("ai-estimate"), evidenceIds: z.array(id).max(30) }).strict()).max(12),
  proposedBudget: z.number().min(0).max(1e9), budgetRationale: text,
  channels: z.array(z.object({ platform: z.enum(["meta", "tiktok", "other"]), share: z.number().positive().max(1),
    benchmarkId: id.nullable(), rationale: text }).strict()).min(1).max(4),
  uncertainties: z.array(text).min(1).max(20),
}).strict();
export type RehearsalPlan = z.infer<typeof rehearsalPlanSchema>;

export const viewerSchema = z.object({ id, segmentId: id,
  profile: z.object({ context: short, need: short, objection: short, attention: z.enum(["low", "medium", "high"]) }).strict(),
  watch: z.boolean(), click: z.boolean(), install: z.boolean(),
  reasonCode: z.enum(["relevant", "irrelevant", "unclear", "unconvincing", "trust", "price", "timing", "already-served"]),
  reason: text, expectation: text,
}).strict();
export type SyntheticViewer = z.infer<typeof viewerSchema>;
export const viewerBatchSchema = z.object({ viewers: z.array(viewerSchema).min(1).max(20) }).strict();

export const browserDecisionSchema = z.object({
  action: z.enum(["click", "fill", "inspect", "finish"]), selector: z.string().max(220),
  inputKind: z.enum(["email", "name", "password", "search", "none"]),
  reason: text, verdict: z.enum(["continue", "satisfied", "dropout"]),
  feedback: text, evidenceIds: z.array(id).max(12),
}).strict();
export const experienceSchema = z.object({ viewerId: id, outcome: z.enum(["satisfied", "dropout", "blocked", "step-limit"]),
  feedback: text, aiEvidenceIds: z.array(id).max(12),
  observations: z.array(z.object({ id, pagePath: short, visibleText: z.string().max(6000),
    controls: z.array(z.object({ selector: z.string().max(220), label: z.string().max(180), tag: short, type: z.string().max(80) }).strict()).max(80) }).strict()).max(12),
  actions: z.array(z.object({ action: short, selector: z.string().max(220), reason: text, result: z.enum(["performed", "blocked", "failed"]) }).strict()).max(12),
  runtimeErrors: z.array(short).max(30), blockedRequests: z.number().int().min(0),
}).strict();
export type Experience = z.infer<typeof experienceSchema>;
export const optimizationSchema = z.object({ summary: text,
  recommendations: z.array(z.object({ priority: z.enum(["high", "medium", "low"]),
    area: z.enum(["creative", "audience", "product", "onboarding", "reliability"]), change: text,
    rationale: text, evidenceIds: z.array(z.string().min(1).max(180)).min(1).max(12),
    basis: z.enum(["synthetic-opinion", "observed-browser-result"]) }).strict()).max(15),
}).strict();

export const rehearsalStateSchema = z.object({
  schemaVersion: z.literal(1), id: z.string().uuid(), modelRevision: digestSchema, sourceDigest: digestSchema,
  createdAt: z.string(), updatedAt: z.string(),
  status: z.enum(["planning", "ready", "running", "paused", "failed", "completed"]),
  phase: z.enum(["planning", "audience", "experience", "optimization", "complete"]), message: z.string(),
  input: rehearsalInputSchema, plan: rehearsalPlanSchema.nullable(),
  market: z.object({ benchmarks: z.array(benchmarkSchema).max(20), checkedAt: z.string(), error: z.string().nullable() }).strict(),
  audience: z.object({ evaluated: z.number().int(), watched: z.number().int(), clicked: z.number().int(), installed: z.number().int(),
    batches: z.number().int(), reasons: z.record(z.string(), z.number().int()), samples: z.array(viewerSchema).max(24) }).strict(),
  experience: z.object({ baseUrl: z.string().nullable(), consent: z.boolean(), target: z.number().int().min(0).max(5000),
    tested: z.number().int(), satisfied: z.number().int(), dropout: z.number().int(), blocked: z.number().int(), stepLimit: z.number().int(),
    issues: z.record(z.string(), z.object({ count: z.number().int(), exampleViewer: id }).strict()).default({}),
    samples: z.array(experienceSchema).max(8) }).strict(),
  calls: z.object({ attempted: z.number().int(), completed: z.number().int(), inputTokens: z.number().int(), outputTokens: z.number().int(),
    usageUnreported: z.number().int(), provider: z.string().nullable(), model: z.string().nullable() }).strict(),
  optimization: optimizationSchema.nullable(), limitations: z.array(text),
  planningStep: z.enum(["research", "compose", "ready"]).default("research"),
  runStartedAt: z.string().nullable().default(null),
  activity: z.array(z.object({ at: z.string(), label: z.string().max(400), kind: z.enum(["research", "thinking", "browser", "saved", "ready"]) }).strict()).max(8).default([]),
}).strict();
export type RehearsalState = z.infer<typeof rehearsalStateSchema>;
