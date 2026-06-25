import type { RiskLevel } from "@/lib/risk-engine";

/** Shared, color-coded styling for risk levels across table and detail panel. */
export const riskLevelBadge: Record<RiskLevel, string> = {
  High: "bg-rose-100 text-rose-700 ring-rose-200",
  Medium: "bg-amber-100 text-amber-700 ring-amber-200",
  Low: "bg-emerald-100 text-emerald-700 ring-emerald-200",
};

export const riskLevelDot: Record<RiskLevel, string> = {
  High: "bg-rose-500",
  Medium: "bg-amber-500",
  Low: "bg-emerald-500",
};

/** Score band coloring for the numeric risk score. */
export function riskScoreTone(score: number): string {
  if (score >= 45) return "text-rose-600";
  if (score >= 25) return "text-amber-600";
  return "text-slate-500";
}
