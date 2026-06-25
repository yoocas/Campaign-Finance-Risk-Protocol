import type { Campaign } from "./campaign-data";
import { campaigns } from "./campaign-data";

/**
 * Deterministic finance risk engine.
 *
 * Every number here is plain TypeScript arithmetic — no LLM, no randomness.
 * Given the fixed campaign dataset, the output is identical on every render.
 */

export const RISK_FLAGS = [
  "Billing Risk",
  "Underdelivery Risk",
  "Margin Risk",
  "Attention Risk",
  "Supply Quality Risk",
] as const;

export type RiskFlag = (typeof RISK_FLAGS)[number];
export type RiskLevel = "High" | "Medium" | "Low";

// ---- Thresholds (single source of truth, surfaced in the UI) -------------
export const THRESHOLDS = {
  billingGap: 5000, // invoice_gap above this $ amount is a billing risk
  minMargin: 0.35, // gross_margin below this is a margin risk
  minDeliveryRate: 0.9, // delivery_rate below this is underdelivery
  attentionScore: 50, // attention_score below this ...
  attentionInvoice: 25000, // ... on invoices above this $ amount
} as const;

export interface FlagDetail {
  flag: RiskFlag;
  explanation: string;
}

export interface AnalyzedCampaign extends Campaign {
  // Derived financials
  expected_revenue: number;
  invoice_gap: number;
  delivery_rate: number;
  total_cost: number;
  gross_profit: number;
  gross_margin: number;
  // Risk assessment
  flags: FlagDetail[];
  flag_names: RiskFlag[];
  risk_score: number;
  risk_level: RiskLevel;
  recommended_action: string;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

// ---- Formatting helpers (deterministic, locale-pinned) -------------------
const usd0 = new Intl.NumberFormat("en-US", {
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

export const fmtUSD = (value: number): string => usd0.format(value);
export const fmtUSDSigned = (value: number): string => usdSigned.format(value);
export const fmtPct = (ratio: number, digits = 1): string =>
  `${(ratio * 100).toFixed(digits)}%`;
export const fmtInt = (value: number): string =>
  new Intl.NumberFormat("en-US").format(value);

/**
 * Per-dimension maximum point contribution to the 0–100 risk score.
 * Exported so the partial-data ("safe") engine can scale a score to only the
 * dimensions it was actually able to evaluate.
 */
export const RISK_WEIGHTS = {
  billing: 30,
  margin: 25,
  delivery: 25,
  attention: 12,
  supply: 8,
} as const;

// ---- Risk-score components (severity-weighted, deterministic) -------------
// Each returns 0 when the metric is healthy and scales up to its full weight
// as the metric worsens. Extracted as named functions so the strict engine
// and the safe (partial-data) engine compute identical numbers per dimension.
export function billingScore(invoiceGap: number, expectedRevenue: number): number {
  if (!(expectedRevenue > 0)) return 0;
  return (
    clamp(Math.max(0, invoiceGap) / expectedRevenue / 0.12, 0, 1) *
    RISK_WEIGHTS.billing
  );
}
export function marginScore(grossMargin: number): number {
  return (
    clamp(Math.max(0, THRESHOLDS.minMargin - grossMargin) / 0.25, 0, 1) *
    RISK_WEIGHTS.margin
  );
}
export function deliveryScore(deliveryRate: number): number {
  return (
    clamp(Math.max(0, THRESHOLDS.minDeliveryRate - deliveryRate) / 0.15, 0, 1) *
    RISK_WEIGHTS.delivery
  );
}
export function attentionScoreComponent(attentionValue: number): number {
  return (
    clamp((THRESHOLDS.attentionScore - attentionValue) / 20, 0, 1) *
    RISK_WEIGHTS.attention
  );
}

/**
 * Recommended next action, chosen by the highest-priority active flag.
 * Priority reflects what a finance/ops team would chase first: recoverable
 * dollars (billing, make-goods) before quality concerns.
 */
export function recommendedAction(flagNames: RiskFlag[]): string {
  if (flagNames.includes("Billing Risk"))
    return "Reconcile billable impressions and reissue a corrected invoice.";
  if (flagNames.includes("Underdelivery Risk"))
    return "Open a make-good / credit and confirm pacing with ad ops.";
  if (flagNames.includes("Margin Risk"))
    return "Review cost allocation and renegotiate supply or data fees.";
  if (flagNames.includes("Supply Quality Risk"))
    return "Audit the supply path and pause low-quality inventory.";
  if (flagNames.includes("Attention Risk"))
    return "Validate creative and placement quality before renewal.";
  return "Within tolerance — no finance action required.";
}

/** Compute all derived financials, flags, score, and level for one campaign. */
export function analyzeCampaign(c: Campaign): AnalyzedCampaign {
  const expected_revenue = (c.billable_impressions / 1000) * c.contracted_cpm;
  const invoice_gap = expected_revenue - c.invoice_amount;
  const delivery_rate = c.delivered_impressions / c.booked_impressions;
  const total_cost = c.publisher_cost + c.data_cost + c.creative_cost;
  const gross_profit = c.invoice_amount - total_cost;
  const gross_margin = gross_profit / c.invoice_amount;

  const flags: FlagDetail[] = [];

  if (invoice_gap > THRESHOLDS.billingGap) {
    flags.push({
      flag: "Billing Risk",
      explanation: `Expected revenue exceeds the invoice by ${fmtUSD(
        invoice_gap,
      )} (${fmtPct(invoice_gap / expected_revenue)} of expected) — likely under-billing.`,
    });
  }

  if (delivery_rate < THRESHOLDS.minDeliveryRate) {
    flags.push({
      flag: "Underdelivery Risk",
      explanation: `Only ${fmtPct(delivery_rate)} of booked impressions delivered (${fmtInt(
        c.booked_impressions - c.delivered_impressions,
      )} short), exposing make-good liability.`,
    });
  }

  if (gross_margin < THRESHOLDS.minMargin) {
    flags.push({
      flag: "Margin Risk",
      explanation: `Gross margin of ${fmtPct(
        gross_margin,
      )} is below the ${fmtPct(THRESHOLDS.minMargin, 0)} floor on ${fmtUSD(
        total_cost,
      )} of cost.`,
    });
  }

  if (
    c.attention_score < THRESHOLDS.attentionScore &&
    c.invoice_amount > THRESHOLDS.attentionInvoice
  ) {
    flags.push({
      flag: "Attention Risk",
      explanation: `Attention score of ${c.attention_score} on a ${fmtUSD(
        c.invoice_amount,
      )} invoice signals weak engagement for the spend.`,
    });
  }

  if (c.supply_quality_flag === "review") {
    flags.push({
      flag: "Supply Quality Risk",
      explanation:
        "Supply quality flagged for review — inventory or supply-path integrity is unconfirmed.",
    });
  }

  const flag_names = flags.map((f) => f.flag);

  // ---- Deterministic 0–100 risk score ------------------------------------
  // Weighted by severity, capped so the max realistic profile lands near 100.
  // Uses the shared component functions so the safe engine matches exactly.
  const billingComponent = billingScore(invoice_gap, expected_revenue);
  const marginComponent = marginScore(gross_margin);
  const deliveryComponent = deliveryScore(delivery_rate);
  const attentionComponent = flag_names.includes("Attention Risk")
    ? attentionScoreComponent(c.attention_score)
    : 0;
  const supplyComponent = flag_names.includes("Supply Quality Risk")
    ? RISK_WEIGHTS.supply
    : 0;

  const risk_score = Math.round(
    billingComponent +
      marginComponent +
      deliveryComponent +
      attentionComponent +
      supplyComponent,
  );

  const risk_level: RiskLevel =
    flags.length >= 3 ? "High" : flags.length >= 1 ? "Medium" : "Low";

  return {
    ...c,
    expected_revenue,
    invoice_gap,
    delivery_rate,
    total_cost,
    gross_profit,
    gross_margin,
    flags,
    flag_names,
    risk_score,
    risk_level,
    recommended_action: recommendedAction(flag_names),
  };
}

/** Analyze every campaign and rank by risk_score (highest first). */
export function analyzeCampaigns(
  list: readonly Campaign[] = campaigns,
): AnalyzedCampaign[] {
  return list
    .map(analyzeCampaign)
    .sort(
      (a, b) =>
        b.risk_score - a.risk_score ||
        b.invoice_gap - a.invoice_gap ||
        a.campaign_id.localeCompare(b.campaign_id),
    );
}

export interface PortfolioKpis {
  totalCampaigns: number;
  totalInvoiceAmount: number;
  totalExpectedRevenue: number;
  potentialLeakage: number; // sum of positive invoice gaps
  avgGrossMargin: number; // invoice-weighted
  campaignsFlagged: number;
  highRiskCampaigns: number;
}

/** Aggregate portfolio-level KPIs from analyzed campaigns. */
export function computeKpis(analyzed: AnalyzedCampaign[]): PortfolioKpis {
  const totalInvoiceAmount = analyzed.reduce(
    (sum, c) => sum + c.invoice_amount,
    0,
  );
  const totalGrossProfit = analyzed.reduce((sum, c) => sum + c.gross_profit, 0);

  return {
    totalCampaigns: analyzed.length,
    totalInvoiceAmount,
    totalExpectedRevenue: analyzed.reduce(
      (sum, c) => sum + c.expected_revenue,
      0,
    ),
    potentialLeakage: analyzed.reduce(
      (sum, c) => sum + Math.max(0, c.invoice_gap),
      0,
    ),
    avgGrossMargin:
      totalInvoiceAmount > 0 ? totalGrossProfit / totalInvoiceAmount : 0,
    campaignsFlagged: analyzed.filter((c) => c.flags.length > 0).length,
    highRiskCampaigns: analyzed.filter((c) => c.risk_level === "High").length,
  };
}

/** Deterministic CFO-brief executive summary text. */
export function buildExecutiveSummary(
  analyzed: AnalyzedCampaign[],
  kpis: PortfolioKpis,
): string {
  if (analyzed.length === 0) return "No campaigns available to review.";

  const top = analyzed[0];
  const flagList = formatList(top.flag_names);
  const flagClause =
    top.flags.length > 0
      ? ` driven by ${flagList} (risk score ${top.risk_score}/100)`
      : "";

  return (
    `This prototype reviewed ${kpis.totalCampaigns} campaigns and flagged ` +
    `${kpis.campaignsFlagged} for finance review, including ${kpis.highRiskCampaigns} ` +
    `at high risk. Estimated potential revenue leakage across the portfolio is ` +
    `${fmtUSD(kpis.potentialLeakage)}, against ${fmtUSD(
      kpis.totalInvoiceAmount,
    )} invoiced at a ${fmtPct(kpis.avgGrossMargin)} blended gross margin. ` +
    `The highest-priority campaign is ${top.advertiser} (${top.campaign_id}, ${top.channel})` +
    `${flagClause}. Recommended first action: ${top.recommended_action}`
  );
}

/** Oxford-comma list join for flag names ("A", "A and B", "A, B, and C"). */
function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
