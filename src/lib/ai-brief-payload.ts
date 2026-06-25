import { z } from "zod";
import type { SafeAnalyzedCampaign, SafeKpis } from "./safe-risk-engine";
import type { DimensionSufficiency } from "./sufficiency";
import type { ValidationResult } from "./data-validation";

/**
 * Sanitized AI-brief payload.
 *
 * This is the ONLY data sent to the model provider. It contains computed,
 * mock/anonymized results — KPIs, risk flags, sufficiency, a validation
 * *summary* (counts only), and campaign-level computed outputs. It deliberately
 * excludes raw uploaded rows, original file contents, validation issue text
 * (which can echo raw cells), and anything not derived by the deterministic
 * engine. `null` always means "not computable" (N/A) and must stay null.
 */

const kpiMetricSchema = z.object({
  available: z.boolean(),
  value: z.number(),
  rows: z.number(),
  totalRows: z.number(),
});

const campaignSchema = z.object({
  campaign_id: z.string(),
  advertiser: z.string().nullable(),
  channel: z.string().nullable(),
  ad_format: z.string().nullable(),
  risk_level: z.enum(["High", "Medium", "Low"]).nullable(),
  risk_score: z.number(),
  risk_partial: z.boolean(),
  flags: z.array(z.string()),
  recommended_action: z.string(),
  // Computed financials — null when not computable (never coerced to 0)
  invoice_amount: z.number().nullable(),
  expected_revenue: z.number().nullable(),
  invoice_gap: z.number().nullable(),
  gross_margin: z.number().nullable(),
  delivery_rate: z.number().nullable(),
  attention_score: z.number().nullable(),
});

export const aiBriefPayloadSchema = z.object({
  meta: z.object({
    dataset: z.literal("mock-anonymized"),
    generated_for: z.literal("finance-review-prototype"),
  }),
  kpis: z.object({
    totalCampaigns: z.number(),
    flaggedCampaigns: z.number(),
    highRiskCampaigns: z.number(),
    invoiceAmount: kpiMetricSchema,
    expectedRevenue: kpiMetricSchema,
    potentialLeakage: kpiMetricSchema,
    grossMargin: kpiMetricSchema,
  }),
  sufficiency: z.array(
    z.object({
      analysis: z.string(),
      status: z.enum(["available", "partial", "unavailable"]),
      readyRows: z.number(),
      totalRows: z.number(),
      reason: z.string(),
    }),
  ),
  validationSummary: z.object({
    totalRows: z.number(),
    validRows: z.number(),
    rowsWithIssues: z.number(),
    errorCount: z.number(),
    warningCount: z.number(),
  }),
  campaigns: z.array(campaignSchema).max(50),
});

export type AiBriefPayload = z.infer<typeof aiBriefPayloadSchema>;

/** The structured memo the model must return. */
export const aiMemoSchema = z.object({
  executive_summary: z.string(),
  data_confidence: z.string(),
  highest_risk_campaign: z.string(),
  biggest_risk_driver: z.string(),
  verify_first: z.string(),
  possible_false_positives: z.string(),
  recommended_actions: z.array(z.string()),
  cannot_conclude: z.string(),
  follow_up_questions: z.array(z.string()),
});

export type AiMemo = z.infer<typeof aiMemoSchema>;

/**
 * JSON Schema handed to the Messages API `output_config.format` so the model is
 * constrained to return exactly the memo shape. Kept in sync with aiMemoSchema.
 */
export const AI_MEMO_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "executive_summary",
    "data_confidence",
    "highest_risk_campaign",
    "biggest_risk_driver",
    "verify_first",
    "possible_false_positives",
    "recommended_actions",
    "cannot_conclude",
    "follow_up_questions",
  ],
  properties: {
    executive_summary: { type: "string" },
    data_confidence: { type: "string" },
    highest_risk_campaign: { type: "string" },
    biggest_risk_driver: { type: "string" },
    verify_first: { type: "string" },
    possible_false_positives: { type: "string" },
    recommended_actions: { type: "array", items: { type: "string" } },
    cannot_conclude: { type: "string" },
    follow_up_questions: { type: "array", items: { type: "string" } },
  },
} as const;

