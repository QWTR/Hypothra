/** A bounded, deterministic expectation model. No I/O, random numbers, or AI. */
export interface GrowthScenario {
  months: number;
  initialUsers: number;
  monthlyMarketingBudget: number;
  acquisitionCost: number;
  monthlyChurnRate: number;
  monthlyOrganicGrowthRate: number;
  paidConversionRate: number;
  monthlyPrice: number;
  fixedMonthlyCost: number;
  costPerActiveUser: number;
  currency: string;
}

export const numericLimits = {
  months: [1, 120],
  initialUsers: [0, 1e9],
  monthlyMarketingBudget: [0, 1e9],
  acquisitionCost: [0.01, 1e9],
  monthlyChurnRate: [0, 1],
  monthlyOrganicGrowthRate: [0, 1],
  paidConversionRate: [0, 1],
  monthlyPrice: [0, 1e9],
  fixedMonthlyCost: [0, 1e9],
  costPerActiveUser: [0, 1e9],
} as const;

export const exampleScenario: Readonly<GrowthScenario> = Object.freeze({
  months: 6,
  initialUsers: 1000,
  monthlyMarketingBudget: 500,
  acquisitionCost: 5,
  monthlyChurnRate: 0.05,
  monthlyOrganicGrowthRate: 0.02,
  paidConversionRate: 0.1,
  monthlyPrice: 10,
  fixedMonthlyCost: 200,
  costPerActiveUser: 0.1,
  currency: "USD",
});

export function validateScenario(input: unknown): GrowthScenario {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Scenario must be a JSON object.");
  }
  const record = input as Record<string, unknown>;
  const allowed = new Set([...Object.keys(numericLimits), "currency"]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new Error(`Unknown scenario field: ${key}`);
  }
  for (const [key, [min, max]] of Object.entries(numericLimits)) {
    const value = record[key];
    if (!Object.hasOwn(record, key) || typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${key} must be a finite number between ${min} and ${max}.`);
    }
  }
  if (!Number.isInteger(record.months)) throw new Error("months must be an integer.");
  if (!Object.hasOwn(record, "currency") || typeof record.currency !== "string" || !/^[A-Z]{3}$/.test(record.currency)) {
    throw new Error("currency must be a three-letter uppercase currency label (no currency conversion).");
  }
  return { ...record } as unknown as GrowthScenario;
}

export interface MonthlyResult {
  month: number;
  activeUsers: number;
  payingUsers: number;
  revenue: number;
  costs: number;
  profit: number;
  cumulativeProfit: number;
}

const round = (value: number, digits = 2): number => Number(value.toFixed(digits));

export function simulateGrowth(input: unknown) {
  const scenario = validateScenario(input);
  let activeUsers = scenario.initialUsers;
  let totalRevenue = 0;
  let totalCosts = 0;
  const timeline: MonthlyResult[] = [];
  for (let month = 1; month <= scenario.months; month++) {
    const retainedUsers = activeUsers * (1 - scenario.monthlyChurnRate);
    activeUsers = retainedUsers * (1 + scenario.monthlyOrganicGrowthRate)
      + scenario.monthlyMarketingBudget / scenario.acquisitionCost;
    const payingUsers = activeUsers * scenario.paidConversionRate;
    const revenue = payingUsers * scenario.monthlyPrice;
    const costs = scenario.monthlyMarketingBudget + scenario.fixedMonthlyCost
      + activeUsers * scenario.costPerActiveUser;
    totalRevenue += revenue;
    totalCosts += costs;
    timeline.push({
      month, activeUsers: round(activeUsers, 6), payingUsers: round(payingUsers, 6),
      revenue: round(revenue), costs: round(costs), profit: round(revenue - costs),
      cumulativeProfit: round(totalRevenue - totalCosts),
    });
  }
  return {
    model: "deterministic-growth-v1" as const,
    scenario,
    disclaimer: "Scenario arithmetic, not a forecast or a measured load test. All inputs are user assumptions.",
    timeline,
    summary: { totalRevenue: round(totalRevenue), totalCosts: round(totalCosts), totalProfit: round(totalRevenue - totalCosts) },
  };
}
