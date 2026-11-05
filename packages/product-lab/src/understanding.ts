import { basename, resolve } from "node:path";
import type { Inspection } from "@hypothra/project-scanner";
import { projectModelSchema } from "./schema.js";
import type { ProjectModel } from "./schema.js";

export function proposeUnderstanding(inspection: Inspection, root: string, description?: string): ProjectModel {
  const routes = inspection.evidence.filter(item => item.kind === "route").slice(0, 100);
  const screens = inspection.evidence.filter(item => item.kind === "screen").slice(0, 60);
  const data = inspection.evidence.filter(item => item.kind === "data-model").slice(0, 30);
  const interactions = inspection.evidence.filter(item => item.kind === "interaction" || item.kind === "behavior").slice(0, 40);
  const capabilities = [...routes, ...screens, ...data, ...interactions].slice(0, 150).map((item, index) => ({
    id: `cap-${index + 1}`, title: item.title,
    description: `Code declaration found at ${item.path}:${item.line}. Its runtime behavior and business purpose require review.`,
    status: "observed" as const, evidenceIds: [item.id],
  }));
  return projectModelSchema.parse({
    schemaVersion: 1,
    project: { name: basename(resolve(root)), description: description || "Project purpose has not been confirmed. Add your product description before approval.",
      audience: ["Not specified — replace with your target users"], valueProposition: "Not confirmed — describe the problem this product solves",
      monetization: "Not confirmed — describe pricing or mark the product as free", descriptionBasis: description ? "user" : "unreviewed" },
    stack: inspection.technologies.map(item => ({ ...item, provenance: "observed" })), capabilities,
    userJourneys: screens.slice(0, 5).map((item, index) => ({ id: `journey-${index + 1}`, name: `Explore ${item.title}`,
      goal: "Confirm the actual user goal and success criteria", steps: ["Open the application", `Find ${item.title}`, "Confirm the intended result"], evidenceIds: [item.id] })),
    unknowns: ["Target audience and value proposition need user confirmation", "Authentication, onboarding, and payment flows need runtime verification",
      "Infrastructure capacity cannot be inferred from dependency declarations", "Advertising conversion rates need assumptions or measured data"],
    analysis: { engine: "structural-v1", sourceDigest: inspection.sourceDigest, filesScanned: inspection.filesScanned,
      incomplete: inspection.truncated, notes: inspection.warnings },
  });
}

export function validateUnderstanding(input: unknown, inspection: Inspection): ProjectModel {
  const model = projectModelSchema.parse(input);
  if (model.analysis.sourceDigest !== inspection.sourceDigest || model.analysis.filesScanned !== inspection.filesScanned
    || model.analysis.incomplete !== inspection.truncated) throw new Error("Analysis metadata must match the recorded scan. Re-initialize after source changes.");
  const valid = new Set(inspection.evidence.map(item => item.id));
  for (const claim of [...model.stack, ...model.capabilities, ...model.userJourneys]) {
    if (claim.evidenceIds.some(id => !valid.has(id))) throw new Error("Model refers to nonexistent evidence.");
    if (("provenance" in claim && claim.provenance === "observed" || "status" in claim && claim.status === "observed") && claim.evidenceIds.length === 0) {
      throw new Error("Observed claims need source evidence. Use hypothesis or user-confirmed for manual additions.");
    }
  }
  for (const list of [model.capabilities, model.userJourneys]) if (new Set(list.map(item => item.id)).size !== list.length) throw new Error("Model IDs must be unique.");
  return model;
}

export function summarizeUnderstanding(model: ProjectModel, inspection: Inspection, hash: string): string {
  const evidence = new Map(inspection.evidence.map(item => [item.id, item]));
  const lines = ["# Project understanding — review required", "", `Revision: ${hash}`, "", `Project: ${model.project.name}`,
    `Description (${model.project.descriptionBasis}): ${model.project.description}`, `Audience: ${model.project.audience.join(", ")}`,
    `Value proposition: ${model.project.valueProposition}`, `Monetization: ${model.project.monetization}`, "", "## Technology stack"];
  for (const item of model.stack) lines.push(`- ${item.name} (${item.category}; ${item.provenance}) — ${item.evidenceIds.map(id => { const found = evidence.get(id); return found ? `${found.path}:${found.line}` : id; }).join(", ")}`);
  lines.push("", "## Capabilities and code evidence");
  for (const item of model.capabilities) lines.push(`- [${item.id}; ${item.status}] ${item.title}: ${item.description}`);
  lines.push("", "## User journeys");
  for (const item of model.userJourneys) lines.push(`- ${item.name}: ${item.steps.join(" → ")}`);
  lines.push("", "## Unknowns", ...model.unknowns.map(item => `- ${item}`), "", "## Scan limitations", ...model.analysis.notes.map(item => `- ${item}`),
    "", "Edit .hypothra/project.json to correct this draft, run hypothra review, then approve the exact displayed revision.");
  return lines.join("\n") + "\n";
}