/**
 * Build the sanitized payload from computed analysis. No raw rows, no original
 * file text, no validation issue messages — only deterministic outputs.
 */
export function buildAiBriefPayload(
  campaigns: SafeAnalyzedCampaign[],
  kpis: SafeKpis,
  sufficiency: DimensionSufficiency[],
  validation: ValidationResult,
): AiBriefPayload {
  return {
    meta: {
      dataset: "mock-anonymized",
      generated_for: "finance-review-prototype",
    },
    kpis: {
      totalCampaigns: kpis.totalCampaigns,
      flaggedCampaigns: kpis.flaggedCampaigns,
      highRiskCampaigns: kpis.highRiskCampaigns,
      invoiceAmount: kpis.invoiceAmount,
      expectedRevenue: kpis.expectedRevenue,
      potentialLeakage: kpis.potentialLeakage,
      grossMargin: kpis.grossMargin,
    },
    sufficiency: sufficiency.map((d) => ({
      analysis: d.analysis,
      status: d.status,
      readyRows: d.readyRows,
      totalRows: d.totalRows,
      reason: d.reason,
    })),
    validationSummary: {
      totalRows: validation.totalRows,
      validRows: validation.validRows,
      rowsWithIssues: validation.rowsWithIssues,
      errorCount: validation.errorCount,
      warningCount: validation.warningCount,
    },
    // Cap at 50 to bound payload size; sample is 14.
    campaigns: campaigns.slice(0, 50).map((c) => ({
      campaign_id: c.campaign_id,
      advertiser: c.advertiser,
      channel: c.channel,
      ad_format: c.ad_format,
      risk_level: c.risk_level,
      risk_score: c.risk_score,
      risk_partial: c.risk_partial,
      flags: c.flag_names,
      recommended_action: c.recommended_action,
      invoice_amount: c.invoice_amount,
      expected_revenue: c.expected_revenue,
      invoice_gap: c.invoice_gap,
      gross_margin: c.gross_margin,
      delivery_rate: c.delivery_rate,
      attention_score: c.attention_score,
    })),
  };
}

// ---- Prompt rendering ------------------------------------------------------
// The wire payload above stays raw (numbers/booleans) so the schema and what is
// sent over the network are unchanged. For the model PROMPT we render that same
// computed data into a finance-facing view: currency as dollars, ratios as
// percentages, nulls as explicit N/A, internal field names hidden. This keeps
// raw decimals and field names out of the memo without touching payload safety.

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const usdSigned = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
const fmtUSD = (n: number): string => usd.format(n);
const fmtUSDSigned = (n: number): string => usdSigned.format(n);
const fmtPct = (ratio: number): string => `${(ratio * 100).toFixed(1)}%`;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function reasonFor(payload: AiBriefPayload, analysis: string): string {
  return (
    payload.sufficiency.find((d) => d.analysis === analysis)?.reason ??
    "required inputs are not available"
  );
}

function scopeNote(rows: number, totalRows: number): string {
  return rows < totalRows ? ` (across ${rows} of ${totalRows} campaigns)` : "";
}

function campaignBlock(
  c: AiBriefPayload["campaigns"][number],
  index: number,
): string {
  const meta = [c.channel, c.ad_format].filter(Boolean).join(", ");
  const lines = [
    `${index}. ${c.advertiser ?? c.campaign_id} (${c.campaign_id})${
      meta ? ` — ${meta}` : ""
    }`,
    `   Risk level: ${c.risk_level ?? "Not assessed (insufficient data)"}`,
    `   Flags: ${c.flags.length > 0 ? c.flags.join(", ") : "none"}`,
    `   Invoice amount: ${c.invoice_amount === null ? "N/A" : fmtUSD(c.invoice_amount)}`,
    `   Expected revenue: ${
      c.expected_revenue === null ? "N/A (not computable for this campaign)" : fmtUSD(c.expected_revenue)
    }`,
    `   Invoice gap: ${
      c.invoice_gap === null ? "N/A (cannot be computed)" : fmtUSDSigned(c.invoice_gap)
    }`,
    `   Gross margin: ${c.gross_margin === null ? "N/A" : fmtPct(c.gross_margin)}`,
    `   Delivery rate: ${c.delivery_rate === null ? "N/A" : fmtPct(c.delivery_rate)}`,
    `   Attention score: ${
      c.attention_score === null ? "N/A" : `${c.attention_score} (scale 0–100)`
    }`,
  ];
  if (c.risk_partial) {
    lines.push(
      "   Note: some analyses were unavailable for this campaign, so its risk view is partial.",
    );
  }
  lines.push(`   Suggested action: ${c.recommended_action}`);
  return lines.join("\n");
}

