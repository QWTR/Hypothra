import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { numericLimits, simulateGrowth } from "@hypothra/simulation-core";

const bounded = (key: keyof typeof numericLimits) => {
  const [min, max] = numericLimits[key];
  return z.number().min(min).max(max);
};

export function createServer() {
  const server = new McpServer({ name: "hypothra", version: "0.1.0" });
  server.registerTool("simulate_growth", {
    description: "Calculate a bounded deterministic growth scenario from explicit user assumptions. This is not a prediction or a measured infrastructure test. Does not read files or use the network.",
    inputSchema: z.object({
      months: bounded("months").int(),
      initialUsers: bounded("initialUsers"),
      monthlyMarketingBudget: bounded("monthlyMarketingBudget"),
      acquisitionCost: bounded("acquisitionCost"),
      monthlyChurnRate: bounded("monthlyChurnRate"),
      monthlyOrganicGrowthRate: bounded("monthlyOrganicGrowthRate"),
      paidConversionRate: bounded("paidConversionRate"),
      monthlyPrice: bounded("monthlyPrice"),
      fixedMonthlyCost: bounded("fixedMonthlyCost"),
      costPerActiveUser: bounded("costPerActiveUser"),
      currency: z.string().regex(/^[A-Z]{3}$/),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (input) => {
    const result = simulateGrowth(input);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }], structuredContent: result };
  });
  return server;
}
