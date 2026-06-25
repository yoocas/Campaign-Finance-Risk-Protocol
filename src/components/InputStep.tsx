"use client";

import { useRef, useState } from "react";
import {
  parseCsv,
  parseText,
  sampleDataset,
  type ParsedData,
} from "@/lib/import-parser";

interface InputStepProps {
  onLoad: (data: ParsedData) => void;
}

const SAMPLE_PASTE = `campaign_id,advertiser,channel,contracted_cpm,billable_impressions,invoice_amount,publisher_cost,data_cost,creative_cost,delivered_impressions,booked_impressions,attention_score,supply_quality_flag
CMP-2001,Sample Outdoor Brand,Display,5.50,9000000,49000,30000,3000,2000,9100000,9200000,62,ok
CMP-2002,Sample Fitness Brand,Video,22.00,4000000,84000,40000,4000,5000,4050000,4100000,57,ok`;

export default function InputStep({ onLoad }: InputStepProps) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParsedData | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleParsePaste() {
    setPreview(parseText(text));
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setPreview(parseCsv(content, file.name, "csv"));
    // Allow re-selecting the same file later.
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleSample() {
    setPreview(sampleDataset());
  }

  const hasRows = preview !== null && preview.rowCount > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Paste */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Paste CSV or JSON
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Paste rows from a spreadsheet export or a JSON array. Headers are
            auto-detected.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder="campaign_id,advertiser,channel,cpm,..."
            className="mt-3 h-44 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleParsePaste}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              Parse pasted data
            </button>
            <button
              type="button"
              onClick={() => setText(SAMPLE_PASTE)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Insert example CSV
            </button>
          </div>
        </section>

        {/* Upload / sample */}
        <section className="flex flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Upload a CSV file</h2>
            <p className="mt-1 text-xs text-slate-500">
              Parsed locally with papaparse — nothing leaves your browser.
            </p>
            <label className="mt-3 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-100">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                className="hidden"
              />
              <span>
                <span className="font-medium text-slate-700">Choose a .csv file</span> or
                drag it here
              </span>
            </label>
            <p className="mt-2 text-[11px] text-slate-400">
              XLSX import is coming later. CSV and paste work now.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              Load the sample dataset
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              14 mock/anonymized campaigns with known, verified risk signal.
            </p>
            <button
              type="button"
              onClick={handleSample}
              className="mt-3 rounded-lg border border-slate-900 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-900 hover:text-white"
            >
              Load sample dataset
            </button>
          </div>
        </section>
      </div>

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <span className="font-semibold">Prototype</span> uses mock/anonymized data
        only. Do not upload confidential client, publisher, or financial data.
      </p>

      {/* Parse preview */}
      {preview && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Detected data — {preview.sourceLabel}
            </h2>
            <span className="text-xs text-slate-400">
              {preview.sourceType.toUpperCase()}
            </span>
          </div>

          {preview.errors.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
              {preview.errors.slice(0, 6).map((err, i) => (
                <li key={i}>• {err}</li>
              ))}
              {preview.errors.length > 6 && (
                <li className="text-rose-400">
                  + {preview.errors.length - 6} more…
                </li>
              )}
            </ul>
          )}

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Rows detected" value={String(preview.rowCount)} />
            <Stat label="Columns detected" value={String(preview.headers.length)} />
          </div>

          {preview.headers.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Detected headers
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {preview.headers.map((h) => (
                  <span
                    key={h}
                    className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              disabled={!hasRows}
              onClick={() => preview && onLoad(preview)}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Continue to mapping →
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}
