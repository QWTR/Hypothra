import test from "node:test";
import assert from "node:assert/strict";
import { aggregateCosts, importCostCsv, fetchAccountCosts, validateBenchmarks } from "@hypothra/product-lab";

const metadata = { id: "owned-history", platform: "meta", country: "PL", currency: "PLN", objective: "traffic", audience: "Drivers",
  sourceType: "account-export", sourceUrl: "https://example.com/account-export", collectedAt: "2026-11-05" };
const csv = "date,spend,impressions,currency,country,objective\n2026-11-03,100,10000,PLN,PL,traffic\n2026-11-04,60,2000,PLN,PL,traffic\n";

test("CSV importer calculates impression-weighted CPM and observed ranges", () => {
  const result = importCostCsv(csv, metadata);
  assert.equal(result.price.low, 10);
  assert.equal(result.price.high, 30);
  assert.equal(result.price.typical, 160 / 12000 * 1000);
  assert.equal(result.source.sampleImpressions, 12000);
  assert.equal(result.source.type, "account-export");
  assert.equal(result.source.observedFrom, "2026-11-03");
});

test("CSV importer rejects mixed currencies, dates, formula-like numbers, and malformed rows", () => {
  for (const value of [csv.replace("PLN", "USD"), csv.replace("2026-11-03", "2026-02-30"), csv.replace(",100,", ",=100,"),
    csv.replace("impressions", "impressions,impressions"), "date,spend\n2026-11-05,100\n"]) assert.throws(() => importCostCsv(value, metadata));
});

test("zero-data cost estimates fail instead of inventing prices", () => {
  assert.throws(() => aggregateCosts([], metadata), /observations/);
  assert.throws(() => aggregateCosts([{ date: "2026-11-04", spend: 0, impressions: 0 }], metadata), /No positive/);
});

test("price provenance rejects credentials, query strings, and future collection dates", () => {
  const value = importCostCsv(csv, metadata);
  assert.throws(() => validateBenchmarks([{ ...value, source: { ...value.source, url: "https://user:secret@example.com/" } }], "2026-11-05"), /credentials/);
  assert.throws(() => validateBenchmarks([{ ...value, source: { ...value.source, url: "https://example.com/?token=private" } }], "2026-11-05"), /query/);
  assert.throws(() => validateBenchmarks([value], "2026-11-01"), /future/);
});

const query = { platform: "meta", accountId: "123456", country: "PL", currency: "PLN", objective: "traffic", audience: "Drivers",
  since: "2026-11-03", until: "2026-11-04", collectedAt: "2026-11-05" };

test("Meta adapter performs a bounded read-only request and keeps tokens out of results", async () => {
  let calls = 0;
  const token = "private-token-sentinel";
  const result = await fetchAccountCosts(query, { token, metaVersion: "v26.0", fetcher: async (url, options) => {
    calls++;
    assert.equal(url.origin, "https://graph.facebook.com");
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(url.searchParams.get("access_token"), null);
    assert.equal(url.searchParams.get("breakdowns"), "country");
    return Response.json({ data: [{ country: "PL", objective: "OUTCOME_TRAFFIC", account_currency: "PLN", date_start: "2026-11-03", spend: "100", impressions: "10000" },
      { country: "US", account_currency: "PLN", date_start: "2026-11-03", spend: "999", impressions: "100" }] });
  } });
  assert.equal(calls, 1);
  assert.equal(result.price.typical, 10);
  assert.doesNotMatch(JSON.stringify(result), /private-token-sentinel/);
});

test("adapters reject failed, partial, and currency-mismatched reports", async () => {
  for (const data of [{ error: { message: "private-token-sentinel" } }, { data: [], paging: { next: "https://example.com/" } },
    { data: [{ country: "PL", objective: "OUTCOME_TRAFFIC", account_currency: "USD", date_start: "2026-11-03", spend: "100", impressions: "10000" }] }]) {
    await assert.rejects(fetchAccountCosts(query, { token: "fake", metaVersion: "v26.0", fetcher: async () => Response.json(data) }));
  }
  await assert.rejects(fetchAccountCosts({ ...query, accountId: "123/../../oops" }, { token: "fake" }), /digits/);
});

test("TikTok adapter is read-only and validates geographic and currency metadata", async () => {
  const result = await fetchAccountCosts({ ...query, platform: "tiktok" }, { token: "local-token", fetcher: async (url, options) => {
    assert.equal(url.origin, "https://business-api.tiktok.com");
    assert.equal(options.method, "GET");
    assert.equal(options.headers["Access-Token"], "local-token");
    if (url.pathname.endsWith("/advertiser/info/")) return Response.json({ code: 0, data: { list: [{ advertiser_id: "123456", currency: "PLN" }] } });
    if (url.pathname.endsWith("/campaign/get/")) return Response.json({ code: 0, data: { list: [{ campaign_id: "456", objective_type: "TRAFFIC" }], page_info: { total_page: 1 } } });
    return Response.json({ code: 0, data: { page_info: { total_page: 1 }, list: [{ dimensions: { campaign_id: "456", country_code: "PL", stat_time_day: "2026-11-04 00:00:00" },
      metrics: { spend: "20", impressions: "1000" } }] } });
  } });
  assert.equal(result.platform, "tiktok");
  assert.equal(result.price.typical, 20);
});
