"use client";

import { useState } from "react";
import { fmtPct, fmtUSD, fmtUSDSigned, type RiskLevel } from "@/lib/risk-engine";
import type { SafeAnalyzedCampaign, SafeKpis } from "@/lib/safe-risk-engine";
import type { DimensionKey, DimensionSufficiency } from "@/lib/sufficiency";
import KpiCard from "./KpiCard";
import StepHeader from "./StepHeader";
import { riskLevelBadge, riskLevelDot } from "./risk-styles";

interface AnalysisStepProps {
  campaigns: SafeAnalyzedCampaign[];
  kpis: SafeKpis;
  sufficiency: DimensionSufficiency[];
  dataConfidence: number | null;
  onBack: () => void;
  onNext: () => void;
}

const NA = "N/A — insufficient data";
const fmtPctOrNA = (v: number | null): string => (v === null ? "N/A" : fmtPct(v));
const metricUSD = (v: number | null): string => (v === null ? NA : fmtUSD(v));

const COVERAGE_DIMS: { key: DimensionKey; label: string }[] = [
  { key: "billing", label: "Invoice-gap" },
  { key: "margin", label: "Margin" },
  { key: "delivery", label: "Delivery" },
  { key: "attention", label: "Attention" },
  { key: "supply", label: "Supply" },
];

function coverageSub(rows: number, totalRows: number, fallback: string): string {
  return rows < totalRows ? `across ${rows}/${totalRows} rows` : fallback;
}

