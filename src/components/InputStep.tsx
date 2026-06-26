"use client";

import { useRef, useState } from "react";
import { Check, UploadCloud } from "lucide-react";
import {
  parseCsv,
  parseText,
  sampleDataset,
  type ParsedData,
} from "@/lib/import-parser";
import StepHeader from "./StepHeader";

interface InputStepProps {
  onLoad: (data: ParsedData) => void;
}

type Tab = "paste" | "upload" | "sample";

const SAMPLE_PASTE = `campaign_id,advertiser,channel,contracted_cpm,billable_impressions,invoice_amount,publisher_cost,data_cost,creative_cost,delivered_impressions,booked_impressions,attention_score,supply_quality_flag
CMP-2001,Sample Outdoor Brand,Display,5.50,9000000,49000,30000,3000,2000,9100000,9200000,62,ok
CMP-2002,Sample Fitness Brand,Video,22.00,4000000,84000,40000,4000,5000,4050000,4100000,57,ok`;

const TABS: { id: Tab; label: string }[] = [
  { id: "paste", label: "Paste CSV / JSON" },
  { id: "upload", label: "Upload CSV" },
  { id: "sample", label: "Load Sample" },
];

export default function InputStep({ onLoad }: InputStepProps) {
  const [tab, setTab] = useState<Tab>("sample");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParsedData | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasRows = preview !== null && preview.rowCount > 0;
  const sampleSelected = preview?.sourceType === "sample";

  function handleParsePaste() {
    setPreview(parseText(text));
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setPreview(parseCsv(content, file.name, "csv"));
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleSample() {
    setPreview(sampleDataset());
  }

  return (
    <div className="space-y-6">
      <StepHeader
        stepNumber={1}
        title="Input Data"
        description="Bring campaign-level finance data into the review workflow. Raw uploaded data stays local to this session; the AI memo sends only sanitized computed results."
        onNext={() => preview && onLoad(preview)}
        nextLabel="Continue to Map Columns"
        nextDisabled={!hasRows}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Left: source tabs + content + preview */}
        <div className="space-y-5">
          <div className="inline-flex rounded-xl border border-line bg-card-alt p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "bg-card text-ink shadow-sm"
                    : "text-muted hover:text-ink-soft"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "paste" && (
            <section className="rounded-xl border border-line bg-card p-5">
              <h3 className="text-sm font-semibold text-ink">Paste CSV or JSON</h3>
              <p className="mt-1 text-xs text-muted">
                Paste rows from a spreadsheet export or a JSON array. Headers are
                auto-detected.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                placeholder="campaign_id,advertiser,channel,cpm,..."
                className="mt-3 h-44 w-full resize-y rounded-lg border border-line bg-card-alt p-3 font-mono text-xs text-ink-soft outline-none focus:border-sage focus:bg-card"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleParsePaste}
                  className="rounded-lg bg-sage px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sage-dark"
                >
                  Parse pasted data
                </button>
                <button
                  type="button"
                  onClick={() => setText(SAMPLE_PASTE)}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-card-alt"
                >
                  Insert example CSV
                </button>
              </div>
            </section>
          )}

          {tab === "upload" && (
            <section className="rounded-xl border border-line bg-card p-5">
              <h3 className="text-sm font-semibold text-ink">Upload a CSV file</h3>
              <p className="mt-1 text-xs text-muted">
                Parsed locally with papaparse — nothing leaves your browser.
              </p>
              <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-card-alt px-4 py-8 text-sm text-muted transition-colors hover:border-sage hover:bg-sage-tint/40">
                <UploadCloud size={22} className="text-faint" aria-hidden />
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFile}
                  className="hidden"
                />
                <span>
                  <span className="font-medium text-ink-soft">Choose a .csv file</span>{" "}
                  or drag it here
                </span>
              </label>
              <p className="mt-2 text-[11px] text-faint">
                XLSX import is coming later. CSV and paste work now.
              </p>
            </section>
          )}

          {tab === "sample" && (
            <section className="overflow-hidden rounded-xl border border-line bg-card">
              <div className="flex items-center justify-between border-b border-line-soft px-5 py-3">
                <h3 className="text-sm font-semibold text-ink">
                  Curated synthetic dataset
                </h3>
                <span className="text-xs text-muted">Anonymized · safe to explore</span>
              </div>
              <button
                type="button"
                onClick={handleSample}
                className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors ${
                  sampleSelected ? "bg-sage-tint/60" : "hover:bg-card-alt"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                      sampleSelected
                        ? "border-sage bg-sage text-white"
                        : "border-line text-transparent"
                    }`}
                  >
                    <Check size={14} strokeWidth={3} aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">
                      Adtech Revenue Sample
                    </p>
                    <p className="text-xs text-muted">
                      Invoice, expected revenue, delivery &amp; margin signals
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-sage">
                  {sampleDataset().rowCount}{" "}
                  <span className="font-normal text-muted">rows</span>
                </span>
              </button>
            </section>
          )}

          {preview && preview.errors.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-danger-line bg-danger-bg p-3 text-xs text-danger">
              {preview.errors.slice(0, 6).map((err, i) => (
                <li key={i}>• {err}</li>
              ))}
              {preview.errors.length > 6 && (
                <li className="opacity-70">+ {preview.errors.length - 6} more…</li>
              )}
            </ul>
          )}

          {hasRows && <PreviewTable preview={preview} />}
        </div>

        {/* Right: detected summary + how-it-works */}
        <div className="space-y-5">
          <DetectedCard preview={preview} />

          <section className="rounded-xl border border-line bg-card p-5">
            <h3 className="text-sm font-semibold text-ink">How this works</h3>
            <ol className="mt-3 space-y-3">
              {[
                "We map your columns to standard finance fields — you confirm every match.",
                "Validation checks which analyses your data can actually support.",
                "Risk analysis prioritizes campaigns for human review — never auto-decides.",
              ].map((line, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sage-tint text-[11px] font-semibold text-sage-deep">
                    {i + 1}
                  </span>
                  <span className="text-xs leading-relaxed text-ink-soft">{line}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-line-soft pt-3 text-[11px] leading-relaxed text-muted">
              Raw uploaded data stays local to this session. The AI memo sends
              only sanitized computed results — never raw rows or original CSV
              text.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function DetectedCard({ preview }: { preview: ParsedData | null }) {
  const headers = preview?.headers ?? [];
  const shownHeaders = headers.slice(0, 5);
  const extra = headers.length - shownHeaders.length;

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
        Detected
      </p>

      {!preview ? (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Choose a source to detect rows and column headers.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-sage-tint/50 px-3 py-3">
              <p className="text-2xl font-semibold tabular-nums text-ink">
                {preview.rowCount.toLocaleString()}
              </p>
              <p className="text-xs text-muted">rows detected</p>
            </div>
            <div className="rounded-lg bg-sage-tint/50 px-3 py-3">
              <p className="text-2xl font-semibold tabular-nums text-ink">
                {preview.headers.length}
              </p>
              <p className="text-xs text-muted">headers detected</p>
            </div>
          </div>

          {headers.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-ink-soft">Column headers</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {shownHeaders.map((h) => (
                  <span
                    key={h}
                    className="rounded-md bg-card-alt px-2 py-0.5 font-mono text-[11px] text-ink-soft"
                  >
                    {h}
                  </span>
                ))}
                {extra > 0 && (
                  <span className="rounded-md bg-card-alt px-2 py-0.5 font-mono text-[11px] text-muted">
                    +{extra} more
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 border-t border-line-soft pt-3">
            <span
              className={`h-2 w-2 rounded-full ${
                preview.rowCount > 0 ? "bg-sage" : "bg-faint"
              }`}
              aria-hidden
            />
            <span className="text-xs font-medium text-sage-deep">
              {preview.rowCount > 0
                ? "Ready to map columns"
                : "No rows detected yet"}
            </span>
          </div>
        </>
      )}
    </section>
  );
}

function PreviewTable({ preview }: { preview: ParsedData }) {
  const headers = preview.headers.slice(0, 6);
  const rows = preview.rows.slice(0, 3);

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between px-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
          First rows preview
        </p>
        <span className="text-xs text-muted">
          showing {rows.length} of {preview.rowCount.toLocaleString()}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-y border-line-soft bg-sage-tint/40 font-mono text-[11px] text-sage-deep">
              {headers.map((h) => (
                <th key={h} className="px-4 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.map((row, i) => (
              <tr key={i}>
                {headers.map((h) => (
                  <td
                    key={h}
                    className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] text-ink-soft"
                  >
                    {row[h] === "" ? "—" : row[h]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
