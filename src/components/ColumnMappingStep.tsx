"use client";

import {
  FIELD_DEFS,
  STANDARD_FIELDS,
  ignoredColumns,
  type ColumnMapping,
  type StandardField,
} from "@/lib/column-mapping";
import type { ParsedData } from "@/lib/import-parser";
import StepNav from "./StepNav";

interface ColumnMappingStepProps {
  parsed: ParsedData;
  mapping: ColumnMapping;
  onChange: (field: StandardField, header: string | null) => void;
  onBack: () => void;
  onNext: () => void;
}

const kindBadge: Record<string, string> = {
  string: "bg-slate-100 text-slate-500",
  number: "bg-sky-100 text-sky-700",
  enum: "bg-violet-100 text-violet-700",
};

export default function ColumnMappingStep({
  parsed,
  mapping,
  onChange,
  onBack,
  onNext,
}: ColumnMappingStepProps) {
  const ignored = ignoredColumns(parsed.headers, mapping);
  const mappedCount = STANDARD_FIELDS.filter((f) => mapping[f] !== null).length;
  const firstRow = parsed.rows[0] ?? {};

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Map Columns</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Real exports often use different column names. Mapping normalizes
              messy campaign data before analysis.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
            {mappedCount}/{STANDARD_FIELDS.length} fields mapped
          </span>
        </div>

        <div className="divide-y divide-slate-50">
          {STANDARD_FIELDS.map((field) => {
            const def = FIELD_DEFS[field];
            const selected = mapping[field];
            const sampleValue =
              selected && firstRow[selected] !== undefined ? firstRow[selected] : "";
            return (
              <div
                key={field}
                className="grid grid-cols-1 items-center gap-3 px-6 py-3 sm:grid-cols-12"
              >
                <div className="sm:col-span-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">
                      {def.label}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${kindBadge[def.kind]}`}
                    >
                      {def.kind}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">{field}</span>
                </div>

                <div className="sm:col-span-4">
                  <select
                    value={selected ?? ""}
                    onChange={(e) =>
                      onChange(field, e.target.value === "" ? null : e.target.value)
                    }
                    className={`w-full rounded-lg border bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-400 ${
                      selected ? "border-slate-200 text-slate-800" : "border-slate-200 text-slate-400"
                    }`}
                  >
                    <option value="">— Unmapped (ignore) —</option>
                    {parsed.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-4">
                  {selected ? (
                    <p className="truncate text-xs text-slate-500">
                      <span className="text-slate-400">e.g. </span>
                      <span className="font-mono text-slate-700">
                        {sampleValue === "" ? "(empty)" : sampleValue}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-300">Not mapped</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Ignored source columns ({ignored.length})
        </p>
        {ignored.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">
            Every detected column is mapped to a standard field.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ignored.map((h) => (
              <span
                key={h}
                className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-500 line-through"
              >
                {h}
              </span>
            ))}
          </div>
        )}
      </section>

      <StepNav
        onBack={onBack}
        onNext={onNext}
        nextLabel="Validate data →"
        backLabel="← Back to input"
      />
    </div>
  );
}
