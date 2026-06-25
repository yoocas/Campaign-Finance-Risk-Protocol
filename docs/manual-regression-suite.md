# Manual Regression Suite — Campaign Finance Risk Copilot

This document captures the manual degradation tests that verify the
**deterministic** analysis layer behaves like an honest analyst: it analyzes
what it can, and clearly reports what it cannot — without fabricating values.

> **Synthetic data only.** Every dataset below is fully synthetic and
> anonymized. Advertiser names are placeholders (e.g. "Sample Outdoor Brand").
> Do **not** paste real client, publisher, campaign, or financial records into
> this prototype.

> **Scope warning.** Passing these tests confirms *verified prototype behavior*,
> not hardened production readiness. They exercise the core parse → map →
> validate → analyze pipeline on small datasets; they are not a substitute for
> production data-quality controls, security review, or scale testing.

## Key distinction: `$0` vs `N/A`

The single most important behavior these tests protect:

- **`$0` (a real number)** means the metric was computed and the result is
  genuinely zero. Example: a clean, fully-mapped dataset where every invoice
  equals its expected revenue → **`$0` potential leakage** because *no leakage
  exists*.
- **`N/A — insufficient data`** means the metric **could not be computed**
  because a required input was missing/unmapped. Example: no `contracted_cpm`
  column → expected revenue and potential leakage are **`N/A`**, because leakage
  *cannot be computed*, not because it is zero.

The app must never collapse `N/A` into `$0`. A missing input is not a zero
value.

---

## Verified sample dataset (baseline)

Loading the built-in **sample dataset** (14 mock campaigns) must always
reproduce these numbers. Treat them as a regression contract:

| Metric | Expected |
| --- | --- |
| Campaigns reviewed | 14 |
| Campaigns flagged | 9 |
| High-risk campaigns | 3 |
| Potential leakage | $92,000 |
| Total invoice amount | $1,128,500 |
| Expected revenue | $1,220,500 |
| Blended gross margin | 34.6% |
| Highest-risk campaign | Sample Gaming Brand / CMP-1008 |

---

## Test 1 — Missing cost columns

Margin analysis requires `invoice_amount` + `publisher_cost` + `data_cost` +
`creative_cost`. This dataset omits all cost columns.

```csv
campaign_id,advertiser,channel,contracted_cpm,billable_impressions,invoice_amount,delivered_impressions,booked_impressions,attention_score,supply_quality_flag
CMP-101,Sample Outdoor Brand,Display,10,5000000,50000,4950000,5000000,70,ok
CMP-102,Sample Fitness Brand,Video,20,2000000,40000,1980000,2000000,65,ok
```

**Expected — PASS when:**
- Margin analysis is reported **Unavailable** (missing Publisher/Data/Creative Cost).
- Gross margin KPI shows **N/A**, not a fabricated percentage and not `0%`.
- No row receives a **Margin Risk** flag.
- Invoice-gap, delivery, attention, and supply analyses remain **Available**.

---

## Test 2 — Missing `contracted_cpm`

Invoice-gap analysis requires `billable_impressions` + `contracted_cpm` +
`invoice_amount`. This dataset omits CPM.

```csv
campaign_id,advertiser,channel,billable_impressions,invoice_amount,publisher_cost,data_cost,creative_cost,delivered_impressions,booked_impressions,attention_score,supply_quality_flag
CMP-201,Sample Outdoor Brand,Display,5000000,50000,20000,2000,3000,4950000,5000000,70,ok
CMP-202,Sample Fitness Brand,Video,2000000,40000,15000,1000,2000,1980000,2000000,65,ok
```

**Expected — PASS when:**
- Invoice-gap analysis is reported **Unavailable** (missing Contracted CPM).
- Expected revenue, invoice gap, and potential leakage show **N/A** —
  **not `$0`**.
- Margin and delivery analyses remain **Available** and are computed normally.

---

## Test 3 — Messy numeric data (coercion + quarantine)

Currency symbols, thousands separators, and percent signs must be coerced.
A non-numeric invoice (`pending`) must be **flagged and quarantined** so it
cannot pollute invoice-based analysis.

```csv
campaign_id,advertiser,channel,contracted_cpm,billable_impressions,invoice_amount,publisher_cost,data_cost,creative_cost,delivered_impressions,booked_impressions,attention_score,supply_quality_flag
CMP-301,Sample Outdoor Brand,Display,10,"1,200,000","$12,000","$5,000","1,000","500","1,180,000","1,200,000",34%,ok
CMP-302,Sample Fitness Brand,Video,20,2000000,pending,15000,1000,2000,1980000,2000000,65,ok
```

**Coercion behavior (documented):**
- `"1,200,000"` → `1200000` (thousands separators stripped).
- `"$12,000"` → `12000` (currency symbol stripped).
- `"34%"` → `34` — the magnitude is kept, **not** divided by 100. No raw input
  field in this schema is a 0–1 fraction; the only bounded field,
  `attention_score`, is on a 0–100 scale, so `34%` means `34`.
- `"pending"` → cannot parse → row flagged with a validation **error** and the
  invoice value is left undefined (quarantined).

**Expected — PASS when:**
- CMP-301's coerced values are exact: billable `1200000`, invoice `12000`,
  attention `34`; expected revenue `12000`; invoice gap `0`.
- CMP-302 raises a validation **error** for the `pending` invoice and its
  invoice amount is **undefined**, excluding it from invoice/margin/attention
  analysis (it is not treated as `$0`).
- No `NaN` or `Infinity` appears anywhere.

---

## Test 4 — Clean, profitable dataset (true `$0` leakage)

Every invoice equals its expected revenue; margins are healthy; delivery is on
pace. No risk should be manufactured.

```csv
campaign_id,advertiser,channel,contracted_cpm,billable_impressions,invoice_amount,publisher_cost,data_cost,creative_cost,delivered_impressions,booked_impressions,attention_score,supply_quality_flag
CMP-401,Sample Outdoor Brand,Display,10,5000000,50000,20000,2000,3000,4950000,5000000,70,ok
CMP-402,Sample Fitness Brand,Video,20,2000000,40000,15000,1000,2000,1980000,2000000,65,ok
```

**Expected — PASS when:**
- 0 campaigns flagged, 0 high-risk.
- Potential leakage is **Available and `$0`** (a true zero, distinct from N/A).
- Blended gross margin is **Available** and healthy (> 35%).
- All five analysis dimensions are **Available**; every campaign is **Low** risk.

---

## Test 5 — Bad / mismatched headers

Headers that do not correspond to any standard field must stay **unmapped**.
The app must refuse to fabricate analysis from unmapped columns.

```csv
alpha,bravo,charlie,delta,echo
1,2,3,4,5
6,7,8,9,0
```

**Expected — PASS when:**
- Auto-mapping maps **zero** standard fields (conservative).
- All five analysis dimensions are **Unavailable** (required fields unmapped).
- KPIs (invoice, expected revenue, leakage, margin) all show **N/A**.
- Every row's risk level is **N/A** — no flags, no invented numbers.

---

## Automated coverage

The same five datasets plus the verified sample baseline are exercised by an
offline, deterministic test in `tests/regression.test.ts`:

```bash
npm test
```

This compiles the `src/lib` analysis layer with the local TypeScript compiler
and runs Node's built-in test runner. It performs **no** LLM, network, or API
calls — it only verifies deterministic outputs.
