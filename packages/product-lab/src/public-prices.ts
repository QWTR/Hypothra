import { load } from "cheerio";
import { benchmarkSchema } from "./schema.js";
import type { Benchmark } from "./schema.js";

const sourceUrl = "https://adkit.so/benchmarks";
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A strict publisher adapter: ambiguous or changed markup yields no invented prices. */
export function parsePublicPrices(html: string, collectedAt: string): Benchmark[] {
  const $ = load(html);
  if (!$("body").text().includes("Amounts in USD")) throw new Error("The public source currency could not be verified.");
  const output: Benchmark[] = [];
  for (const platform of ["meta", "tiktok"] as const) {
    const heading = platform === "meta" ? /^Meta Ads benchmarks/ : /^TikTok Ads benchmarks/;
    const table = $("table").filter((_index, element) => heading.test($(element).children("caption").text().trim())).first();
    if (!table.length) throw new Error(`The public ${platform} benchmark table could not be verified. Its publisher may have changed the page.`);
    const caption = table.children("caption").text();
    const period = caption.match(new RegExp(`(${months.join("|")}) (20\\d{2})`));
    if (!period) throw new Error("The publisher did not provide a recognizable benchmark period.");
    const month = months.indexOf(period[1]!) + 1, year = Number(period[2]);
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    if (end > collectedAt) throw new Error("The public benchmark period is in the future or incomplete. No prices were imported.");
    for (const metric of ["cpm", "cpc"] as const) {
      const row = table.children("tbody").children("tr").filter((_index, element) => new RegExp(`^${metric.toUpperCase()}(?:Cost|\\b)`).test($(element).children("th").first().text().trim())).first();
      const cells = row.children("td").slice(0, 3).map((_index, element) => $(element).text().trim()).get();
      if (cells.length !== 3 || cells.some(cell => !/^\$[\d,]+(?:\.\d+)?$/.test(cell))) throw new Error(`Could not verify USD ${metric.toUpperCase()} figures for ${platform}.`);
      const [low, typical, high] = cells.map(value => Number(value.replace(/[$,]/g, "")));
      output.push(benchmarkSchema.parse({ id: `web-${platform}-${metric}-${year}${String(month).padStart(2, "0")}`, platform,
        country: "ZZ", currency: "USD", objective: "mixed", audience: "All countries and industries in the publisher's sample", metric,
        price: { low, typical, high }, source: { type: "public-benchmark", label: "AdKit advertiser-reported benchmark: 25th percentile, median, 75th percentile; global sample",
          url: sourceUrl + `?platform=${platform}`, observedFrom: start, observedTo: end, collectedAt } }));
    }
  }
  return output;
}

async function publicText(url: string, fetcher: typeof fetch, max = 3 * 1024 * 1024): Promise<string> {
  let response: Response;
  try { response = await fetcher(url, { headers: { "User-Agent": "Hypothra/0.2 public benchmark reader" }, redirect: "error", signal: AbortSignal.timeout(20_000) }); }
  catch { throw new Error("The public source could not be reached. Retry later or enter your own cost assumption."); }
  if (!response.ok || !response.body) throw new Error(`The public source returned HTTP ${response.status}. No prices were imported.`);
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > max) throw new Error("Public source exceeds its size limit."); chunks.push(value); }
    return Buffer.concat(chunks).toString("utf8");
  } finally { await reader.cancel().catch(() => {}); }
}

export async function findPublicPrices(currency = "USD", options: { fetcher?: typeof fetch; asOf?: string } = {}) {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Choose a three-letter currency code.");
  const fetcher = options.fetcher ?? fetch, asOf = options.asOf ?? new Date().toISOString().slice(0, 10);
  const benchmarks = parsePublicPrices(await publicText(sourceUrl, fetcher), asOf);
  if (currency !== "USD") {
    // Public NBP reference rates need no account, token, or advertising-provider access.
    const rateFor = async (code: string) => {
      if (code === "PLN") return { mid: 1, effectiveDate: asOf };
      const body = JSON.parse(await publicText(`https://api.nbp.pl/api/exchangerates/rates/a/${code.toLowerCase()}/?format=json`, fetcher, 32_768));
      const rate = body.rates?.[0];
      if (body.code !== code || !rate || !Number.isFinite(rate.mid) || rate.mid <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(rate.effectiveDate)
        || rate.effectiveDate > asOf || Date.parse(asOf) - Date.parse(rate.effectiveDate) > 10 * 86_400_000) throw new Error("Could not verify a recent public exchange rate.");
      return { mid: rate.mid as number, effectiveDate: rate.effectiveDate as string };
    };
    const [usd, target] = await Promise.all([rateFor("USD"), rateFor(currency)]);
    const fx = usd.mid / target.mid;
    for (const item of benchmarks) {
      const originalPrice = { ...item.price };
      item.currency = currency;
      item.price = { low: originalPrice.low * fx, typical: originalPrice.typical * fx, high: originalPrice.high * fx };
      item.currencyConversion = { originalCurrency: "USD", originalPrice, rate: fx,
        date: usd.effectiveDate < target.effectiveDate ? usd.effectiveDate : target.effectiveDate, sourceUrl: "https://nbp.pl/en/statistic-and-financial-reporting/rates/" };
      item.source.label = `AdKit global advertiser sample (25th / median / 75th percentiles); USD converted via NBP at ${fx.toPrecision(6)} on ${item.currencyConversion.date}`;
    }
  }
  return { benchmarks: benchmarks.map(item => benchmarkSchema.parse(item)), checkedAt: asOf, sources: [sourceUrl], notes: ["Read directly from a public benchmark page. No Meta or TikTok account or API token is needed.",
    "These figures describe a published global sample, not a guaranteed local promotion quote. The source period stays visible."] };
}
