"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Download, X } from "lucide-react";
import {
  FIELD_DEFS,
  STANDARD_FIELDS,
  type StandardField,
} from "@/lib/column-mapping";

interface DataRequirementsModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Fields grouped by the analysis they unlock. Field order within each group
 * mirrors how an analyst reads the calculation (inputs first). These groupings
 * are presentational only — the authoritative schema is STANDARD_FIELDS and the
 * sufficiency logic in lib/sufficiency.ts.
 */
const FIELD_GROUPS: {
  title: string;
  blurb: string;
  fields: StandardField[];
}[] = [
  {
    title: "Invoice-gap / potential leakage",
    blurb: "Reconcile what was invoiced against what the contract implies.",
    fields: [
      "campaign_id",
      "advertiser",
      "contracted_cpm",
      "billable_impressions",
      "invoice_amount",
    ],
  },
  {
    title: "Margin analysis",
    blurb: "Revenue net of the costs that go into delivering the campaign.",
    fields: ["invoice_amount", "publisher_cost", "data_cost", "creative_cost"],
  },
  {
    title: "Delivery analysis",
    blurb: "Whether impressions delivered against what was booked.",
    fields: ["booked_impressions", "delivered_impressions"],
  },
  {
    title: "Attention analysis",
    blurb: "Attention quality relative to spend.",
    fields: ["attention_score", "invoice_amount"],
  },
  {
    title: "Supply-quality review",
    blurb: "Vendor / SSP fraud & quality exposure.",
    fields: ["supply_quality_flag"],
  },
  {
    title: "Context fields",
    blurb: "Optional descriptors that enrich grouping and reporting.",
    fields: [
      "agency",
      "channel",
      "ad_format",
      "start_date",
      "end_date",
      "booked_budget",
    ],
  },
];

/** One synthetic example row — illustrative only, no real client data. */
const EXAMPLE_ROW: Record<StandardField, string> = {
  campaign_id: "CMP-1001",
  advertiser: "Example Brand Co",
  agency: "Example Media Group",
  channel: "Display",
  ad_format: "Banner",
  start_date: "2026-01-01",
  end_date: "2026-03-31",
  booked_budget: "100000",
  contracted_cpm: "6.00",
  booked_impressions: "16000000",
  delivered_impressions: "15800000",
  billable_impressions: "15500000",
  invoice_amount: "95000",
  publisher_cost: "60000",
  data_cost: "5000",
  creative_cost: "4000",
  attention_score: "64",
  supply_quality_flag: "ok",
};

const HEADER_ROW = STANDARD_FIELDS.join(",");
const EXAMPLE_VALUES = STANDARD_FIELDS.map((f) => EXAMPLE_ROW[f]).join(",");
const CSV_TEMPLATE = `${HEADER_ROW}\n${EXAMPLE_VALUES}\n`;

export default function DataRequirementsModal({
  open,
  onClose,
}: DataRequirementsModalProps) {
  const [copied, setCopied] = useState(false);

  // Single close path so the transient "Copied" state always resets.
  const close = useCallback(() => {
    setCopied(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  async function handleCopyHeaders() {
    try {
      await navigator.clipboard.writeText(HEADER_ROW);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (permissions / insecure context). Fail quietly.
    }
  }

  function handleDownloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "campaign-data-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="data-req-title"
      onClick={close}
    >
      <div
        className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-line-soft px-6 py-4">
          <div>
            <h2 id="data-req-title" className="text-base font-semibold text-ink">
              What data do I need?
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Upload a flat CSV or paste CSV/JSON campaign data. The app maps
              your source columns into this standard schema before running
              analysis.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1 text-muted transition-colors hover:bg-card-alt hover:text-ink"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {/* Caveat */}
          <p className="rounded-lg border border-warn-line bg-warn-bg px-4 py-3 text-xs leading-relaxed text-warn">
            <span className="font-semibold">
              You do not need every field, but missing fields limit which
              analyses can run.
            </span>{" "}
            Missing CPM means invoice-gap analysis becomes N/A, not $0.
          </p>

          {/* Field groups */}
          <div className="mt-5 space-y-4">
            {FIELD_GROUPS.map((group) => (
              <div
                key={group.title}
                className="rounded-xl border border-line-soft bg-card-alt/50 p-4"
              >
                <p className="text-sm font-semibold text-ink">{group.title}</p>
                <p className="mt-0.5 text-xs text-muted">{group.blurb}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {group.fields.map((f) => (
                    <span
                      key={f}
                      title={FIELD_DEFS[f].label}
                      className="rounded-md border border-line bg-card px-2 py-0.5 font-mono text-[11px] text-ink-soft"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            Full standard schema · {STANDARD_FIELDS.length} fields. The download
            includes one synthetic example row — no real company or client data.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t border-line-soft px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleCopyHeaders}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-card-alt"
          >
            {copied ? (
              <Check size={15} className="text-sage" aria-hidden />
            ) : (
              <Copy size={15} aria-hidden />
            )}
            {copied ? "Headers copied" : "Copy CSV headers"}
          </button>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-sage px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sage-dark"
          >
            <Download size={15} aria-hidden />
            Download CSV template
          </button>
        </div>
      </div>
    </div>
  );
}
