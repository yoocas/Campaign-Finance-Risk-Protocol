"use client";

import { useEffect, useState } from "react";
import { fmtPct, fmtUSD, fmtUSDSigned, type RiskLevel } from "@/lib/risk-engine";
import {
  buildSafeSummary,
  type SafeAnalyzedCampaign,
  type SafeKpis,
} from "@/lib/safe-risk-engine";
import type { DimensionSufficiency } from "@/lib/sufficiency";
import KpiCard from "./KpiCard";
import StepNav from "./StepNav";
import { riskLevelBadge, riskLevelDot, riskScoreTone } from "./risk-styles";

interface AnalysisStepProps {
  campaigns: SafeAnalyzedCampaign[];
  kpis: SafeKpis;
  sufficiency: DimensionSufficiency[];
  onBack: () => void;
  onNext: () => void;
}

const NA = "N/A — insufficient data";

const fmtPctOrNA = (v: number | null): string => (v === null ? "N/A" : fmtPct(v));
const fmtGapOrNA = (v: number | null): string => (v === null ? "N/A" : fmtUSDSigned(v));

export default function AnalysisStep({
  campaigns,
  kpis,
  sufficiency,
  onBack,
  onNext,
}: AnalysisStepProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected =
    campaigns.find((c) => c.rowIndex === selectedIndex) ?? null;

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedIndex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const summary = buildSafeSummary(campaigns, kpis);
  const degraded = sufficiency.filter((d) => d.status !== "available");

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <KpiCard
          label="Total Invoice Amount"
          value={kpis.invoiceAmount.available ? fmtUSD(kpis.invoiceAmount.value) : NA}
          sub={`${kpis.totalCampaigns} campaigns`}
        />
        <KpiCard
          label="Expected Revenue"
          value={
            kpis.expectedRevenue.available ? fmtUSD(kpis.expectedRevenue.value) : NA
          }
          sub="From billable impressions"
        />
        <KpiCard
          label="Potential Leakage"
          value={
            kpis.potentialLeakage.available ? fmtUSD(kpis.potentialLeakage.value) : NA
          }
          sub="Sum of positive invoice gaps"
          tone={kpis.potentialLeakage.available ? "critical" : "neutral"}
        />
        <KpiCard
          label="Avg Gross Margin"
          value={kpis.grossMargin.available ? fmtPct(kpis.grossMargin.value) : NA}
          sub="Invoice-weighted"
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
          sub={`of ${kpis.totalCampaigns} reviewed`}
          tone="warning"
        />
        <KpiCard
          label="High Risk Campaigns"
          value={String(kpis.highRiskCampaigns)}
          sub="3 or more flags"
          tone="critical"
        />
      </section>

      {/* Executive summary */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Executive Summary</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Deterministic
          </span>
        </div>
        <p className="px-6 py-5 text-sm leading-relaxed text-slate-700">{summary}</p>
      </section>

      {/* Degraded-analysis warnings */}
      {degraded.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Limited or skipped analysis
          </h3>
          <ul className="mt-2 space-y-1 text-xs text-amber-800">
            {degraded.map((d) => (
              <li key={d.key}>
                <span className="font-semibold">{d.analysis}:</span>{" "}
                {d.status === "partial" ? "partial" : "unavailable"} — {d.reason}.
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Risk-ranked table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Risk-Ranked Campaigns
          </h2>
          <p className="text-xs text-slate-400">
            Sorted by risk score · select a row for detail
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-6 py-3 font-medium">Campaign</th>
                <th className="px-3 py-3 font-medium">Channel</th>
                <th className="px-3 py-3 text-right font-medium">Invoice Gap</th>
                <th className="px-3 py-3 text-right font-medium">Margin</th>
                <th className="px-3 py-3 text-right font-medium">Delivery</th>
                <th className="px-3 py-3 text-right font-medium">Attn</th>
                <th className="px-3 py-3 font-medium">Risk</th>
                <th className="px-3 py-3 font-medium">Flags</th>
                <th className="px-6 py-3 font-medium">Recommended Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {campaigns.map((c) => {
                const isSelected = c.rowIndex === selectedIndex;
                return (
                  <tr
                    key={c.rowIndex}
                    onClick={() => setSelectedIndex(c.rowIndex)}
                    className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                      isSelected ? "bg-slate-50" : ""
                    }`}
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            c.risk_level ? riskLevelDot[c.risk_level] : "bg-slate-300"
                          }`}
                          aria-hidden
                        />
                        <div>
                          <p className="font-medium text-slate-900">
                            {c.advertiser ?? c.campaign_id}
                          </p>
                          <p className="font-mono text-[11px] text-slate-400">
                            {c.campaign_id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{c.channel ?? "—"}</td>
                    <td
                      className={`px-3 py-3 text-right tabular-nums ${
                        c.invoice_gap !== null && c.invoice_gap > 5000
                          ? "font-semibold text-rose-600"
                          : "text-slate-600"
                      }`}
                    >
                      {fmtGapOrNA(c.invoice_gap)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right tabular-nums ${
                        c.gross_margin !== null && c.gross_margin < 0.35
                          ? "font-semibold text-rose-600"
                          : "text-slate-600"
                      }`}
                    >
                      {fmtPctOrNA(c.gross_margin)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right tabular-nums ${
                        c.delivery_rate !== null && c.delivery_rate < 0.9
                          ? "font-semibold text-rose-600"
                          : "text-slate-600"
                      }`}
                    >
                      {fmtPctOrNA(c.delivery_rate)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right tabular-nums ${
                        c.flag_names.includes("Attention Risk")
                          ? "font-semibold text-rose-600"
                          : "text-slate-600"
                      }`}
                    >
                      {c.attention_score ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <RiskBadge level={c.risk_level} score={c.risk_score} partial={c.risk_partial} />
                    </td>
                    <td className="px-3 py-3">
                      {c.flag_names.length === 0 ? (
                        <span className="text-xs text-slate-300">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {c.flag_names.map((f) => (
                            <span
                              key={f}
                              title={f}
                              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                            >
                              {f.replace(" Risk", "")}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-500">
                      <span className="line-clamp-2 max-w-[240px]">
                        {c.recommended_action}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <StepNav
        onBack={onBack}
        onNext={onNext}
        nextLabel="Generate brief →"
        backLabel="← Back to validation"
      />

      {selected && (
        <SafeDetailPanel campaign={selected} onClose={() => setSelectedIndex(null)} />
      )}
    </div>
  );
}

function RiskBadge({
  level,
  score,
  partial,
}: {
  level: RiskLevel | null;
  score: number;
  partial: boolean;
}) {
  if (level === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-400">
        N/A
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${riskLevelBadge[level]}`}
      >
        {level}
      </span>
      <span className={`text-[11px] font-semibold tabular-nums ${riskScoreTone(score)}`}>
        {score}
        {partial ? "*" : ""}
      </span>
    </div>
  );
}

// ---- Detail panel (handles missing metrics) -------------------------------
function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd
        className={`text-sm font-medium tabular-nums ${
          danger ? "text-rose-600" : value.startsWith("N/A") ? "text-slate-400" : "text-slate-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function metricUSD(v: number | null): string {
  return v === null ? NA : fmtUSD(v);
}

function SafeDetailPanel({
  campaign,
  onClose,
}: {
  campaign: SafeAnalyzedCampaign;
  onClose: () => void;
}) {
  const c = campaign;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Campaign detail for ${c.campaign_id}`}
    >
      <button
        type="button"
        aria-label="Close detail panel"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
      />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs text-slate-400">{c.campaign_id}</p>
              <h2 className="mt-0.5 text-lg font-semibold text-slate-900">
                {c.advertiser ?? c.campaign_id}
              </h2>
              <p className="text-xs text-slate-500">
                {[c.channel, c.ad_format, c.agency].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {c.risk_level ? (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${riskLevelBadge[c.risk_level]}`}
              >
                {c.risk_level} Risk
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                Risk N/A
              </span>
            )}
            <span className="text-xs text-slate-400">
              Risk score{" "}
              <span className={`font-semibold ${riskScoreTone(c.risk_score)}`}>
                {c.risk_score}/{c.risk_score_max || 100}
              </span>
              {c.risk_partial && (
                <span className="ml-1 text-amber-600">· partial data</span>
              )}
            </span>
          </div>
        </div>

        <div className="space-y-6 px-6 py-5">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Expected vs. Invoiced
            </h3>
            <div className="rounded-lg bg-slate-50 p-4">
              <dl>
                <Row label="Expected revenue" value={metricUSD(c.expected_revenue)} />
                <Row label="Invoice amount" value={metricUSD(c.invoice_amount)} />
                <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2">
                  <dt className="text-xs font-semibold text-slate-600">Invoice gap</dt>
                  <dd
                    className={`text-sm font-semibold tabular-nums ${
                      c.invoice_gap === null
                        ? "text-slate-400"
                        : c.invoice_gap > 5000
                          ? "text-rose-600"
                          : "text-slate-900"
                    }`}
                  >
                    {c.invoice_gap === null ? NA : fmtUSDSigned(c.invoice_gap)}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Cost &amp; Margin
            </h3>
            <div className="rounded-lg bg-slate-50 p-4">
              <dl>
                <Row label="Publisher cost" value={metricUSD(c.publisher_cost)} />
                <Row label="Data cost" value={metricUSD(c.data_cost)} />
                <Row label="Creative cost" value={metricUSD(c.creative_cost)} />
                <Row label="Total cost" value={metricUSD(c.total_cost)} />
                <Row label="Gross profit" value={metricUSD(c.gross_profit)} />
                <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2">
                  <dt className="text-xs font-semibold text-slate-600">Gross margin</dt>
                  <dd
                    className={`text-sm font-semibold tabular-nums ${
                      c.gross_margin === null
                        ? "text-slate-400"
                        : c.gross_margin < 0.35
                          ? "text-rose-600"
                          : "text-emerald-600"
                    }`}
                  >
                    {fmtPctOrNA(c.gross_margin)}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Delivery &amp; Attention
            </h3>
            <div className="rounded-lg bg-slate-50 p-4">
              <dl>
                <Row
                  label="Delivery rate"
                  value={fmtPctOrNA(c.delivery_rate)}
                  danger={c.delivery_rate !== null && c.delivery_rate < 0.9}
                />
                <Row
                  label="Attention score"
                  value={c.attention_score === null ? NA : `${c.attention_score} / 100`}
                />
                <Row
                  label="Supply quality"
                  value={
                    c.supply_quality_flag === null
                      ? NA
                      : c.supply_quality_flag === "review"
                        ? "Review"
                        : c.supply_quality_flag === "ok"
                          ? "OK"
                          : c.supply_quality_flag
                  }
                />
              </dl>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Why this campaign is flagged
            </h3>
            {c.flags.length === 0 ? (
              <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                No risk flags fired on the available data.
              </p>
            ) : (
              <ul className="space-y-2">
                {c.flags.map((f) => (
                  <li
                    key={f.flag}
                    className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-rose-800">{f.flag}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-rose-700">
                      {f.explanation}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {c.risk_partial && (
              <p className="mt-2 text-[11px] text-amber-600">
                Some dimensions could not be evaluated for this row — risk is based
                on partial data.
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Recommended next action
            </h3>
            <p className="rounded-lg border border-slate-200 bg-slate-900 px-4 py-3 text-sm font-medium text-white">
              {c.recommended_action}
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}
