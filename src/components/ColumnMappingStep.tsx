"use client";

import {
  FIELD_DEFS,
  STANDARD_FIELDS,
  type ColumnMapping,
  type StandardField,
} from "@/lib/column-mapping";
import type { ParsedData } from "@/lib/import-parser";
import StepHeader from "./StepHeader";
import {
  buildSourceRows,
  QUALITY_LABEL,
  STATUS_LABEL,
  type MatchQuality,
  type MappingStatus,
} from "./mapping-display";

interface ColumnMappingStepProps {
  parsed: ParsedData;
  mapping: ColumnMapping;
  onChange: (field: StandardField, header: string | null) => void;
  onBack: () => void;
  onNext: () => void;
}

const qualityDots: Record<MatchQuality, { dots: number; color: string; text: string }> = {
  high: { dots: 3, color: "bg-sage", text: "text-sage-deep" },
  medium: { dots: 2, color: "bg-warn", text: "text-warn" },
  low: { dots: 1, color: "bg-danger", text: "text-danger" },
  none: { dots: 0, color: "bg-faint", text: "text-faint" },
};

const statusBadge: Record<MappingStatus, string> = {
  auto: "border-sage-line bg-sage-tint text-sage-deep",
  review: "border-warn-line bg-warn-bg text-warn",
  unmapped: "border-line bg-card-alt text-muted",
};

export default function ColumnMappingStep({
  parsed,
  mapping,
  onChange,
  onBack,
  onNext,
}: ColumnMappingStepProps) {
  const rows = buildSourceRows(parsed.headers, mapping);
  const mappedSourceCols = rows.filter((r) => r.field !== null).length;
  const lowConfidence = rows.filter((r) => r.status === "review").length;
  const mappedFields = STANDARD_FIELDS.filter((f) => mapping[f] !== null).length;
  const fieldsNotProvided = STANDARD_FIELDS.length - mappedFields;

  // Re-point a source column at a different standard field while preserving the
  // field→header invariant (each field maps to at most one header).
  function handleSelect(header: string, currentField: StandardField | null, value: string) {
    const next = value === "" ? null : (value as StandardField);
    if (next === currentField) return;
    if (currentField) onChange(currentField, null);
    if (next) onChange(next, header);
  }

  return (
    <div className="space-y-6">
      <StepHeader
        stepNumber={2}
        title="Map Columns"
        description="Confirm how each source column maps to a standard workflow field. Review low-confidence matches."
        onBack={onBack}
        backLabel="Back"
        onNext={onNext}
        nextLabel="Continue to Validate"
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard
            count={mappedSourceCols}
            label="Source columns mapped"
            tone="auto"
          />
          <SummaryCard
            count={lowConfidence}
            label="Low-confidence mappings"
            tone="review"
          />
          <SummaryCard
            count={fieldsNotProvided}
            label="Standard fields not provided"
            tone="unmapped"
          />
        </div>
        <p className="flex items-center gap-2 text-sm text-muted lg:max-w-[220px]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-sage" aria-hidden />
          {mappedSourceCols} of {rows.length} source columns mapped — unmapped
          columns are ignored.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-line bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-sage-tint/50 text-[11px] uppercase tracking-wide text-sage-deep">
                <th className="px-5 py-3 font-medium">Source column</th>
                <th className="px-5 py-3 font-medium">Standard workflow field</th>
                <th className="px-5 py-3 font-medium">Match quality</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rows.map((row) => {
                const q = qualityDots[row.quality];
                return (
                  <tr key={row.header} className="hover:bg-card-alt/50">
                    <td className="px-5 py-3">
                      <span className="font-mono text-[13px] text-ink">
                        {row.header}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={row.field ?? ""}
                        onChange={(e) =>
                          handleSelect(row.header, row.field, e.target.value)
                        }
                        className={`w-full max-w-[230px] rounded-lg border bg-card px-3 py-1.5 text-sm outline-none focus:border-sage ${
                          row.field
                            ? "border-line text-ink"
                            : "border-dashed border-line text-faint"
                        }`}
                      >
                        <option value="">Select field…</option>
                        {STANDARD_FIELDS.map((f) => (
                          <option key={f} value={f}>
                            {FIELD_DEFS[f].label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex gap-1" aria-hidden>
                          {[0, 1, 2].map((i) => (
                            <span
                              key={i}
                              className={`h-1.5 w-1.5 rounded-full ${
                                i < q.dots ? q.color : "bg-line"
                              }`}
                            />
                          ))}
                        </span>
                        <span className={`text-xs font-medium ${q.text}`}>
                          {QUALITY_LABEL[row.quality]}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusBadge[row.status]}`}
                      >
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: MappingStatus;
}) {
  const toneClass: Record<MappingStatus, string> = {
    auto: "border-sage-line bg-sage-tint/50 text-sage-deep",
    review: "border-warn-line bg-warn-bg text-warn",
    unmapped: "border-line bg-card text-ink-soft",
  };
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${toneClass[tone]}`}>
      <span className="text-2xl font-semibold tabular-nums">{count}</span>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
