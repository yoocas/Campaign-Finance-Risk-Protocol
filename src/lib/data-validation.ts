import {
  FIELD_DEFS,
  STANDARD_FIELDS,
  type ColumnMapping,
  type StandardField,
} from "./column-mapping";
import type { ParsedData } from "./import-parser";

/**
 * Validation + normalization layer.
 *
 * Maps raw string cells onto the standard schema, coercing messy numeric
 * strings and recording row-level issues. Missing values are left `undefined`
 * (honest), never silently coerced to 0. NaN / Infinity can never leave this
 * module — non-finite results become an issue + an undefined value instead.
 */

const NUMBER_FIELDS = STANDARD_FIELDS.filter((f) => FIELD_DEFS[f].kind === "number");
const STRING_FIELDS = STANDARD_FIELDS.filter((f) => FIELD_DEFS[f].kind === "string");

const IMPRESSION_FIELDS: StandardField[] = [
  "booked_impressions",
  "delivered_impressions",
  "billable_impressions",
];
const COST_FIELDS: StandardField[] = [
  "booked_budget",
  "publisher_cost",
  "data_cost",
  "creative_cost",
];

export type IssueSeverity = "error" | "warning";

export interface RowIssue {
  rowIndex: number;
  field?: StandardField;
  message: string;
  severity: IssueSeverity;
}

/** Typed numeric fields (undefined when missing/unmapped). */
export interface NormalizedRow {
  rowIndex: number;
  campaign_id?: string;
  advertiser?: string;
  agency?: string;
  channel?: string;
  ad_format?: string;
  start_date?: string;
  end_date?: string;
  supply_quality_flag?: string;
  booked_budget?: number;
  contracted_cpm?: number;
  booked_impressions?: number;
  delivered_impressions?: number;
  billable_impressions?: number;
  invoice_amount?: number;
  publisher_cost?: number;
  data_cost?: number;
  creative_cost?: number;
  attention_score?: number;
  /** Original mapped source text per field, for display in the UI. */
  raw: Partial<Record<StandardField, string>>;
}

export interface ValidationResult {
  rows: NormalizedRow[];
  issues: RowIssue[];
  totalRows: number;
  /** Rows with no error-severity issues. */
  validRows: number;
  /** Rows with at least one issue (error or warning). */
  rowsWithIssues: number;
  errorCount: number;
  warningCount: number;
}

interface CoercionOutcome {
  value?: number;
  error?: string;
}

/**
 * Coerce a messy numeric string to a finite number.
 *
 * Handles currency symbols, thousands separators, and surrounding whitespace:
 *   "12,000"   -> 12000
 *   "$12,000"  -> 12000
 *   "1,200,000"-> 1200000
 *
 * Percent strings keep their magnitude and are NOT divided by 100
 * ("34%" -> 34, "34.5%" -> 34.5). This is intentional and consistent: no raw
 * input field in this schema is stored as a 0–1 fraction — the only bounded
 * field, attention_score, lives on a 0–100 scale, so "34%" naturally means 34.
 * Returns `{}` for blank input (treated as missing, not an error).
 */
export function coerceNumber(raw: string): CoercionOutcome {
  const trimmed = raw.trim();
  if (trimmed === "") return {};

  let s = trimmed.replace(/[\s,$]/g, "");
  if (s.endsWith("%")) s = s.slice(0, -1);

  if (s === "" || s === "-" || s === "+") return { error: `"${raw}" is not a number` };

  const n = Number(s);
  if (!Number.isFinite(n)) return { error: `"${raw}" is not a number` };
  return { value: n };
}

/** Normalize a supply-quality flag to "ok" | "review", else pass through. */
export function normalizeSupplyFlag(raw: string): string | undefined {
  const s = raw.trim().toLowerCase();
  if (s === "") return undefined;
  if (["review", "flag", "flagged", "r", "fail", "failed", "suspect"].includes(s)) return "review";
  if (["ok", "clean", "pass", "passed", "good", "verified"].includes(s)) return "ok";
  return s; // unknown value: preserved, but won't trigger supply risk
}

