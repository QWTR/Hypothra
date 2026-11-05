# Deterministic growth model v1

Model identifier: `deterministic-growth-v1`.

For month t, given previous active users U, monthly churn c, organic growth g,
marketing spend M, customer acquisition cost A, paid conversion p, monthly price P,
fixed monthly cost F, and per-active-user cost V:

```text
retained     = U × (1 − c)
active       = retained × (1 + g) + M / A
paying       = active × p
revenue      = paying × P
costs        = M + F + active × V
profit       = revenue − costs
```

The initial population is before month-one churn. New paid acquisitions do not
churn in the same month; organic growth is applied only to retained users.
Conversion is a fraction of each month's active population, not a persistent
subscription cohort. No acquisition lag, saturation, discounts, tax, or capacity
limit is modeled. Costs accrue even when revenue is zero.

All fields are required. Unknown fields and non-finite numbers are rejected.

| Field | Allowed range |
| --- | --- |
| `months` | Integer 1–120 |
| `initialUsers` | 0–1,000,000,000 |
| `monthlyMarketingBudget` | 0–1,000,000,000 |
| `acquisitionCost` | 0.01–1,000,000,000 |
| `monthlyChurnRate` | 0–1 |
| `monthlyOrganicGrowthRate` | 0–1 |
| `paidConversionRate` | 0–1 |
| `monthlyPrice` | 0–1,000,000,000 |
| `fixedMonthlyCost` | 0–1,000,000,000 |
| `costPerActiveUser` | 0–1,000,000,000 |
| `currency` | Three uppercase ASCII letters; label only |

Counts are expectations and may be fractional. Calculation state and totals use
unrounded JavaScript IEEE-754 numbers. Output counts are rounded to six decimals
and money to two decimals with `Number(value.toFixed(digits))`. Summaries are
rounded from unrounded totals; displayed rows can differ from displayed totals
by small rounding amounts. This is not accounting software. Very large valid
values remain finite but exceed exact integer precision and may be unrealistic.

There is no clock, randomness, I/O, or learned prediction. Repeating the same
inputs with this model produces the same result. Any future mathematical change
must introduce a new model identifier or document compatible behavior explicitly.
