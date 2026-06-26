"use client";

import type { ValidationResult } from "@/lib/data-validation";
import {
  type DimensionKey,
  type DimensionSufficiency,
  type SufficiencyStatus,
} from "@/lib/sufficiency";
import StepHeader from "./StepHeader";
import { confidenceBand } from "./confidence";

interface ValidationStepProps {
  validation: ValidationResult;
  sufficiency: DimensionSufficiency[];
  dataConfidence: number | null;
  onBack: () => void;
  onNext: () => void;
}

const DIM_SUBTITLE: Record<DimensionKey, string> = {
  billing: "Invoice vs. expected revenue reconciliation",
  margin: "Gross margin against profitability thresholds",
  delivery: "Delivered vs. contracted impressions",
  attention: "Viewability & attention signal coverage",
  supply: "Vendor / SSP fraud & quality exposure",
};

const statusStyle: Record<
  SufficiencyStatus,
  { badge: string; bar: string; label: string }
> = {
  available: {
    badge: "border-sage-line bg-sage-tint text-sage-deep",
    bar: "bg-sage",
    label: "Available",
  },
  partial: {
    badge: "border-warn-line bg-warn-bg text-warn",
    bar: "bg-warn",
    label: "Partial",
  },
  unavailable: {
    badge: "border-line bg-card-alt text-muted",
    bar: "bg-faint",
    label: "Unavailable",
  },
};

const ISSUE_CAP = 50;

export default function ValidationStep({
  validation,
  sufficiency,
  dataConfidence,
  onBack,
  onNext,
}: ValidationStepProps) {
  const issues = validation.issues;
  const shown = issues.slice(0, ISSUE_CAP);
  const band = confidenceBand(dataConfidence);

  // N/A explanation built from real sufficiency results (not zeroed values).
  const blocked = sufficiency.filter((d) => d.status !== "available");
  const naDetail =
    blocked.length === 0
      ? "Every analysis dimension is fully computable from the provided data."
      : blocked
          .map(
            (d) =>
              `${d.analysis} is ${d.status === "partial" ? "partial" : "unavailable"} — ${d.reason}.`,
          )
          .join(" ");

  return (
    <div className="space-y-6">
      <StepHeader
        stepNumber={3}
        title="Validate"
        description="Confirm data quality and which analyses your dataset can actually support before running."
        onBack={onBack}
        backLabel="Back"
        onNext={onNext}
        nextLabel="Run Analysis"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile label="Rows Reviewed" value={validation.totalRows.toLocaleString()} />
        <KpiTile
          label="Valid Rows"
          value={validation.validRows.toLocaleString()}
          tone="text-sage"
        />
        <KpiTile
          label="Rows With Issues"
          value={validation.rowsWithIssues.toLocaleString()}
          tone={validation.rowsWithIssues > 0 ? "text-warn" : "text-ink"}
        />
        <KpiTile
          label="Data Confidence"
          value={dataConfidence === null ? "N/A" : `${dataConfidence}%`}
          suffix={dataConfidence === null ? undefined : band.label}
          tone={band.tone}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sufficiency matrix */}
        <section className="rounded-xl border border-line bg-card p-5">
          <h3 className="text-sm font-semibold text-ink">Analysis sufficiency matrix</h3>
          <p className="mt-0.5 text-xs text-muted">
            What each analysis can be computed from the provided data
          </p>

          <div className="mt-4 space-y-4">
            {sufficiency.map((dim) => {
              const s = statusStyle[dim.status];
              const pct =
                dim.totalRows > 0
                  ? Math.round((dim.readyRows / dim.totalRows) * 100)
                  : 0;
              return (
                <div key={dim.key}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{dim.analysis}</p>
                      <p className="text-xs text-muted">{DIM_SUBTITLE[dim.key]}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-line-soft sm:block">
                        <div
                          className={`h-full rounded-full ${s.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-9 text-right text-xs font-semibold tabular-nums text-ink-soft">
                        {pct}%
                      </span>
                      <span
                        className={`inline-flex w-[88px] justify-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.badge}`}
                      >
                        {s.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-5 rounded-lg border border-warn-line bg-warn-bg px-4 py-3 text-xs leading-relaxed text-warn">
            <span className="font-semibold">N/A means not computable, not zero.</span>{" "}
            {naDetail}
          </p>
        </section>

        {/* Rows needing attention */}
        <section className="overflow-hidden rounded-xl border border-line bg-card">
          <div className="flex flex-col gap-2 border-b border-line-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">Rows needing attention</h3>
              <p className="mt-0.5 text-xs text-muted">
                {issues.length === 0
                  ? "No row-level issues detected"
                  : `${shown.length} of ${issues.length} shown · excluded until resolved`}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <span className="rounded-full bg-danger-bg px-2.5 py-0.5 text-[11px] font-medium text-danger">
                {validation.errorCount} errors
              </span>
              <span className="rounded-full bg-warn-bg px-2.5 py-0.5 text-[11px] font-medium text-warn">
                {validation.warningCount} warnings
              </span>
            </div>
          </div>

          {issues.length === 0 ? (
            <p className="px-5 py-6 text-sm text-sage-deep">
              No issues detected — every row parsed cleanly.
            </p>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-card text-[11px] uppercase tracking-wide text-muted">
                  <tr className="border-b border-line-soft">
                    <th className="px-5 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium">Field</th>
                    <th className="px-5 py-2 font-medium">Issue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {shown.map((issue, i) => (
                    <tr key={i}>
                      <td className="px-5 py-2.5 tabular-nums text-muted">
                        {issue.rowIndex + 1}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-ink-soft">
                        {issue.field ?? "—"}
                      </td>
                      <td className="px-5 py-2.5">
                        <span className="flex items-start gap-2">
                          <span
                            className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                              issue.severity === "error"
                                ? "bg-danger-bg text-danger"
                                : "bg-warn-bg text-warn"
                            }`}
                          >
                            {issue.severity}
                          </span>
                          <span className="text-[13px] leading-snug text-ink-soft">
                            {issue.message}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  suffix,
  tone = "text-ink",
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-2 flex items-baseline gap-2">
        <span className={`text-2xl font-semibold tabular-nums ${tone}`}>{value}</span>
        {suffix && <span className={`text-xs font-medium ${tone}`}>{suffix}</span>}
      </p>
    </div>
  );
}
