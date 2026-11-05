# Advertising data and optional connectors

There is no universal fixed price for a future Meta or TikTok campaign. Account
history, published benchmarks, and manual assumptions answer different questions.
Hypothra requires each observation to carry its context and source dates.

## Source types

- `manual-assumption`: a number you chose; never described as a current platform price.
- `account-export`: normalized observations exported from your authorized account.
- `account-api`: read-only account reporting fetched explicitly with your credentials.
- `public-benchmark`: a manually reviewed published source, with URL and date.

Every observation specifies platform, country, currency, objective, audience, CPM
or CPC range, collection date, and observation period. A measured/public source
needs an HTTPS provenance URL without query strings or embedded credentials.

The launch plan rejects platform, geography, currency, or objective mismatches.
Measured sources older than `maxBenchmarkAgeDays` are rejected. Collection cannot
be in the future. Changing an audience produces a warning because price transfer
between audiences is uncertain. The program never relabels an assumption as measured.

## Import an account export

Normalize an export to this CSV shape using decimal dots and one consistent segment:

```csv
date,spend,impressions,currency,country,objective
2026-11-03,100,10000,PLN,PL,traffic
2026-11-04,60,2000,PLN,PL,traffic
```

These are **synthetic tutorial records**, not real campaign prices. The resulting
CPM range is 10–30 PLN and the impression-weighted mean is 13.333… PLN. Only
positive-spend, positive-impression observations contribute to the price range.
Rows cannot be formulas, mixed currencies, or mixed segments.

```powershell
hypothra ads import . --file costs.csv --platform meta --country PL --currency PLN --objective traffic --audience "Your measured segment" --source https://www.facebook.com/adsmanager/ --id owned-meta-history
```

Change the channel's `benchmarkId` to `owned-meta-history`. Importing data does
not automatically change a launch plan or buy any ads. The CSV cap is 1 MiB and
10,000 observations.

## Optional account refresh

Create an ignored local environment file, for example `.hypothra/providers.env`,
and put the appropriate token there. Never paste tokens into chat or public issues.
Use the root `.env.example` as a key-name reference. Nothing reads it automatically.

```text
HYPOTHRA_META_TOKEN=<set locally>
HYPOTHRA_META_API_VERSION=<supported version configured for your app>
HYPOTHRA_TIKTOK_TOKEN=<set locally>
```

Then explicitly request a read-only refresh, using your own numeric account ID:

```powershell
hypothra ads refresh . --env-file .hypothra/providers.env --platform meta --account <id> --country PL --currency PLN --objective traffic --audience "Your account segment" --since 2026-11-01 --until 2026-11-04
```

Use `--platform tiktok` with a TikTok advertiser ID for that connector. Tokens must
have the required read/reporting access to that account. Hypothra does not create
provider accounts, obtain credentials, or change campaign permissions automatically.

Meta reads daily country-level campaign Insights, verifies account currency, and
selects recognized campaign objectives. TikTok reads advertiser currency, campaign
objectives, and a country/day campaign audience report. Unsupported dimension
combinations, missing metadata, errors, and pagination stop the operation. Narrow
the date range or use a normalized export; partial data is never silently accepted.

The connector aggregates min/weighted-mean/max observed CPM. It does not claim a
binding price for a future campaign or prove that audience labels transfer exactly.
Only GET requests to fixed provider hosts are used; no campaign creation or spend
endpoint is implemented. Credentials are sent in headers and excluded from results.

The adapters are covered by synthetic response tests. A successful live account
query still needs to be checked against that account's report before relying on
the data. No live account access is implied by this repository.

## Provider references

- [Meta Marketing API Insights](https://developers.facebook.com/docs/marketing-api/insights/)
- [Meta official Insights field definitions](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adsinsights.py)
- [TikTok official reporting SDK reference](https://github.com/tiktok/tiktok-business-api-sdk/blob/main/js_sdk/docs/ReportingApi.md)
- [TikTok official advertiser account reference](https://github.com/tiktok/tiktok-business-api-sdk/blob/main/js_sdk/docs/AccountManagementApi.md)

API contracts and account capabilities can change. Verify your provider's supported
API version, metrics, and access rather than assuming a synthetic test is live proof.
