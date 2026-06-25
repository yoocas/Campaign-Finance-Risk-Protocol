"use client";

import { FIELD_DEFS } from "@/lib/column-mapping";
import type { ValidationResult } from "@/lib/data-validation";
import {
  summarizeSufficiency,
  type DimensionSufficiency,
  type SufficiencyStatus,
} from "@/lib/sufficiency";
import StepNav from "./StepNav";

interface ValidationStepProps {
  validation: ValidationResult;
  sufficiency: DimensionSufficiency[];
  onBack: () => void;
  onNext: () => void;
}

const statusStyle: Record<
  SufficiencyStatus,
  { badge: string; dot: string; label: string }
> = {
  available: {
    badge: "border-emerald-200 bg-emerald-50",
    dot: "bg-emerald-500",
    label: "Available",
  },
  partial: {
    badge: "border-amber-200 bg-amber-50",
    dot: "bg-amber-500",
    label: "Partial",
  },
  unavailable: {
    badge: "border-rose-200 bg-rose-50",
    dot: "bg-rose-500",
    label: "Unavailable",
  },
};

export default function ValidationStep({
  validation,
  sufficiency,
  onBack,
  onNext,
}: ValidationStepProps) {
  const summary = summarizeSufficiency(sufficiency);
  const issues = validation.issues;

  return (
    <div className="space-y-6">
      {/* Sufficiency summary */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Data Sufficiency</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{summary}</p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {sufficiency.map((dim) => {
            const s = statusStyle[dim.status];
            return (
              <div key={dim.key} className={`rounded-lg border p-3 ${s.badge}`}>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
                  <span className="text-xs font-semibold text-slate-700">
                    {dim.label}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-medium text-slate-600">
                  {s.label}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-slate-500">
                  {dim.reason}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Row counts */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <CountCard label="Rows parsed" value={validation.totalRows} tone="neutral" />
        <CountCard label="Valid rows" value={validation.validRows} tone="positive" />
        <CountCard
          label="Rows with issues"
          value={validation.rowsWithIssues}
          tone={validation.rowsWithIssues > 0 ? "warning" : "neutral"}
        />
        <CountCard
          label="Errors / warnings"
          value={`${validation.errorCount} / ${validation.warningCount}`}
          tone={validation.errorCount > 0 ? "critical" : "neutral"}
        />
      </section>

      {/* Row-level issues */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Row-level issues</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Numeric strings like “$12,000” and “1,200,000” are coerced
            automatically; values that cannot be parsed are flagged here.
          </p>
        </div>
        {issues.length === 0 ? (
          <p className="px-6 py-5 text-sm text-emerald-700">
            No issues detected — every row parsed cleanly.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-[11px] uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">Field</th>
                  <th className="px-3 py-2 font-medium">Severity</th>
                  <th className="px-6 py-2 font-medium">Issue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {issues.slice(0, 100).map((issue, i) => (
                  <tr key={i}>
                    <td className="px-6 py-2 tabular-nums text-slate-500">
                      {issue.rowIndex + 1}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {issue.field ? FIELD_DEFS[issue.field].label : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          issue.severity === "error"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {issue.severity}
                      </span>
                    </td>
                    <td className="px-6 py-2 text-slate-600">{issue.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {issues.length > 100 && (
              <p className="px-6 py-2 text-xs text-slate-400">
                Showing first 100 of {issues.length} issues.
              </p>
            )}
          </div>
        )}
      </section>

      <StepNav
        onBack={onBack}
        onNext={onNext}
        nextLabel="Run analysis →"
        backLabel="← Back to mapping"
      />
    </div>
  );
}

function CountCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "neutral" | "positive" | "warning" | "critical";
}) {
  const toneClass: Record<typeof tone, string> = {
    neutral: "text-slate-900",
    positive: "text-emerald-600",
    warning: "text-amber-600",
    critical: "text-rose-600",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${toneClass[tone]}`}>
        {value}
      </p>
    </div>
  );
}