/** Finance-facing, pre-formatted rendering of the sanitized payload for the prompt. */
export function renderPayloadForPrompt(payload: AiBriefPayload): string {
  const k = payload.kpis;

  // Total invoice amount
  const invoiceLine = k.invoiceAmount.available
    ? `- Total invoice amount: ${fmtUSD(k.invoiceAmount.value)}${scopeNote(
        k.invoiceAmount.rows,
        k.invoiceAmount.totalRows,
      )}`
    : "- Total invoice amount: N/A — not computable (invoice amounts were not provided)";

  // Expected revenue — tied to invoice-gap analysis availability
  const expectedLine = k.expectedRevenue.available
    ? `- Expected revenue: ${fmtUSD(k.expectedRevenue.value)}${scopeNote(
        k.expectedRevenue.rows,
        k.expectedRevenue.totalRows,
      )}`
    : `- Expected revenue: N/A — cannot be computed (${reasonFor(payload, "Invoice-gap analysis")}).`;

  // Potential leakage — distinguish "computed $0" from "cannot compute"
  let leakageLine: string;
  if (!k.potentialLeakage.available) {
    leakageLine = `- Potential revenue leakage: N/A — cannot be computed because invoice-gap analysis is unavailable (${reasonFor(
      payload,
      "Invoice-gap analysis",
    )}). This is NOT $0.`;
  } else if (k.potentialLeakage.value === 0) {
    leakageLine = `- Potential revenue leakage: $0 — no positive invoice gaps were found across ${k.potentialLeakage.rows} campaign(s) (computed, genuinely zero).`;
  } else {
    leakageLine = `- Potential revenue leakage: ${fmtUSD(
      k.potentialLeakage.value,
    )} (sum of positive invoice gaps across ${k.potentialLeakage.rows} campaign(s)).`;
  }

  // Blended gross margin — tied to margin analysis availability
  const marginLine = k.grossMargin.available
    ? `- Blended gross margin: ${fmtPct(k.grossMargin.value)}${scopeNote(
        k.grossMargin.rows,
        k.grossMargin.totalRows,
      )}`
    : `- Blended gross margin: N/A — cannot be computed (${reasonFor(payload, "Margin analysis")}).`;

  const overview = [
    "PORTFOLIO OVERVIEW",
    `- Campaigns reviewed: ${k.totalCampaigns}`,
    `- Campaigns flagged for review: ${k.flaggedCampaigns}`,
    `- High-risk campaigns: ${k.highRiskCampaigns}`,
    invoiceLine,
    expectedLine,
    leakageLine,
    marginLine,
  ].join("\n");

  const availability = [
    "ANALYSIS AVAILABILITY",
    ...payload.sufficiency.map((d) => `- ${d.analysis}: ${cap(d.status)} — ${d.reason}`),
  ].join("\n");

  const v = payload.validationSummary;
  const validation = [
    "DATA VALIDATION",
    `- Rows: ${v.totalRows} total, ${v.validRows} valid, ${v.rowsWithIssues} with issues (${v.errorCount} errors, ${v.warningCount} warnings)`,
  ].join("\n");

  const campaigns = [
    "CAMPAIGNS (ranked by review priority)",
    ...payload.campaigns.map((c, i) => campaignBlock(c, i + 1)),
  ].join("\n");

  return [overview, availability, validation, campaigns].join("\n\n");
}
