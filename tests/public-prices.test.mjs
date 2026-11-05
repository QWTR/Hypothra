import test from "node:test";
import assert from "node:assert/strict";
import { findPublicPrices, parsePublicPrices, validateBenchmarks } from "@hypothra/product-lab";

const table = (platform, values) => `<table><caption>${platform} Ads benchmarks, October 2026: 25th percentile, median and 75th percentile per metric</caption><tbody><tr><th>CPMCost per 1,000 impressions</th>${values.map(value => `<td>$${value}</td>`).join("")}</tr><tr><th>CPCCost per click</th><td>$0.10</td><td>$0.20</td><td>$0.40</td></tr></tbody></table>`;
const page = `<html><body><p>Amounts in USD</p>${table("Meta", [5, 10, 20])}${table("TikTok", [1, 2, 4])}</body></html>`;

test("public publisher data preserves the actual period, global scope, platform, and price ranges", () => {
  const result = parsePublicPrices(page, "2026-11-05");
  assert.equal(result.length, 4);
  assert.deepEqual(result.find(item => item.platform === "meta" && item.metric === "cpm").price, { low: 5, typical: 10, high: 20 });
  assert.deepEqual(result.find(item => item.platform === "tiktok" && item.metric === "cpm").price, { low: 1, typical: 2, high: 4 });
  assert.ok(result.every(item => item.country === "ZZ" && item.objective === "mixed" && item.source.type === "public-benchmark"));
  assert.equal(result[0].source.observedTo, "2026-10-31");
  assert.doesNotThrow(() => validateBenchmarks(result, "2026-11-05"));
});

test("public prices fail closed when markup, currency, or source period cannot be verified", () => {
  assert.throws(() => parsePublicPrices(page.replaceAll("TikTok", "Unknown"), "2026-11-05"));
  assert.throws(() => parsePublicPrices(page.replaceAll("Amounts in USD", "Amounts in EUR"), "2026-11-05"));
  assert.throws(() => parsePublicPrices(page, "2026-10-01"), /future/);
  assert.throws(() => parsePublicPrices(page.replace("$10", "Unavailable"), "2026-11-05"));
});

test("public lookup uses no advertising credential and converts USD using a dated public reference rate", async () => {
  const calls = [];
  const result = await findPublicPrices("PLN", { asOf: "2026-11-05", fetcher: async (url, options) => {
    calls.push(url);
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.redirect, "error");
    if (url === "https://adkit.so/benchmarks") return new Response(page);
    assert.equal(url, "https://api.nbp.pl/api/exchangerates/rates/a/usd/?format=json");
    return Response.json({ code: "USD", rates: [{ mid: 4, effectiveDate: "2026-11-05" }] });
  } });
  assert.equal(calls.length, 2);
  assert.deepEqual(result.benchmarks[0].price, { low: 20, typical: 40, high: 80 });
  assert.equal(result.benchmarks[0].currencyConversion.originalPrice.typical, 10);
  assert.equal(result.benchmarks[0].currencyConversion.rate, 4);
  assert.equal(result.benchmarks[0].country, "ZZ");
});

test("public lookup rejects stale exchange rates and unavailable sources instead of substituting invented prices", async () => {
  await assert.rejects(findPublicPrices("PLN", { asOf: "2026-11-05", fetcher: async url => url.includes("adkit") ? new Response(page) : Response.json({ code: "USD", rates: [{ mid: 4, effectiveDate: "2026-01-01" }] }) }), /recent/);
  await assert.rejects(findPublicPrices("USD", { fetcher: async () => new Response("Unavailable", { status: 503 }) }), /503/);
});
