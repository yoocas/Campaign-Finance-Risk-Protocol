/**
 * Column mapping layer.
 *
 * Real campaign exports rarely use our canonical field names, so before any
 * analysis we map messy source headers onto the standard workflow schema.
 * Mapping is deterministic fuzzy matching — no LLM, no randomness.
 */

export const STANDARD_FIELDS = [
  "campaign_id",
  "advertiser",
  "agency",
  "channel",
  "ad_format",
  "start_date",
  "end_date",
  "booked_budget",
  "contracted_cpm",
  "booked_impressions",
  "delivered_impressions",
  "billable_impressions",
  "invoice_amount",
  "publisher_cost",
  "data_cost",
  "creative_cost",
  "attention_score",
  "supply_quality_flag",
] as const;

export type StandardField = (typeof STANDARD_FIELDS)[number];

export type FieldKind = "string" | "number" | "enum";

export interface FieldDef {
  field: StandardField;
  label: string;
  kind: FieldKind;
  /** Human-friendly aliases used for fuzzy header matching. */
  aliases: string[];
}

export const FIELD_DEFS: Record<StandardField, FieldDef> = {
  campaign_id: {
    field: "campaign_id",
    label: "Campaign ID",
    kind: "string",
    aliases: ["campaign id", "campaign", "campaignid", "id", "cid", "line item id"],
  },
  advertiser: {
    field: "advertiser",
    label: "Advertiser",
    kind: "string",
    aliases: ["advertiser", "client", "brand", "advertiser name"],
  },
  agency: {
    field: "agency",
    label: "Agency",
    kind: "string",
    aliases: ["agency", "agency name", "buying agency", "holding company"],
  },
  channel: {
    field: "channel",
    label: "Channel",
    kind: "string",
    aliases: ["channel", "media channel", "inventory type", "environment", "medium"],
  },
  ad_format: {
    field: "ad_format",
    label: "Ad Format",
    kind: "string",
    aliases: ["ad format", "format", "creative format", "unit", "ad unit"],
  },
  start_date: {
    field: "start_date",
    label: "Start Date",
    kind: "string",
    aliases: ["start date", "start", "flight start", "begin date", "start_date"],
  },
  end_date: {
    field: "end_date",
    label: "End Date",
    kind: "string",
    aliases: ["end date", "end", "flight end", "finish date", "end_date"],
  },
  booked_budget: {
    field: "booked_budget",
    label: "Booked Budget",
    kind: "number",
    aliases: ["booked budget", "budget", "io budget", "contracted budget", "order budget"],
  },
  contracted_cpm: {
    field: "contracted_cpm",
    label: "Contracted CPM",
    kind: "number",
    aliases: ["contracted cpm", "cpm", "rate", "net cpm", "cpm rate", "unit rate"],
  },
  booked_impressions: {
    field: "booked_impressions",
    label: "Booked Impressions",
    kind: "number",
    aliases: [
      "booked impressions",
      "booked imps",
      "ordered impressions",
      "contracted impressions",
      "goal impressions",
    ],
  },
  delivered_impressions: {
    field: "delivered_impressions",
    label: "Delivered Impressions",
    kind: "number",
    aliases: [
      "delivered impressions",
      "delivered imps",
      "served impressions",
      "impressions delivered",
      "actual impressions",
    ],
  },
  billable_impressions: {
    field: "billable_impressions",
    label: "Billable Impressions",
    kind: "number",
    aliases: [
      "billable impressions",
      "billable imps",
      "net imps",
      "net impressions",
      "billed impressions",
    ],
  },
  invoice_amount: {
    field: "invoice_amount",
    label: "Invoice Amount",
    kind: "number",
    aliases: [
      "invoice amount",
      "invoice total",
      "net amount",
      "invoice",
      "amount invoiced",
      "billing amount",
    ],
  },
  publisher_cost: {
    field: "publisher_cost",
    label: "Publisher Cost",
    kind: "number",
    aliases: ["publisher cost", "media cost", "supply cost", "pub cost", "inventory cost"],
  },
  data_cost: {
    field: "data_cost",
    label: "Data Cost",
    kind: "number",
    aliases: ["data cost", "data fees", "audience cost", "data spend"],
  },
  creative_cost: {
    field: "creative_cost",
    label: "Creative Cost",
    kind: "number",
    aliases: ["creative cost", "production cost", "creative fees", "creative spend"],
  },
  attention_score: {
    field: "attention_score",
    label: "Attention Score",
    kind: "number",
    aliases: ["attention score", "attention", "attn", "attn score"],
  },
  supply_quality_flag: {
    field: "supply_quality_flag",
    label: "Supply Quality Flag",
    kind: "enum",
    aliases: [
      "supply quality flag",
      "supply quality",
      "supply flag",
      "quality flag",
      "supply quality status",
      "ivt flag",
    ],
  },
};

export type ColumnMapping = Record<StandardField, string | null>;

/** Strip everything but lowercase alphanumerics for tolerant comparison. */
const normalize = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Auto-guess a mapping from detected headers using deterministic fuzzy
 * matching. Each source header is assigned to at most one standard field; the
 * strongest match wins. Fields with no plausible match stay `null` (unmapped).
 */
export function autoMap(headers: string[]): ColumnMapping {
  const used = new Set<string>();
  const mapping = {} as ColumnMapping;
  const normHeaders = headers.map((h) => ({ raw: h, n: normalize(h) }));

  for (const field of STANDARD_FIELDS) {
    const aliases = [field, ...FIELD_DEFS[field].aliases]
      .map(normalize)
      .filter((a) => a.length > 0);

    let best: { raw: string; score: number } | null = null;
    for (const h of normHeaders) {
      if (used.has(h.raw) || h.n.length === 0) continue;
      let score = 0;
      for (const a of aliases) {
        if (h.n === a) score = Math.max(score, 100);
        else if (a.length >= 4 && (h.n.startsWith(a) || a.startsWith(h.n)))
          score = Math.max(score, 60);
        else if (a.length >= 4 && h.n.includes(a)) score = Math.max(score, 40);
      }
      if (score > 0 && (best === null || score > best.score)) {
        best = { raw: h.raw, score };
      }
    }

    if (best) {
      mapping[field] = best.raw;
      used.add(best.raw);
    } else {
      mapping[field] = null;
    }
  }

  return mapping;
}

/** Source headers that are not mapped to any standard field (ignored). */
export function ignoredColumns(headers: string[], mapping: ColumnMapping): string[] {
  const mapped = new Set(Object.values(mapping).filter((v): v is string => v !== null));
  return headers.filter((h) => !mapped.has(h));
}
