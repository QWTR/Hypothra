import { benchmarkSchema } from "./schema.js";
import type { Benchmark } from "./schema.js";

export interface CostRow { date: string; spend: number; impressions: number }

export function aggregateCosts(rows: CostRow[], metadata: {
  id: string; platform: "meta" | "tiktok" | "other"; country: string; currency: string;
  objective: "traffic" | "conversions" | "awareness"; audience: string;
  sourceType: "account-export" | "account-api"; sourceUrl: string; collectedAt: string;
}): Benchmark {
  if (!rows.length || rows.length > 10_000) throw new Error("Cost data must contain 1–10,000 observations.");
  for (const row of rows) {
    if (!Number.isFinite(row.spend) || row.spend < 0 || !Number.isSafeInteger(row.impressions) || row.impressions < 0) throw new Error("Invalid spend or impression count.");
    const time = Date.parse(row.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== row.date || row.date > metadata.collectedAt) throw new Error("Invalid or future observation date.");
  }
  const valid = rows.filter(row => row.impressions > 0 && row.spend > 0);
  if (!valid.length) throw new Error("No positive observed spend and impressions. Cannot derive an advertising price.");
  const spend = valid.reduce((sum, row) => sum + row.spend, 0);
  const impressions = valid.reduce((sum, row) => sum + row.impressions, 0);
  const prices = valid.map(row => row.spend / row.impressions * 1000);
  const sortedDates = rows.map(row => row.date).sort();
  return benchmarkSchema.parse({ id: metadata.id, platform: metadata.platform, country: metadata.country, currency: metadata.currency,
    objective: metadata.objective, audience: metadata.audience, metric: "cpm",
    price: { low: Math.min(...prices), typical: spend / impressions * 1000, high: Math.max(...prices) },
    source: { type: metadata.sourceType, label: "Observed historical CPM range and impression-weighted mean; not a future price quote",
      url: metadata.sourceUrl, observedFrom: sortedDates[0], observedTo: sortedDates.at(-1), collectedAt: metadata.collectedAt, sampleImpressions: impressions } });
}

/** Minimal RFC-4180 CSV reader; no spreadsheet formula evaluation. */
export function parseCsv(text: string): string[][] {
  if (Buffer.byteLength(text) > 1024 * 1024) throw new Error("CSV exceeds 1 MiB.");
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else if (quoted || value === "") quoted = !quoted;
      else throw new Error("Invalid CSV quoting.");
    } else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(value); if (row.some(cell => cell.trim())) rows.push(row); row = []; value = "";
    } else value += char;
    if (rows.length > 10_001 || row.length > 30) throw new Error("CSV exceeds its row or column budget.");
  }
  if (quoted) throw new Error("Unclosed CSV quote.");
  row.push(value); if (row.some(cell => cell.trim())) rows.push(row);
  return rows;
}

export function importCostCsv(text: string, metadata: Parameters<typeof aggregateCosts>[1]): Benchmark {
  const [headers, ...records] = parseCsv(text.replace(/^\uFEFF/, ""));
  const expected = ["date", "spend", "impressions", "currency", "country", "objective"];
  if (!headers || expected.some(name => !headers.includes(name)) || new Set(headers).size !== headers.length) {
    throw new Error("CSV headers must include date,spend,impressions,currency,country,objective with no duplicates.");
  }
  const index = (name: string) => headers.indexOf(name);
  const rows = records.map(cells => {
    if (cells.length !== headers.length) throw new Error("CSV row length differs from headers.");
    if (cells[index("currency")] !== metadata.currency || cells[index("country")] !== metadata.country || cells[index("objective")] !== metadata.objective) {
      throw new Error("Every CSV row must match the selected currency, country, and objective. Export one consistent segment.");
    }
    const spend = cells[index("spend")]!, impressions = cells[index("impressions")]!;
    if (!/^\d+(?:\.\d+)?$/.test(spend) || !/^\d+$/.test(impressions)) throw new Error("CSV spend/impressions must be unsigned decimal numbers using a dot separator.");
    return { date: cells[index("date")]!, spend: Number(spend), impressions: Number(impressions) };
  });
  return aggregateCosts(rows, metadata);
}

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new Error(`Advertising API returned HTTP ${response.status}. Check local credentials and read permissions.`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Advertising API returned no body.");
  let count = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      count += value.byteLength; if (count > 1024 * 1024) throw new Error("Advertising API response exceeds 1 MiB.");
      chunks.push(value);
    }
    const result: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Invalid API response.");
    return result as Record<string, unknown>;
  } catch { throw new Error("Advertising API response is invalid or exceeds its byte budget."); }
  finally { await reader.cancel().catch(() => {}); }
}

