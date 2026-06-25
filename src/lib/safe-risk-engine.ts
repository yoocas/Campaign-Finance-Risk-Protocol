import {
  attentionScoreComponent,
  billingScore,
  deliveryScore,
  fmtPct,
  fmtUSD,
  fmtUSDSigned,
  marginScore,
  recommendedAction,
  RISK_WEIGHTS,
  THRESHOLDS,
  type FlagDetail,
  type RiskFlag,
  type RiskLevel,
} from "./risk-engine";
import type { NormalizedRow } from "./data-validation";
import {
  DIMENSIONS,
  rowSupportsDimension,
  type DimensionKey,
  type DimensionSufficiency,
} from "./sufficiency";

/**
 * Safe (partial-data) risk engine.
 *
 * Runs the SAME verified formulas and thresholds as the strict engine, but
 * every input may be missing. A metric is computed only when its inputs are
 * present and valid; otherwise it stays `null` (rendered as "N/A — insufficient
 * data"), never 0, NaN, or Infinity. Risk flags fire only for dimensions whose
 * inputs are available, and the risk score is summed only over those
 * dimensions (flagged `partial` when the row is missing any dimension).
 *
 * On a fully-populated dataset (e.g. the sample), this reproduces the strict
 * engine's numbers exactly.
 */

export interface SafeAnalyzedCampaign {
  rowIndex: number;
  campaign_id: string;
  advertiser: string | null;
  agency: string | null;
  channel: string | null;
  ad_format: string | null;
  start_date: string | null;
  end_date: string | null;
  // Raw numerics (null when missing)
  booked_budget: number | null;
  contracted_cpm: number | null;
  booked_impressions: number | null;
  delivered_impressions: number | null;
  billable_impressions: number | null;
  invoice_amount: number | null;
  publisher_cost: number | null;
  data_cost: number | null;
  creative_cost: number | null;
  attention_score: number | null;
  supply_quality_flag: string | null;
  // Derived (null when not computable)
  expected_revenue: number | null;
  invoice_gap: number | null;
  delivery_rate: number | null;
  total_cost: number | null;
  gross_profit: number | null;
  gross_margin: number | null;
  // Risk assessment
  dimensions: Record<DimensionKey, boolean>;
  flags: FlagDetail[];
  flag_names: RiskFlag[];
  risk_score: number;
  /** Highest score achievable given only the available dimensions. */
  risk_score_max: number;
  /** True when at least one dimension could not be evaluated for this row. */
  risk_partial: boolean;
  /** null when no dimension at all could be evaluated. */
  risk_level: RiskLevel | null;
  recommended_action: string;
}

