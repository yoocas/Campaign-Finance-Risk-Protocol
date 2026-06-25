import Papa from "papaparse";
import { campaigns } from "./campaign-data";
import { STANDARD_FIELDS } from "./column-mapping";

/**
 * Import parsing layer.
 *
 * Turns raw user input (pasted CSV/JSON text, an uploaded CSV file, or the
 * built-in sample dataset) into a uniform, untyped table of string cells.
 * Everything here is intentionally permissive — messy, partial input is
 * expected and is handled honestly downstream (validation / sufficiency).
 */

export type SourceType = "csv" | "json" | "sample";

export interface ParsedData {
  sourceType: SourceType;
  /** Source label shown in the UI (e.g. file name or "Sample dataset"). */
  sourceLabel: string;
  headers: string[];
  /** Row cells keyed by source header; values are always strings. */
  rows: Record<string, string>[];
  rowCount: number;
  /** Fatal or notable parse errors, surfaced to the user. */
  errors: string[];
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** Parse delimited text (CSV/TSV) with header detection. */
export function parseCsv(
  text: string,
  sourceLabel = "Pasted CSV",
  sourceType: SourceType = "csv",
): ParsedData {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const headers = (result.meta.fields ?? []).filter((h) => h.length > 0);
  const rows = (result.data ?? []).map((r) => {
    const obj: Record<string, string> = {};
    for (const h of headers) obj[h] = stringifyValue(r[h]);
    return obj;
  });

  const errors = (result.errors ?? []).map((e) => {
    const where = typeof e.row === "number" ? `Row ${e.row + 1}: ` : "";
    return `${where}${e.message}`;
  });

  if (headers.length === 0) errors.unshift("No columns detected — is this valid CSV?");

  return { sourceType, sourceLabel, headers, rows, rowCount: rows.length, errors };
}

/** Parse a JSON array of campaign-like objects (or `{ data: [...] }`). */
export function parseJson(text: string, sourceLabel = "Pasted JSON"): ParsedData {
  const empty = (errors: string[]): ParsedData => ({
    sourceType: "json",
    sourceLabel,
    headers: [],
    rows: [],
    rowCount: 0,
    errors,
  });

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return empty([`Invalid JSON: ${(e as Error).message}`]);
  }

  let items: unknown[];
  if (Array.isArray(data)) {
    items = data;
  } else if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    items = (data as { data: unknown[] }).data;
  } else {
    return empty(["JSON must be an array of campaign objects (or { data: [...] })."]);
  }

  const headers: string[] = [];
  const rows: Record<string, string>[] = [];
  let skipped = 0;

  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      skipped += 1;
      continue;
    }
    const record = item as Record<string, unknown>;
    const obj: Record<string, string> = {};
    for (const key of Object.keys(record)) {
      if (!headers.includes(key)) headers.push(key);
      obj[key] = stringifyValue(record[key]);
    }
    rows.push(obj);
  }

  // Backfill missing keys so every row shares the full header set.
  for (const row of rows) {
    for (const h of headers) if (!(h in row)) row[h] = "";
  }

  const errors: string[] = [];
  if (rows.length === 0) errors.push("No objects found in JSON array.");
  if (skipped > 0) errors.push(`${skipped} non-object item(s) were skipped.`);

  return { sourceType: "json", sourceLabel, headers, rows, rowCount: rows.length, errors };
}

/**
 * Parse pasted text, auto-detecting JSON (starts with `[`/`{`) vs CSV.
 */
export function parseText(text: string): ParsedData {
  const trimmed = text.trim();
  if (trimmed === "") {
    return {
      sourceType: "csv",
      sourceLabel: "Pasted data",
      headers: [],
      rows: [],
      rowCount: 0,
      errors: ["No input provided — paste CSV or JSON, upload a file, or load the sample."],
    };
  }
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) return parseJson(trimmed);
  return parseCsv(trimmed);
}

/**
 * The verified mock dataset, expressed as a parsed table. Headers are the
 * canonical field names so auto-mapping is an identity map and the downstream
 * numbers reproduce the verified portfolio exactly.
 */
export function sampleDataset(): ParsedData {
  const headers = [...STANDARD_FIELDS];
  const rows = campaigns.map((c) => {
    const record = c as unknown as Record<string, unknown>;
    const obj: Record<string, string> = {};
    for (const f of STANDARD_FIELDS) obj[f] = stringifyValue(record[f]);
    return obj;
  });
  return {
    sourceType: "sample",
    sourceLabel: "Sample dataset (mock/anonymized)",
    headers,
    rows,
    rowCount: rows.length,
    errors: [],
  };
}
