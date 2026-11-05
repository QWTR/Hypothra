import test from "node:test";
import assert from "node:assert/strict";
import { exampleScenario, numericLimits, simulateGrowth } from "@hypothra/simulation-core";

test("two-month hand-calculated reference case", () => {
  const result = simulateGrowth({ ...exampleScenario, months: 2, initialUsers: 100,
    monthlyMarketingBudget: 200, acquisitionCost: 10, monthlyChurnRate: 0.1,
    monthlyOrganicGrowthRate: 0, paidConversionRate: 0.2, monthlyPrice: 5,
    fixedMonthlyCost: 20, costPerActiveUser: 1 });
  assert.deepEqual(result.timeline, [
    { month: 1, activeUsers: 110, payingUsers: 22, revenue: 110, costs: 330, profit: -220, cumulativeProfit: -220 },
    { month: 2, activeUsers: 119, payingUsers: 23.8, revenue: 119, costs: 339, profit: -220, cumulativeProfit: -440 },
  ]);
  assert.deepEqual(result.summary, { totalRevenue: 229, totalCosts: 669, totalProfit: -440 });
});

test("example first month includes churn before organic growth and acquisition", () => {
  assert.deepEqual(simulateGrowth(exampleScenario).timeline[0], {
    month: 1, activeUsers: 1069, payingUsers: 106.9, revenue: 1069, costs: 806.9, profit: 262.1, cumulativeProfit: 262.1,
  });
});

test("repeated runs are byte-identical and do not mutate input", () => {
  const input = Object.freeze({ ...exampleScenario });
  const before = JSON.stringify(input);
  const first = simulateGrowth(input);
  for (let i = 0; i < 20; i++) assert.equal(JSON.stringify(simulateGrowth(input)), JSON.stringify(first));
  assert.equal(JSON.stringify(input), before);
  first.scenario.initialUsers = 0;
  assert.equal(input.initialUsers, 1000);
});

test("zero population without acquisition remains zero", () => {
  const result = simulateGrowth({ ...exampleScenario, initialUsers: 0, monthlyMarketingBudget: 0, fixedMonthlyCost: 0 });
  for (const row of result.timeline) {
    assert.equal(row.activeUsers, 0);
    assert.equal(row.profit, 0);
  }
});

test("100% churn removes prior users before acquisition", () => {
  const result = simulateGrowth({ ...exampleScenario, monthlyChurnRate: 1 });
  assert.ok(result.timeline.every(row => row.activeUsers === 100));
});

test("extreme valid inputs remain finite and produce at most 120 months", () => {
  const scenario = { ...exampleScenario };
  for (const [key, [, max]] of Object.entries(numericLimits)) scenario[key] = max;
  scenario.monthlyChurnRate = 0;
  scenario.acquisitionCost = 0.01;
  const result = simulateGrowth(scenario);
  assert.equal(result.timeline.length, 120);
  for (const row of result.timeline) assert.ok(Object.values(row).every(Number.isFinite));
});

for (const [label, change] of [
  ["zero duration", { months: 0 }], ["fractional duration", { months: 1.5 }],
  ["excess duration", { months: 121 }], ["zero CAC", { acquisitionCost: 0 }],
  ["negative budget", { monthlyMarketingBudget: -1 }], ["excess churn", { monthlyChurnRate: 1.01 }],
  ["negative conversion", { paidConversionRate: -0.1 }], ["infinity", { initialUsers: Infinity }],
  ["NaN", { monthlyPrice: NaN }], ["string number", { months: "6" }],
  ["unknown field", { guessedCapacity: 9999 }], ["invalid currency", { currency: "usd" }],
]) test(`rejects ${label}`, () => assert.throws(() => simulateGrowth({ ...exampleScenario, ...change })));

test("rejects missing fields and non-object input", () => {
  const { months, ...partial } = exampleScenario;
  assert.throws(() => simulateGrowth(partial));
  for (const value of [null, [], 0, "scenario"]) assert.throws(() => simulateGrowth(value));
});