export default function AnalysisStep({
  campaigns,
  kpis,
  sufficiency,
  dataConfidence,
  onBack,
  onNext,
}: AnalysisStepProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  // Default to the highest-priority flagged campaign. `campaigns` is sorted by
  // risk score desc then invoice gap, so the first flagged row satisfies
  // "highest risk_score with flags, tie-broken by invoice gap". Falls back to
  // the top row when nothing is flagged. User clicks always win.
  const defaultCampaign =
    campaigns.find((c) => c.flag_names.length > 0) ?? campaigns[0] ?? null;
  const selected =
    campaigns.find((c) => c.rowIndex === selectedIndex) ?? defaultCampaign;

  const lk = kpis.potentialLeakage;
  const leakageSub = !lk.available
    ? "invoice-gap inputs missing"
    : lk.value === 0 && lk.rows < lk.totalRows
      ? "$0 in computable rows — partial coverage"
      : coverageSub(lk.rows, lk.totalRows, "sum of positive invoice gaps");

  const degraded = sufficiency.filter((d) => d.status !== "available");

  return (
    <div className="space-y-5">
      <StepHeader
        stepNumber={4}
        title="Analyze"
        description="Revenue leakage and margin risk across campaigns. Select a row to inspect drivers and coverage."
        onBack={onBack}
        backLabel="Back"
        onNext={onNext}
        nextLabel="Generate Brief"
      />

      {/* KPI row */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Total Invoice Amount"
          value={kpis.invoiceAmount.available ? fmtUSD(kpis.invoiceAmount.value) : NA}
          sub={coverageSub(
            kpis.invoiceAmount.rows,
            kpis.invoiceAmount.totalRows,
            `${kpis.totalCampaigns} campaigns`,
          )}
        />
        <KpiCard
          label="Expected Revenue"
          value={
            kpis.expectedRevenue.available ? fmtUSD(kpis.expectedRevenue.value) : NA
          }
          sub={coverageSub(
            kpis.expectedRevenue.rows,
            kpis.expectedRevenue.totalRows,
            "modeled",
          )}
        />
        <KpiCard
          label="Potential Leakage"
          value={lk.available ? fmtUSD(lk.value) : NA}
          sub={leakageSub}
          tone={lk.available ? "critical" : "neutral"}
        />
        <KpiCard
          label="Avg Gross Margin"
          value={kpis.grossMargin.available ? fmtPct(kpis.grossMargin.value) : NA}
          sub={coverageSub(
            kpis.grossMargin.rows,
            kpis.grossMargin.totalRows,
            "analyzable rows",
          )}
          tone={
            !kpis.grossMargin.available
              ? "neutral"
              : kpis.grossMargin.value < 0.35
                ? "warning"
                : "positive"
          }
        />
        <KpiCard
          label="Campaigns Flagged"
          value={String(kpis.flaggedCampaigns)}
          sub={`of ${kpis.totalCampaigns}`}
          tone="warning"
        />
        <KpiCard
          label="High-Risk Campaigns"
          value={String(kpis.highRiskCampaigns)}
          sub="needs review"
          tone="critical"
        />
      </section>

      <p className="text-[11px] leading-snug text-muted">
        Potential leakage sums positive invoice gaps; billing-risk flags only
        fire above the review threshold, so a Low-risk campaign can still carry a
        small positive gap.
      </p>

      {/* Coverage / confidence strip */}
      <section
        className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
          degraded.length > 0
            ? "border-warn-line bg-warn-bg"
            : "border-sage-line bg-sage-tint/50"
        }`}
      >
        <p
          className={`flex items-start gap-2 text-xs leading-relaxed ${
            degraded.length > 0 ? "text-warn" : "text-sage-deep"
          }`}
        >
          <span
            className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
              degraded.length > 0 ? "bg-warn" : "bg-sage"
            }`}
            aria-hidden
          />
          {degraded.length > 0
            ? `${degraded
                .map((d) =>
                  d.status === "partial"
                    ? `${d.analysis} covers ${Math.round(
                        (d.readyRows / Math.max(1, d.totalRows)) * 100,
                      )}% of rows`
                    : `${d.analysis} is unavailable`,
                )
                .join(" · ")}. N/A means not computable, not zero.`
            : `All analysis dimensions are fully computable across ${kpis.totalCampaigns} campaigns. N/A means not computable, not zero.`}
        </p>
        {dataConfidence !== null && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted">Data confidence</span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line-soft">
              <div
                className="h-full rounded-full bg-sage"
                style={{ width: `${dataConfidence}%` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-sage">
              {dataConfidence}%
            </span>
          </div>
        )}
      </section>

      {/* Table + detail */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-xl border border-line bg-card">
          <div className="flex items-center justify-between border-b border-sage-line bg-sage-tint/40 px-5 py-3">
            <h3 className="text-sm font-semibold text-ink">
              Campaigns ranked by leakage risk
            </h3>
            <span className="text-xs text-muted">{campaigns.length} campaigns</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b border-line-soft text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-5 py-2.5 font-medium">Campaign</th>
                  <th className="px-3 py-2.5 text-right font-medium">Invoice</th>
                  <th className="px-3 py-2.5 text-right font-medium">Expected</th>
                  <th className="px-3 py-2.5 text-right font-medium">Leakage</th>
                  <th className="px-3 py-2.5 text-right font-medium">Margin</th>
                  <th className="px-5 py-2.5 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {campaigns.map((c) => {
                  const isSelected = c.rowIndex === selected?.rowIndex;
                  const leak =
                    c.invoice_gap === null
                      ? "N/A"
                      : c.invoice_gap > 0
                        ? fmtUSD(c.invoice_gap)
                        : "—";
                  return (
                    <tr
                      key={c.rowIndex}
                      onClick={() => setSelectedIndex(c.rowIndex)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-sage-tint/60"
                          : "hover:bg-card-alt/60"
                      }`}
                    >
                      <td
                        className={`px-5 py-3 ${
                          isSelected ? "border-l-2 border-sage" : "border-l-2 border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              c.risk_level ? riskLevelDot[c.risk_level] : "bg-faint"
                            }`}
                            aria-hidden
                          />
                          <div>
                            <p className="font-medium text-ink">
                              {c.advertiser ?? c.campaign_id}
                            </p>
                            <p className="font-mono text-[11px] text-faint">
                              {c.campaign_id}
                              {c.channel ? ` · ${c.channel}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink-soft">
                        {metricUSDShort(c.invoice_amount)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink-soft">
                        {metricUSDShort(c.expected_revenue)}
                      </td>
                      <td
                        className={`px-3 py-3 text-right tabular-nums ${
                          c.invoice_gap !== null && c.invoice_gap > 0
                            ? "font-semibold text-danger"
                            : "text-faint"
                        }`}
                      >
                        {leak}
                      </td>
                      <td
                        className={`px-3 py-3 text-right tabular-nums ${
                          c.gross_margin !== null && c.gross_margin < 0.35
                            ? "font-semibold text-danger"
                            : "text-ink-soft"
                        }`}
                      >
                        {fmtPctOrNA(c.gross_margin)}
                      </td>
                      <td className="px-5 py-3">
                        <RiskPill level={c.risk_level} partial={c.risk_partial} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {selected && <DetailPanel campaign={selected} />}
      </div>
    </div>
  );
}

function metricUSDShort(v: number | null): string {
  return v === null ? "N/A" : fmtUSD(v);
}

function RiskPill({
  level,
  partial,
}: {
  level: RiskLevel | null;
  partial: boolean;
}) {
  if (level === null) {
    return (
      <span className="inline-flex rounded-full bg-card-alt px-2.5 py-0.5 text-[11px] font-semibold text-muted">
        N/A
      </span>
    );
  }
  const short = level === "Medium" ? "Med" : level;
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${riskLevelBadge[level]}`}
      title={partial ? "Based on partial data" : undefined}
    >
      {short}
      {partial ? "*" : ""}
    </span>
  );
}

function DetailPanel({ campaign }: { campaign: SafeAnalyzedCampaign }) {
  const c = campaign;
  const subline =
    [c.campaign_id, c.channel, c.agency].filter(Boolean).join(" · ") || "—";
  const leakage =
    c.invoice_gap === null
      ? "N/A"
      : c.invoice_gap > 0
        ? fmtUSDSigned(c.invoice_gap)
        : fmtUSD(0);

  return (
    <aside className="flex flex-col gap-5 rounded-xl border border-line bg-card p-5 lg:sticky lg:top-0 lg:self-start">
      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
            Selected campaign
          </p>
          {c.risk_level ? (
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${riskLevelBadge[c.risk_level]}`}
            >
              {c.risk_level} risk
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-card-alt px-2.5 py-0.5 text-[11px] font-semibold text-muted">
              Risk N/A
            </span>
          )}
        </div>
        <h3 className="mt-2 text-lg font-semibold text-ink">
          {c.advertiser ?? c.campaign_id}
        </h3>
        <p className="text-xs text-muted">{subline}</p>

        {c.flag_names.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.flag_names.map((f) => (
              <span
                key={f}
                className="rounded-md bg-warn-bg px-2 py-0.5 text-[11px] font-medium text-warn"
              >
                {f.replace(" Risk", "")}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
        <Metric label="Invoice" value={metricUSD(c.invoice_amount)} />
        <Metric label="Expected" value={metricUSD(c.expected_revenue)} />
        <Metric
          label="Leakage"
          value={leakage}
          danger={c.invoice_gap !== null && c.invoice_gap > 0}
        />
        <Metric
          label="Gross margin"
          value={fmtPctOrNA(c.gross_margin)}
          danger={c.gross_margin !== null && c.gross_margin < 0.35}
        />
        <Metric
          label="Delivery"
          value={fmtPctOrNA(c.delivery_rate)}
          danger={c.delivery_rate !== null && c.delivery_rate < 0.9}
        />
        <Metric
          label="Attention"
          value={c.attention_score === null ? "N/A" : `${c.attention_score}`}
        />
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
          Risk drivers
        </p>
        {c.flags.length === 0 ? (
          <p className="mt-2 rounded-lg border border-sage-line bg-sage-tint/40 px-3 py-2 text-xs text-sage-deep">
            No risk flags fired on the available data.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {c.flags.map((f) => (
              <li key={f.flag} className="flex gap-2 text-xs leading-relaxed text-ink-soft">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-danger" aria-hidden />
                {f.explanation}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
          Recommended action
        </p>
        <p className="mt-2 rounded-lg border border-sage-line bg-sage-tint/50 px-3 py-2.5 text-sm font-medium text-sage-deep">
          {c.recommended_action}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
          Analysis coverage
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {COVERAGE_DIMS.map((d) => {
            const ok = c.dimensions[d.key];
            return (
              <span
                key={d.key}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  ok
                    ? "bg-sage-tint text-sage-deep"
                    : "bg-card-alt text-muted"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-sage" : "bg-faint"}`}
                  aria-hidden
                />
                {d.label} · {ok ? "Available" : "Unavailable"}
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-faint">
          Coverage reflects fields available for this campaign. N/A means not
          computable, not zero.
        </p>
      </div>
    </aside>
  );
}

function Metric({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="bg-card px-3 py-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p
        className={`mt-0.5 text-sm font-semibold tabular-nums ${
          danger ? "text-danger" : value.startsWith("N/A") ? "text-faint" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
