/**
 * Presentational band for the derived data-confidence signal.
 *
 * Confidence itself is computed in CampaignWorkflow as validRows / totalRows
 * (a faithful summary of validation output, not a new engine metric). This
 * helper only maps that percentage to a label + tone for display.
 */
export interface ConfidenceBand {
  label: string;
  tone: string;
}

export function confidenceBand(pct: number | null): ConfidenceBand {
  if (pct === null) return { label: "N/A", tone: "text-muted" };
  if (pct >= 90) return { label: "Good", tone: "text-sage" };
  if (pct >= 70) return { label: "Fair", tone: "text-warn" };
  return { label: "Limited", tone: "text-danger" };
}