const numOrNull = (v: number | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const strOrNull = (v: string | undefined): string | null =>
  typeof v === "string" && v !== "" ? v : null;
const fmtInt = (value: number): string => new Intl.NumberFormat("en-US").format(value);

const dimMaxPoints: Record<DimensionKey, number> = {
  billing: RISK_WEIGHTS.billing,
  margin: RISK_WEIGHTS.margin,
  delivery: RISK_WEIGHTS.delivery,
  attention: RISK_WEIGHTS.attention,
  supply: RISK_WEIGHTS.supply,
};

export function analyzeSafeRow(row: NormalizedRow): SafeAnalyzedCampaign {
  const billable = numOrNull(row.billable_impressions);
  const cpm = numOrNull(row.contracted_cpm);
  const invoice = numOrNull(row.invoice_amount);
  const delivered = numOrNull(row.delivered_impressions);
  const booked = numOrNull(row.booked_impressions);
  const pub = numOrNull(row.publisher_cost);
  const data = numOrNull(row.data_cost);
  const creative = numOrNull(row.creative_cost);
  const attention = numOrNull(row.attention_score);
  const supply = strOrNull(row.supply_quality_flag);

  // Which dimensions can be evaluated for this row (shared predicate).
  const dimensions = {
    billing: rowSupportsDimension(row, "billing"),
    margin: rowSupportsDimension(row, "margin"),
    delivery: rowSupportsDimension(row, "delivery"),
    attention: rowSupportsDimension(row, "attention"),
    supply: rowSupportsDimension(row, "supply"),
  } as Record<DimensionKey, boolean>;

  // ---- Derived financials (same formulas as the strict engine) -----------
  const expected_revenue =
    billable !== null && cpm !== null ? (billable / 1000) * cpm : null;
  const invoice_gap =
    expected_revenue !== null && invoice !== null ? expected_revenue - invoice : null;
  const delivery_rate =
    delivered !== null && booked !== null && booked > 0 ? delivered / booked : null;
  const total_cost =
    pub !== null && data !== null && creative !== null ? pub + data + creative : null;
  const gross_profit =
    invoice !== null && total_cost !== null ? invoice - total_cost : null;
  const gross_margin =
    gross_profit !== null && invoice !== null && invoice > 0
      ? gross_profit / invoice
      : null;

  // ---- Flags (only for evaluable dimensions) -----------------------------
  const flags: FlagDetail[] = [];

  if (dimensions.billing && invoice_gap !== null && expected_revenue !== null) {
    if (invoice_gap > THRESHOLDS.billingGap) {
      flags.push({
        flag: "Billing Risk",
        explanation: `Expected revenue exceeds the invoice by ${fmtUSD(invoice_gap)} (${fmtPct(
          expected_revenue > 0 ? invoice_gap / expected_revenue : 0,
        )} of expected) — likely under-billing.`,
      });
    }
  }

  if (dimensions.delivery && delivery_rate !== null && booked !== null && delivered !== null) {
    if (delivery_rate < THRESHOLDS.minDeliveryRate) {
      flags.push({
        flag: "Underdelivery Risk",
        explanation: `Only ${fmtPct(delivery_rate)} of booked impressions delivered (${fmtInt(
          booked - delivered,
        )} short), exposing make-good liability.`,
      });
    }
  }

  if (dimensions.margin && gross_margin !== null && total_cost !== null) {
    if (gross_margin < THRESHOLDS.minMargin) {
      flags.push({
        flag: "Margin Risk",
        explanation: `Gross margin of ${fmtPct(gross_margin)} is below the ${fmtPct(
          THRESHOLDS.minMargin,
          0,
        )} floor on ${fmtUSD(total_cost)} of cost.`,
      });
    }
  }

  if (dimensions.attention && attention !== null && invoice !== null) {
    if (attention < THRESHOLDS.attentionScore && invoice > THRESHOLDS.attentionInvoice) {
      flags.push({
        flag: "Attention Risk",
        explanation: `Attention score of ${attention} on a ${fmtUSD(
          invoice,
        )} invoice signals weak engagement for the spend.`,
      });
    }
  }

  if (dimensions.supply && supply === "review") {
    flags.push({
      flag: "Supply Quality Risk",
      explanation:
        "Supply quality flagged for review — inventory or supply-path integrity is unconfirmed.",
    });
  }

  const flag_names = flags.map((f) => f.flag);

  // ---- Risk score over available dimensions only -------------------------
  let score = 0;
  let scoreMax = 0;
  if (dimensions.billing && invoice_gap !== null && expected_revenue !== null) {
    score += billingScore(invoice_gap, expected_revenue);
    scoreMax += dimMaxPoints.billing;
  }
  if (dimensions.margin && gross_margin !== null) {
    score += marginScore(gross_margin);
    scoreMax += dimMaxPoints.margin;
  }
  if (dimensions.delivery && delivery_rate !== null) {
    score += deliveryScore(delivery_rate);
    scoreMax += dimMaxPoints.delivery;
  }
  if (dimensions.attention) {
    scoreMax += dimMaxPoints.attention;
    if (flag_names.includes("Attention Risk") && attention !== null) {
      score += attentionScoreComponent(attention);
    }
  }
  if (dimensions.supply) {
    scoreMax += dimMaxPoints.supply;
    if (flag_names.includes("Supply Quality Risk")) score += RISK_WEIGHTS.supply;
  }

  const evaluableCount = Object.values(dimensions).filter(Boolean).length;
  const risk_partial = evaluableCount < DIMENSIONS.length;
  const risk_level: RiskLevel | null =
    evaluableCount === 0
      ? null
      : flags.length >= 3
        ? "High"
        : flags.length >= 1
          ? "Medium"
          : "Low";

  const recommended_action =
    evaluableCount === 0
      ? "Insufficient data — map more fields before recommending an action."
      : recommendedAction(flag_names);

  return {
    rowIndex: row.rowIndex,
    campaign_id: strOrNull(row.campaign_id) ?? `Row ${row.rowIndex + 1}`,
    advertiser: strOrNull(row.advertiser),
    agency: strOrNull(row.agency),
    channel: strOrNull(row.channel),
    ad_format: strOrNull(row.ad_format),
    start_date: strOrNull(row.start_date),
    end_date: strOrNull(row.end_date),
    booked_budget: numOrNull(row.booked_budget),
    contracted_cpm: cpm,
    booked_impressions: booked,
    delivered_impressions: delivered,
    billable_impressions: billable,
    invoice_amount: invoice,
    publisher_cost: pub,
    data_cost: data,
    creative_cost: creative,
    attention_score: attention,
    supply_quality_flag: supply,
    expected_revenue,
    invoice_gap,
    delivery_rate,
    total_cost,
    gross_profit,
    gross_margin,
    dimensions,
    flags,
    flag_names,
    risk_score: Math.round(score),
    risk_score_max: Math.round(scoreMax),
    risk_partial,
    risk_level,
    recommended_action,
  };
}

/** Analyze all rows and rank by risk score (rows with no evaluable data sink). */
export function analyzeSafeCampaigns(rows: NormalizedRow[]): SafeAnalyzedCampaign[] {
  const sortKey = (c: SafeAnalyzedCampaign): number =>
    c.risk_level === null ? -1 : c.risk_score;
  return rows
    .map(analyzeSafeRow)
    .sort(
      (a, b) =>
        sortKey(b) - sortKey(a) ||
        (b.invoice_gap ?? -Infinity) - (a.invoice_gap ?? -Infinity) ||
        a.campaign_id.localeCompare(b.campaign_id),
    );
}

// ---- Portfolio KPIs (each carries its own availability) -------------------
export interface KpiMetric {
  available: boolean;
  value: number;
  rows: number; // rows that contributed
  totalRows: number;
}

export interface SafeKpis {
  totalCampaigns: number;
  flaggedCampaigns: number;
  highRiskCampaigns: number;
  invoiceAmount: KpiMetric;
  expectedRevenue: KpiMetric;
  potentialLeakage: KpiMetric;
  grossMargin: KpiMetric;
}

export function computeSafeKpis(list: SafeAnalyzedCampaign[]): SafeKpis {
  const total = list.length;

  const invoiceRows = list.filter((c) => c.invoice_amount !== null);
  const invoiceAmount = invoiceRows.reduce((s, c) => s + (c.invoice_amount ?? 0), 0);

  const expRows = list.filter((c) => c.expected_revenue !== null);
  const expectedRevenue = expRows.reduce((s, c) => s + (c.expected_revenue ?? 0), 0);

  const gapRows = list.filter((c) => c.invoice_gap !== null);
  const potentialLeakage = gapRows.reduce((s, c) => s + Math.max(0, c.invoice_gap ?? 0), 0);

  const marginRows = list.filter((c) => c.gross_margin !== null && (c.invoice_amount ?? 0) > 0);
  const marginGP = marginRows.reduce((s, c) => s + (c.gross_profit ?? 0), 0);
  const marginInvoice = marginRows.reduce((s, c) => s + (c.invoice_amount ?? 0), 0);

  return {
    totalCampaigns: total,
    flaggedCampaigns: list.filter((c) => c.flags.length > 0).length,
    highRiskCampaigns: list.filter((c) => c.risk_level === "High").length,
    invoiceAmount: {
      available: invoiceRows.length > 0,
      value: invoiceAmount,
      rows: invoiceRows.length,
      totalRows: total,
    },
    expectedRevenue: {
      available: expRows.length > 0,
      value: expectedRevenue,
      rows: expRows.length,
      totalRows: total,
    },
    potentialLeakage: {
      available: gapRows.length > 0,
      value: potentialLeakage,
      rows: gapRows.length,
      totalRows: total,
    },
    grossMargin: {
      available: marginRows.length > 0,
      value: marginInvoice > 0 ? marginGP / marginInvoice : 0,
      rows: marginRows.length,
      totalRows: total,
    },
  };
}

// ---- Executive summary (concise, for the Analyze step) --------------------
export function buildSafeSummary(
  list: SafeAnalyzedCampaign[],
  kpis: SafeKpis,
): string {
  if (list.length === 0) return "No rows available to analyze.";

  const top = list.find((c) => c.risk_level !== null) ?? null;
  const leakageClause = kpis.potentialLeakage.available
    ? `Estimated potential revenue leakage is ${fmtUSD(kpis.potentialLeakage.value)}`
    : "Potential leakage is unavailable (invoice-gap inputs are missing)";
  const marginClause = kpis.grossMargin.available
    ? ` at a ${fmtPct(kpis.grossMargin.value)} blended gross margin`
    : "";

  let topClause = "";
  if (top) {
    const flagText = top.flag_names.length > 0 ? joinList(top.flag_names) : "no fired flags";
    topClause = ` The highest-priority campaign is ${top.advertiser ?? top.campaign_id} (${
      top.campaign_id
    }) driven by ${flagText} (risk score ${top.risk_score}${
      top.risk_partial ? ", based on partial data" : ""
    }).`;
  }

  return (
    `This workflow analyzed ${kpis.totalCampaigns} campaign${
      kpis.totalCampaigns === 1 ? "" : "s"
    } and flagged ${kpis.flaggedCampaigns} for review, including ${
      kpis.highRiskCampaigns
    } at high risk. ${leakageClause}${marginClause}.${topClause}`
  );
}

// ---- Analyst brief (Step 5) ----------------------------------------------
export interface BriefSection {
  heading: string;
  lines: string[];
}

export interface Brief {
  sections: BriefSection[];
  text: string;
}

function naUSD(metric: KpiMetric): string {
  return metric.available ? fmtUSD(metric.value) : "N/A — insufficient data";
}

export function buildBrief(
  list: SafeAnalyzedCampaign[],
  kpis: SafeKpis,
  dims: DimensionSufficiency[],
): Brief {
  const sections: BriefSection[] = [];

  // Portfolio summary
  const portfolio: string[] = [
    `Campaigns reviewed: ${kpis.totalCampaigns}`,
    `Campaigns flagged: ${kpis.flaggedCampaigns}`,
    `High-risk campaigns: ${kpis.highRiskCampaigns}`,
    `Total invoice amount: ${naUSD(kpis.invoiceAmount)}${
      kpis.invoiceAmount.available && kpis.invoiceAmount.rows < kpis.invoiceAmount.totalRows
        ? ` (across ${kpis.invoiceAmount.rows}/${kpis.invoiceAmount.totalRows} rows)`
        : ""
    }`,
    `Expected revenue: ${naUSD(kpis.expectedRevenue)}`,
    `Potential leakage: ${naUSD(kpis.potentialLeakage)}`,
    `Blended gross margin: ${
      kpis.grossMargin.available ? fmtPct(kpis.grossMargin.value) : "N/A — insufficient data"
    }`,
  ];
  sections.push({ heading: "Portfolio Summary", lines: portfolio });

  // Highest-risk campaign
  const top = list.find((c) => c.risk_level !== null) ?? null;
  if (top && top.flag_names.length > 0) {
    sections.push({
      heading: "Highest-Risk Campaign",
      lines: [
        `${top.advertiser ?? top.campaign_id} (${top.campaign_id}${
          top.channel ? `, ${top.channel}` : ""
        })`,
        `Risk score ${top.risk_score}${top.risk_partial ? " (partial data)" : ""} — flagged for ${joinList(
          top.flag_names,
        )}.`,
        top.invoice_gap !== null && top.invoice_gap > 0
          ? `Invoice gap of ${fmtUSDSigned(top.invoice_gap)} is recoverable revenue.`
          : `Recommended action: ${top.recommended_action}`,
      ],
    });
  } else {
    sections.push({
      heading: "Highest-Risk Campaign",
      lines: [
        list.length === 0
          ? "No campaigns to assess."
          : "No campaigns crossed a risk threshold on the available data.",
      ],
    });
  }

  // Biggest portfolio risk driver
  const driverCounts = new Map<RiskFlag, number>();
  for (const c of list) for (const f of c.flag_names) driverCounts.set(f, (driverCounts.get(f) ?? 0) + 1);
  if (driverCounts.size > 0) {
    const sorted = [...driverCounts.entries()].sort((a, b) => b[1] - a[1]);
    const [driver, count] = sorted[0];
    sections.push({
      heading: "Biggest Risk Driver",
      lines: [
        `${driver} is the most common issue, affecting ${count} campaign${count === 1 ? "" : "s"}.`,
      ],
    });
  }

  // Ranked finance review actions
  const actionRows = list.filter((c) => c.flags.length > 0).slice(0, 5);
  if (actionRows.length > 0) {
    sections.push({
      heading: "Ranked Finance Review Actions",
      lines: actionRows.map((c, i) => {
        const dollars =
          c.invoice_gap !== null && c.invoice_gap > 0 ? ` (gap ${fmtUSDSigned(c.invoice_gap)})` : "";
        return `${i + 1}. ${c.advertiser ?? c.campaign_id} (${c.campaign_id}) — ${
          c.recommended_action
        }${dollars}`;
      }),
    });
  }

  // Data confidence note
  const byStatus = (status: DimensionSufficiency["status"]) =>
    dims.filter((d) => d.status === status).map((d) => d.analysis);
  const confidence: string[] = [];
  const available = byStatus("available");
  const partial = dims.filter((d) => d.status === "partial");
  const unavailable = dims.filter((d) => d.status === "unavailable");
  if (available.length > 0) confidence.push(`Available: ${available.join(", ")}.`);
  if (partial.length > 0)
    confidence.push(`Partial: ${partial.map((d) => `${d.analysis} (${d.reason})`).join("; ")}.`);
  if (unavailable.length > 0)
    confidence.push(
      `Unavailable: ${unavailable.map((d) => `${d.analysis} (${d.reason})`).join("; ")}.`,
    );
  if (confidence.length === 0) confidence.push("All analysis dimensions available.");
  sections.push({ heading: "Data Confidence", lines: confidence });

  const text = sections
    .map((s) => `${s.heading}\n${s.lines.map((l) => `  ${l}`).join("\n")}`)
    .join("\n\n");

  return { sections, text };
}

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