/** Normalize and validate all rows against the current column mapping. */
export function validateRows(parsed: ParsedData, mapping: ColumnMapping): ValidationResult {
  const rows: NormalizedRow[] = [];
  const issues: RowIssue[] = [];

  parsed.rows.forEach((sourceRow, rowIndex) => {
    const row: NormalizedRow = { rowIndex, raw: {} };
    // Uniform-typed view for writes: NormalizedRow's per-field value types
    // differ, so a union-keyed write would otherwise collapse to `never`.
    const write = row as Record<StandardField, string | number | undefined>;

    // ---- String fields ----------------------------------------------------
    for (const field of STRING_FIELDS) {
      const header = mapping[field];
      if (!header) continue;
      const value = (sourceRow[header] ?? "").trim();
      row.raw[field] = sourceRow[header] ?? "";
      if (value !== "") write[field] = value;
    }

    // ---- Supply-quality flag (enum) --------------------------------------
    {
      const header = mapping.supply_quality_flag;
      if (header) {
        const original = sourceRow[header] ?? "";
        row.raw.supply_quality_flag = original;
        const normalized = normalizeSupplyFlag(original);
        if (normalized !== undefined) row.supply_quality_flag = normalized;
      }
    }

    // ---- Numeric fields ---------------------------------------------------
    for (const field of NUMBER_FIELDS) {
      const header = mapping[field];
      if (!header) continue;
      const original = sourceRow[header] ?? "";
      row.raw[field] = original;

      const outcome = coerceNumber(original);
      if (outcome.error) {
        issues.push({
          rowIndex,
          field,
          message: `${FIELD_DEFS[field].label}: ${outcome.error}`,
          severity: "error",
        });
        continue;
      }
      if (outcome.value === undefined) continue; // blank → missing
      write[field] = outcome.value;
    }

    // ---- Cross-field validity checks -------------------------------------
    for (const field of IMPRESSION_FIELDS) {
      const v = row[field];
      if (typeof v === "number" && v < 0) {
        issues.push({
          rowIndex,
          field,
          message: `${FIELD_DEFS[field].label}: impressions cannot be negative (${v}).`,
          severity: "error",
        });
        delete row[field];
      }
    }
    for (const field of COST_FIELDS) {
      const v = row[field];
      if (typeof v === "number" && v < 0) {
        issues.push({
          rowIndex,
          field,
          message: `${FIELD_DEFS[field].label}: cost cannot be negative (${v}).`,
          severity: "error",
        });
        delete row[field];
      }
    }
    if (typeof row.invoice_amount === "number") {
      if (row.invoice_amount < 0) {
        issues.push({
          rowIndex,
          field: "invoice_amount",
          message: `Invoice Amount cannot be negative (${row.invoice_amount}).`,
          severity: "error",
        });
        delete row.invoice_amount;
      } else if (row.invoice_amount === 0) {
        issues.push({
          rowIndex,
          field: "invoice_amount",
          message: "Invoice Amount is 0 — margin and attention analysis cannot run for this row.",
          severity: "warning",
        });
      }
    }
    if (typeof row.attention_score === "number") {
      if (row.attention_score < 0 || row.attention_score > 100) {
        issues.push({
          rowIndex,
          field: "attention_score",
          message: `Attention Score ${row.attention_score} is outside the expected 0–100 range.`,
          severity: "warning",
        });
      }
    }
    if (
      typeof row.delivered_impressions === "number" &&
      typeof row.booked_impressions === "number" &&
      row.booked_impressions > 0 &&
      row.delivered_impressions > row.booked_impressions * 1.05
    ) {
      issues.push({
        rowIndex,
        message: "Delivered impressions exceed booked by more than 5% — verify pacing data.",
        severity: "warning",
      });
    }

    rows.push(row);
  });

  const rowsWithError = new Set(issues.filter((i) => i.severity === "error").map((i) => i.rowIndex));
  const rowsAnyIssue = new Set(issues.map((i) => i.rowIndex));

  return {
    rows,
    issues,
    totalRows: rows.length,
    validRows: rows.length - rowsWithError.size,
    rowsWithIssues: rowsAnyIssue.size,
    errorCount: issues.filter((i) => i.severity === "error").length,
    warningCount: issues.filter((i) => i.severity === "warning").length,
  };
}
