# Launch funnel v1

Identifier: `launch-funnel-v1`. This deterministic model computes explicit
assumption combinations; it is not a calibrated prediction or confidence interval.

For channel budget B, CPM price C, click-through rate T, signup rate S,
activation rate A, paid conversion P, monthly subscription price M, and variable
cost V per activated user:

```text
impressions = B / C × 1000
clicks      = impressions × T
signups     = clicks × S
activated   = signups × A
paying      = activated × P
revenue     = paying × M
serviceCost = activated × V
contribution = revenue − B − serviceCost
```

For CPC evidence, `clicks = B / CPC`; impressions are inferred from CTR only when
CTR is positive. Rates do not affect CPC click count. They still affect downstream
conversion. Counts are expectations and may be fractional.

- Conservative: high acquisition price and low conversion-rate assumptions.
- Central: typical price and typical conversion-rate assumptions.
- Optimistic: low acquisition price and high conversion-rate assumptions.

Channel budgets plus fixed costs cannot exceed total budget. Variable service costs
are then included; scenarios that exceed total budget after those costs are flagged.
Profit is the sum of channel contribution minus fixed costs. Display counts round
to four decimals and money to two; totals sum displayed channel amounts, so small
rounding differences against unrounded arithmetic can occur.

`periodDays` defines the acquisition window. Revenue represents one full first
subscription month for acquired payers; it is not cash recognized inside that
window. No retention, renewal, taxes, refunds, organic traffic, or capacity model
is included. Creative text is descriptive and mapped to product capabilities; it
does not silently alter numerical conversion inputs.

## Conditional operational failure

A tested journey can be associated with a channel. The original assumed funnel
is preserved. A failing journey adds a separate conditional impact:

- Landing or signup failure: downstream signups, activation, payment, and revenue are zero.
- Activation failure: signups remain; downstream activation/payment/revenue are zero.
- Payment failure: signup/activation remain; payment/revenue are zero.

This assumes every visitor takes the same failing path. It is not a measured
population dropout rate. A passing path does not increase assumed conversion.
Synthetic persona motivations remain hypotheses; completed assertions and
recorded failures are the actual runtime observations.

The original growth model remains available through `hypothra simulate` and is
specified separately in [MODEL.md](MODEL.md).
