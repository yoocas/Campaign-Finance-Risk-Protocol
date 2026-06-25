/**
 * Offline, deterministic regression tests for the core analysis layer.
 *
 * Mirrors docs/manual-regression-suite.md. No LLM, network, or API calls —
 * this only verifies deterministic outputs of the parse → map → validate →
 * analyze pipeline. Run with `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseCsv, sampleDataset } from "../src/lib/import-parser";
import { autoMap } from "../src/lib/column-mapping";
import { validateRows } from "../src/lib/data-validation";
import { assessSufficiency, type DimensionKey } from "../src/lib/sufficiency";
import { analyzeSafeCampaigns, computeSafeKpis } from "../src/lib/safe-risk-engine";
import {
  buildAiBriefPayload,
  renderPayloadForPrompt,
} from "../src/lib/ai-brief-payload";

function run(parsed: ReturnType<typeof parseCsv>) {
  const mapping = autoMap(parsed.headers);
  const validation = validateRows(parsed, mapping);
  const sufficiency = assessSufficiency(mapping, validation.rows);
  const analysis = analyzeSafeCampaigns(validation.rows);
  const kpis = computeSafeKpis(analysis);
  return { mapping, validation, sufficiency, analysis, kpis };
}
const dim = (suff: ReturnType<typeof assessSufficiency>, key: DimensionKey) =>
  suff.find((d) => d.key === key)!;
const anyNonFinite = (analysis: ReturnType<typeof analyzeSafeCampaigns>) =>
  analysis.some((c) =>
    Object.values(c).some((v) => typeof v === "number" && !Number.isFinite(v)),
  );

test("baseline — sample dataset reproduces verified numbers", () => {
  const { sufficiency, analysis, kpis } = run(sampleDataset());
  assert.equal(kpis.totalCampaigns, 14);
  assert.equal(kpis.flaggedCampaigns, 9);
  assert.equal(kpis.highRiskCampaigns, 3);
  assert.equal(kpis.potentialLeakage.value, 92000);
  assert.equal(kpis.invoiceAmount.value, 1128500);
  assert.equal(kpis.expectedRevenue.value, 1220500);
  assert.equal((kpis.grossMargin.value * 100).toFixed(1), "34.6");
  assert.equal(analysis[0].campaign_id, "CMP-1008");
  assert.equal(analysis[0].advertiser, "Sample Gaming Brand");
  assert.ok(sufficiency.every((d) => d.status === "available"));
  assert.ok(!anyNonFinite(analysis));
});

test("test 1 — missing cost columns: margin unavailable, not fabricated", () => {
  const csv = [
    "campaign_id,advertiser,channel,contracted_cpm,billable_impressions,invoice_amount,delivered_impressions,booked_impressions,attention_score,supply_quality_flag",
    "CMP-101,Sample Outdoor Brand,Display,10,5000000,50000,4950000,5000000,70,ok",
    "CMP-102,Sample Fitness Brand,Video,20,2000000,40000,1980000,2000000,65,ok",
  ].join("\n");
  const { sufficiency, analysis, kpis } = run(parseCsv(csv));
  assert.equal(dim(sufficiency, "margin").status, "unavailable");
  assert.equal(dim(sufficiency, "billing").status, "available");
  assert.equal(kpis.grossMargin.available, false);
  assert.ok(analysis.every((c) => c.gross_margin === null));
  assert.ok(analysis.every((c) => !c.flag_names.includes("Margin Risk")));
  assert.ok(!anyNonFinite(analysis));
});

test("test 2 — missing contracted_cpm: leakage N/A, not $0", () => {
  const csv = [
    "campaign_id,advertiser,channel,billable_impressions,invoice_amount,publisher_cost,data_cost,creative_cost,delivered_impressions,booked_impressions,attention_score,supply_quality_flag",
    "CMP-201,Sample Outdoor Brand,Display,5000000,50000,20000,2000,3000,4950000,5000000,70,ok",
    "CMP-202,Sample Fitness Brand,Video,2000000,40000,15000,1000,2000,1980000,2000000,65,ok",
  ].join("\n");
  const { sufficiency, analysis, kpis } = run(parseCsv(csv));
  assert.equal(dim(sufficiency, "billing").status, "unavailable");
  assert.equal(kpis.expectedRevenue.available, false);
  assert.equal(kpis.potentialLeakage.available, false);
  assert.ok(analysis.every((c) => c.expected_revenue === null && c.invoice_gap === null));
  assert.equal(dim(sufficiency, "margin").status, "available");
  assert.ok(!anyNonFinite(analysis));
});

test("test 3 — messy numerics coerced; 'pending' invoice quarantined", () => {
  const csv = [
    "campaign_id,advertiser,channel,contracted_cpm,billable_impressions,invoice_amount,publisher_cost,data_cost,creative_cost,delivered_impressions,booked_impressions,attention_score,supply_quality_flag",
    'CMP-301,Sample Outdoor Brand,Display,10,"1,200,000","$12,000","$5,000","1,000","500","1,180,000","1,200,000",34%,ok',
    "CMP-302,Sample Fitness Brand,Video,20,2000000,pending,15000,1000,2000,1980000,2000000,65,ok",
  ].join("\n");
  const { validation, analysis } = run(parseCsv(csv));
  const clean = analysis.find((c) => c.campaign_id === "CMP-301")!;
  const pending = analysis.find((c) => c.campaign_id === "CMP-302")!;

  assert.equal(clean.billable_impressions, 1200000);
  assert.equal(clean.invoice_amount, 12000);
  assert.equal(clean.attention_score, 34);
  assert.equal(clean.expected_revenue, 12000);
  assert.equal(clean.invoice_gap, 0);

  // 'pending' invoice raised an error and was quarantined (not coerced to 0).
  assert.ok(validation.errorCount >= 1);
  assert.equal(pending.invoice_amount, null);
  assert.equal(pending.gross_margin, null);
  assert.equal(pending.invoice_gap, null);
  assert.ok(!anyNonFinite(analysis));
});

test("test 4 — clean profitable dataset: true $0 leakage, no manufactured risk", () => {
  const csv = [
    "campaign_id,advertiser,channel,contracted_cpm,billable_impressions,invoice_amount,publisher_cost,data_cost,creative_cost,delivered_impressions,booked_impressions,attention_score,supply_quality_flag",
    "CMP-401,Sample Outdoor Brand,Display,10,5000000,50000,20000,2000,3000,4950000,5000000,70,ok",
    "CMP-402,Sample Fitness Brand,Video,20,2000000,40000,15000,1000,2000,1980000,2000000,65,ok",
  ].join("\n");
  const { sufficiency, analysis, kpis } = run(parseCsv(csv));
  assert.equal(kpis.flaggedCampaigns, 0);
  assert.equal(kpis.highRiskCampaigns, 0);
  assert.equal(kpis.potentialLeakage.available, true);
  assert.equal(kpis.potentialLeakage.value, 0); // true $0, distinct from N/A
  assert.equal(kpis.grossMargin.available, true);
  assert.ok(kpis.grossMargin.value > 0.35);
  assert.ok(sufficiency.every((d) => d.status === "available"));
  assert.ok(analysis.every((c) => c.risk_level === "Low"));
  assert.ok(!anyNonFinite(analysis));
});

test("AI prompt rendering — missing CPM renders safely (offline, no model call)", () => {
  const csv = [
    "campaign_id,advertiser,channel,billable_impressions,invoice_amount,publisher_cost,data_cost,creative_cost,delivered_impressions,booked_impressions,attention_score,supply_quality_flag",
    "CMP-201,Sample Outdoor Brand,Display,5000000,50000,40000,2000,3000,4375000,5000000,70,ok",
    "CMP-202,Sample Fitness Brand,Video,2000000,40000,15000,1000,2000,1980000,2000000,65,ok",
  ].join("\n");
  const { sufficiency, validation, analysis, kpis } = run(parseCsv(csv));
  const payload = buildAiBriefPayload(analysis, kpis, sufficiency, validation);
  const rendered = renderPayloadForPrompt(payload);

  // Leakage cannot be computed — and is explicitly NOT $0.
  assert.match(rendered, /Potential revenue leakage: N\/A — cannot be computed/);
  assert.match(rendered, /This is NOT \$0/);
  assert.match(rendered, /Expected revenue: N\/A — cannot be computed/);

  // Margins / delivery rates are percentages with one decimal, never raw decimals.
  assert.match(rendered, /Gross margin: \d+\.\d%/);
  assert.match(rendered, /Delivery rate: \d+\.\d%/);
  assert.ok(!/\b0\.\d{3,}\b/.test(rendered), "no long raw decimals leak into the prompt");

  // Internal field names / booleans are not exposed.
  for (const internal of [
    "risk_partial",
    "risk_score",
    "gross_margin",
    "delivery_rate",
    "invoice_amount",
    '"available"',
  ]) {
    assert.ok(!rendered.includes(internal), `must not expose internal token: ${internal}`);
  }

  // Currency is formatted as dollars.
  assert.match(rendered, /Invoice amount: \$[\d,]+/);
});

test("test 5 — bad headers: conservative mapping, no fabricated analysis", () => {
  const csv = ["alpha,bravo,charlie,delta,echo", "1,2,3,4,5", "6,7,8,9,0"].join("\n");
  const { mapping, sufficiency, analysis, kpis } = run(parseCsv(csv));
  assert.ok(Object.values(mapping).every((v) => v === null));
  assert.ok(sufficiency.every((d) => d.status === "unavailable"));
  assert.equal(kpis.invoiceAmount.available, false);
  assert.equal(kpis.expectedRevenue.available, false);
  assert.equal(kpis.potentialLeakage.available, false);
  assert.equal(kpis.grossMargin.available, false);
  assert.ok(analysis.every((c) => c.risk_level === null && c.flags.length === 0));
  assert.ok(!anyNonFinite(analysis));
});
