import type { RiskLevel } from "@/lib/risk-engine";

/** Shared, color-coded styling for risk levels across table and detail panel. */
export const riskLevelBadge: Record<RiskLevel, string> = {
  High: "bg-danger-bg text-danger ring-danger-line",
  Medium: "bg-warn-bg text-warn ring-warn-line",
  Low: "bg-sage-tint text-sage-deep ring-sage-line",
};

export const riskLevelDot: Record<RiskLevel, string> = {
  High: "bg-danger",
  Medium: "bg-warn",
  Low: "bg-sage",
};

/** Score band coloring for the numeric risk score. */
export function riskScoreTone(score: number): string {
  if (score >= 45) return "text-danger";
  if (score >= 25) return "text-warn";
  return "text-muted";
}
