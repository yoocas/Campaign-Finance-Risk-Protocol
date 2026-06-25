import { FIELD_DEFS, type ColumnMapping, type StandardField } from "./column-mapping";
import type { NormalizedRow } from "./data-validation";

/**
 * Data-sufficiency layer.
 *
 * Reports, per analysis dimension, whether the dataset can support it:
 *  - available:   every row has the required, valid inputs
 *  - partial:     some rows are missing inputs
 *  - unavailable: a required field is unmapped, or no row has valid inputs
 *
 * The per-row predicates here are the single source of truth for "can this
 * dimension be computed for this row" and are reused by the safe risk engine,
 * so sufficiency and analysis can never disagree.
 */

export type DimensionKey = "billing" | "margin" | "delivery" | "attention" | "supply";
export type SufficiencyStatus = "available" | "partial" | "unavailable";

export interface DimensionDef {
  key: DimensionKey;
  label: string;
  analysis: string;
  requiredFields: StandardField[];
}

export const DIMENSIONS: DimensionDef[] = [
  {
    key: "billing",
    label: "Invoice gap",
    analysis: "Invoice-gap analysis",
    requiredFields: ["billable_impressions", "contracted_cpm", "invoice_amount"],
  },
  {
    key: "margin",
    label: "Margin",
    analysis: "Margin analysis",
    requiredFields: ["invoice_amount", "publisher_cost", "data_cost", "creative_cost"],
  },
  {
    key: "delivery",
    label: "Delivery",
    analysis: "Delivery analysis",
    requiredFields: ["delivered_impressions", "booked_impressions"],
  },
  {
    key: "attention",
    label: "Attention",
    analysis: "Attention analysis",
    requiredFields: ["attention_score", "invoice_amount"],
  },
  {
    key: "supply",
    label: "Supply quality",
    analysis: "Supply-quality analysis",
    requiredFields: ["supply_quality_flag"],
  },
];

const num = (row: NormalizedRow, field: StandardField): number | undefined => {
  const v = row[field as keyof NormalizedRow];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
};

/**
 * Whether a single row has the valid inputs a dimension needs. Encodes the
 * division/zero guards (e.g. margin needs invoice > 0, delivery needs
 * booked > 0) so analysis never divides by zero.
 */
export function rowSupportsDimension(row: NormalizedRow, key: DimensionKey): boolean {
  switch (key) {
    case "billing":
      return (
        num(row, "billable_impressions") !== undefined &&
        num(row, "contracted_cpm") !== undefined &&
        num(row, "invoice_amount") !== undefined
      );
    case "margin": {
      const invoice = num(row, "invoice_amount");
      return (
        invoice !== undefined &&
        invoice > 0 &&
        num(row, "publisher_cost") !== undefined &&
        num(row, "data_cost") !== undefined &&
        num(row, "creative_cost") !== undefined
      );
    }
    case "delivery": {
      const booked = num(row, "booked_impressions");
      return (
        num(row, "delivered_impressions") !== undefined &&
        booked !== undefined &&
        booked > 0
      );
    }
    case "attention":
      return (
        num(row, "attention_score") !== undefined &&
        num(row, "invoice_amount") !== undefined
      );
    case "supply":
      return typeof row.supply_quality_flag === "string" && row.supply_quality_flag !== "";
    default:
      return false;
  }
}

export interface DimensionSufficiency {
  key: DimensionKey;
  label: string;
  analysis: string;
  status: SufficiencyStatus;
  totalRows: number;
  readyRows: number;
  missingRows: number;
  unmappedFields: StandardField[];
  reason: string;
}

const fieldLabels = (fields: StandardField[]): string =>
  fields.map((f) => FIELD_DEFS[f].label).join(", ");

export function assessSufficiency(
  mapping: ColumnMapping,
  rows: NormalizedRow[],
): DimensionSufficiency[] {
  const totalRows = rows.length;

  return DIMENSIONS.map((dim) => {
    const unmappedFields = dim.requiredFields.filter((f) => mapping[f] === null);

    if (unmappedFields.length > 0) {
      return {
        key: dim.key,
        label: dim.label,
        analysis: dim.analysis,
        status: "unavailable",
        totalRows,
        readyRows: 0,
        missingRows: totalRows,
        unmappedFields,
        reason: `missing required field(s): ${fieldLabels(unmappedFields)}`,
      };
    }

    const readyRows = rows.filter((r) => rowSupportsDimension(r, dim.key)).length;
    const missingRows = totalRows - readyRows;

    let status: SufficiencyStatus;
    let reason: string;
    if (totalRows === 0) {
      status = "unavailable";
      reason = "no rows to analyze";
    } else if (readyRows === totalRows) {
      status = "available";
      reason = `all ${totalRows} rows have valid inputs`;
    } else if (readyRows === 0) {
      status = "unavailable";
      reason = `no rows have valid inputs for ${fieldLabels(dim.requiredFields)}`;
    } else {
      status = "partial";
      reason = `${missingRows} of ${totalRows} rows missing inputs`;
    }

    return {
      key: dim.key,
      label: dim.label,
      analysis: dim.analysis,
      status,
      totalRows,
      readyRows,
      missingRows,
      unmappedFields: [],
      reason,
    };
  });
}

/** One-sentence plain-language summary for the top of the validation step. */
export function summarizeSufficiency(dims: DimensionSufficiency[]): string {
  const supported = dims
    .filter((d) => d.status !== "unavailable")
    .map((d) => (d.status === "partial" ? `${d.analysis} (partial)` : d.analysis));
  const unavailable = dims.filter((d) => d.status === "unavailable");

  const sentences: string[] = [];
  if (supported.length === 0) {
    sentences.push("This dataset does not yet support any analysis.");
  } else {
    sentences.push(`This dataset supports ${joinList(supported)}.`);
  }
  if (unavailable.length > 0) {
    sentences.push(
      `${joinList(unavailable.map((d) => d.analysis))} ${
        unavailable.length === 1 ? "is" : "are"
      } unavailable because ${unavailable.map((d) => d.reason).join("; ")}.`,
    );
  }
  return sentences.join(" ");
}

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
