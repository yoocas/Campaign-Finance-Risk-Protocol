import {
  FIELD_DEFS,
  STANDARD_FIELDS,
  type ColumnMapping,
  type StandardField,
} from "@/lib/column-mapping";

/**
 * Display-only helpers for the source-column-oriented Map Columns table.
 *
 * These DO NOT change mapping behavior — `autoMap` and the `ColumnMapping`
 * state remain the single source of truth. This module only derives qualitative
 * labels for the UI (no invented numeric confidence scores), mirroring the
 * fuzzy-match bands that `autoMap` already uses internally.
 */

export type MatchQuality = "high" | "medium" | "low" | "none";
export type MappingStatus = "auto" | "review" | "unmapped";

const normalize = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Qualitative match strength between a source header and a standard field,
 * mirroring the score bands in `autoMap` (exact → high, prefix → medium,
 * substring → low). Returns "none" when there is no textual overlap.
 */
export function matchQuality(header: string, field: StandardField): MatchQuality {
  const h = normalize(header);
  if (h.length === 0) return "none";
  const aliases = [field, ...FIELD_DEFS[field].aliases]
    .map(normalize)
    .filter((a) => a.length > 0);

  let best = 0;
  for (const a of aliases) {
    if (h === a) best = Math.max(best, 3);
    else if (a.length >= 4 && (h.startsWith(a) || a.startsWith(h))) best = Math.max(best, 2);
    else if (a.length >= 4 && h.includes(a)) best = Math.max(best, 1);
  }
  return best === 3 ? "high" : best === 2 ? "medium" : best === 1 ? "low" : "none";
}

export interface SourceColumnRow {
  header: string;
  /** The standard field this source column currently maps to (null = ignored). */
  field: StandardField | null;
  quality: MatchQuality;
  status: MappingStatus;
}

/** Reverse the field→header mapping into per-source-column display rows. */
export function buildSourceRows(
  headers: string[],
  mapping: ColumnMapping,
): SourceColumnRow[] {
  const headerToField = new Map<string, StandardField>();
  for (const field of STANDARD_FIELDS) {
    const header = mapping[field];
    if (header !== null) headerToField.set(header, field);
  }

  return headers.map((header) => {
    const field = headerToField.get(header) ?? null;
    if (field === null) {
      return { header, field: null, quality: "none", status: "unmapped" };
    }
    const quality = matchQuality(header, field);
    // High/medium fuzzy matches read as confident auto-maps; weaker (or
    // manually forced) matches are surfaced for human review.
    const status: MappingStatus =
      quality === "high" || quality === "medium" ? "auto" : "review";
    return { header, field, quality, status };
  });
}

export const QUALITY_LABEL: Record<MatchQuality, string> = {
  high: "High match",
  medium: "Medium match",
  low: "Low match",
  none: "Not mapped",
};

export const STATUS_LABEL: Record<MappingStatus, string> = {
  auto: "Auto-mapped",
  review: "Review",
  unmapped: "Unmapped",
};