export async function fetchAccountCosts(input: {
  platform: "meta" | "tiktok"; accountId: string; country: string; currency: string;
  objective: "traffic" | "conversions" | "awareness"; audience: string; since: string; until: string; collectedAt: string;
}, options: { token?: string; metaVersion?: string; fetcher?: typeof fetch } = {}): Promise<Benchmark> {
  if (!/^\d{3,30}$/.test(input.accountId)) throw new Error("Account ID must contain digits only.");
  if (!/^[A-Z]{2}$/.test(input.country) || !/^[A-Z]{3}$/.test(input.currency)) throw new Error("Invalid country or currency code.");
  const dates = [input.since, input.until, input.collectedAt];
  if (dates.some(value => !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)))) throw new Error("Invalid reporting date.");
  if (input.since > input.until || input.until > input.collectedAt || Date.parse(input.until) - Date.parse(input.since) > 90 * 86_400_000) throw new Error("Choose an ordered historical date range of at most 90 days.");
  const token = options.token ?? process.env[input.platform === "meta" ? "HYPOTHRA_META_TOKEN" : "HYPOTHRA_TIKTOK_TOKEN"];
  if (!token) throw new Error(`Set HYPOTHRA_${input.platform.toUpperCase()}_TOKEN in your local environment. No advertising account data has been fetched.`);
  const fetcher = options.fetcher ?? fetch;
  let rows: CostRow[] = [], sourceUrl: string;
  const request = async (url: URL, headers: Record<string, string>) => {
    let response: Response;
    try { response = await fetcher(url, { method: "GET", headers, redirect: "error", signal: AbortSignal.timeout(15_000) }); }
    catch { throw new Error("Advertising API request failed or timed out. No campaign was created or modified."); }
    return readResponse(response);
  };
  if (input.platform === "meta") {
    const version = options.metaVersion ?? process.env.HYPOTHRA_META_API_VERSION;
    if (!version || !/^v\d{1,2}\.0$/.test(version)) throw new Error("Set HYPOTHRA_META_API_VERSION to a supported Graph API version, for example the version configured for your app.");
    const url = new URL(`https://graph.facebook.com/${version}/act_${input.accountId}/insights`);
    url.search = new URLSearchParams({ fields: "spend,impressions,account_currency,date_start,date_stop,objective", level: "campaign", time_increment: "1", breakdowns: "country",
      time_range: JSON.stringify({ since: input.since, until: input.until }), limit: "1000" }).toString();
    const data = await request(url, { Authorization: `Bearer ${token}` });
    if (data.error) throw new Error("Meta refused the read-only Insights query. Check token scope, account access, and API version.");
    if ((data.paging as { next?: string } | undefined)?.next) throw new Error("Meta report is paginated. Narrow the date range; partial data is not accepted.");
    if (!Array.isArray(data.data)) throw new Error("Meta returned an unexpected reporting schema.");
    const objectives = { traffic: ["OUTCOME_TRAFFIC", "LINK_CLICKS"], awareness: ["OUTCOME_AWARENESS", "REACH", "BRAND_AWARENESS"], conversions: ["OUTCOME_SALES", "OUTCOME_LEADS", "CONVERSIONS", "LEAD_GENERATION"] };
    rows = data.data.filter((item: Record<string, unknown>) => item.country === input.country && objectives[input.objective].includes(String(item.objective))).map((item: Record<string, unknown>) => {
      if (item.account_currency !== input.currency) throw new Error("Meta account currency does not match the launch currency.");
      return { date: String(item.date_start), spend: Number(item.spend), impressions: Number(item.impressions) };
    });
    sourceUrl = "https://developers.facebook.com/docs/marketing-api/insights/";
  } else {
    const headers = { "Access-Token": token };
    const accountUrl = new URL("https://business-api.tiktok.com/open_api/v1.3/advertiser/info/");
    accountUrl.search = new URLSearchParams({ advertiser_ids: JSON.stringify([input.accountId]), fields: JSON.stringify(["advertiser_id", "currency"]) }).toString();
    const account = await request(accountUrl, headers);
    const accounts = (account.data as { list?: { advertiser_id: string; currency: string }[] } | undefined)?.list;
    if (account.code !== 0 || !Array.isArray(accounts) || !accounts.some(item => String(item.advertiser_id) === input.accountId && item.currency === input.currency)) throw new Error("TikTok account currency cannot be verified. Use a currency-labeled export.");
    const campaignUrl = new URL("https://business-api.tiktok.com/open_api/v1.3/campaign/get/");
    campaignUrl.search = new URLSearchParams({ advertiser_id: input.accountId, page: "1", page_size: "1000", fields: JSON.stringify(["campaign_id", "objective_type"]) }).toString();
    const campaigns = await request(campaignUrl, headers);
    const campaignData = campaigns.data as { list?: { campaign_id: string; objective_type: string }[]; page_info?: { total_page?: number } } | undefined;
    if (campaigns.code !== 0 || !Array.isArray(campaignData?.list) || (campaignData.page_info?.total_page ?? 1) > 1) throw new Error("TikTok campaign objectives cannot be verified completely. Use a segmented export.");
    const objectiveTypes = { traffic: ["TRAFFIC"], awareness: ["REACH"], conversions: ["CONVERSIONS", "LEAD_GENERATION", "PRODUCT_SALES", "WEB_CONVERSIONS"] };
    const campaignIds = new Set(campaignData.list.filter(item => objectiveTypes[input.objective].includes(item.objective_type)).map(item => String(item.campaign_id)));
    if (!campaignIds.size) throw new Error("No TikTok campaigns match the requested objective.");
    const url = new URL("https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/");
    url.search = new URLSearchParams({ advertiser_id: input.accountId, report_type: "AUDIENCE", data_level: "AUCTION_CAMPAIGN",
      dimensions: JSON.stringify(["campaign_id", "country_code", "stat_time_day"]), metrics: JSON.stringify(["spend", "impressions"]),
      start_date: input.since, end_date: input.until, page: "1", page_size: "1000" }).toString();
    const data = await request(url, headers);
    if (data.code !== 0) throw new Error("TikTok refused the read-only audience report. Check reporting permission and supported dimensions/metrics; use CSV import if this account cannot provide that report.");
    const report = data.data as { list?: { dimensions: Record<string, string>; metrics: Record<string, string> }[]; page_info?: { total_page?: number } } | undefined;
    if (!report || !Array.isArray(report.list) || (report.page_info?.total_page ?? 1) > 1) throw new Error("TikTok report is missing or paginated. Narrow the date range; partial data is not accepted.");
    rows = report.list.filter(item => item.dimensions.country_code === input.country && campaignIds.has(String(item.dimensions.campaign_id))).map(item => {
      return { date: item.dimensions.stat_time_day!.slice(0, 10), spend: Number(item.metrics.spend), impressions: Number(item.metrics.impressions) };
    });
    sourceUrl = "https://business-api.tiktok.com/portal/docs";
  }
  if (rows.some(row => row.date < input.since || row.date > input.until)) throw new Error("Advertising API returned dates outside the requested range.");
  return aggregateCosts(rows, { id: `${input.platform}-account-history`, platform: input.platform, country: input.country,
    currency: input.currency, objective: input.objective, audience: input.audience,
    sourceType: "account-api", sourceUrl, collectedAt: input.collectedAt });
}
