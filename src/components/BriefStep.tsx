"use client";

import { useState } from "react";
import type { Brief } from "@/lib/safe-risk-engine";
import type { AiBriefPayload, AiMemo } from "@/lib/ai-brief-payload";

interface BriefStepProps {
  brief: Brief;
  aiPayload: AiBriefPayload | null;
  onBack: () => void;
  onReset: () => void;
}

type AiState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; memo: AiMemo };

const MEMO_SECTIONS: { key: keyof AiMemo; heading: string }[] = [
  { key: "executive_summary", heading: "Executive Summary" },
  { key: "data_confidence", heading: "Data Confidence & Scope" },
  { key: "highest_risk_campaign", heading: "Highest-Risk Campaign" },
  { key: "biggest_risk_driver", heading: "Biggest Portfolio Risk Driver" },
  { key: "verify_first", heading: "What Finance Should Verify First" },
  { key: "possible_false_positives", heading: "Possible False Positives" },
  { key: "recommended_actions", heading: "Top Recommended Review Actions" },
  { key: "cannot_conclude", heading: "What This Analysis Cannot Conclude" },
  { key: "follow_up_questions", heading: "Suggested Follow-Up Questions" },
];

function memoToText(memo: AiMemo): string {
  return MEMO_SECTIONS.map(({ key, heading }) => {
    const value = memo[key];
    const body = Array.isArray(value)
      ? value.map((v, i) => `  ${i + 1}. ${v}`).join("\n")
      : `  ${value}`;
    return `${heading}\n${body}`;
  }).join("\n\n");
}

export default function BriefStep({
  brief,
  aiPayload,
  onBack,
  onReset,
}: BriefStepProps) {
  const [copied, setCopied] = useState(false);
  const [ai, setAi] = useState<AiState>({ status: "idle" });
  const [aiCopied, setAiCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(brief.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function handleGenerate() {
    if (!aiPayload) return;
    setAi({ status: "loading" });
    try {
      const res = await fetch("/api/ai-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiPayload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          (data && typeof data.message === "string" && data.message) ||
          "AI memo unavailable. The deterministic brief remains the source of truth.";
        setAi({ status: "error", message });
        return;
      }
      if (!data || !data.memo) {
        setAi({
          status: "error",
          message: "AI memo unavailable — the response was empty.",
        });
        return;
      }
      setAi({ status: "success", memo: data.memo as AiMemo });
    } catch {
      setAi({
        status: "error",
        message:
          "Could not reach the AI memo service. The deterministic brief remains available.",
      });
    }
  }

  async function handleCopyMemo(memo: AiMemo) {
    try {
      await navigator.clipboard.writeText(memoToText(memo));
      setAiCopied(true);
      window.setTimeout(() => setAiCopied(false), 2000);
    } catch {
      setAiCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Deterministic brief — always visible, the source of truth */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Finance Review Brief
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Deterministic analyst summary generated from the computed results.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg border border-slate-900 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-900 hover:text-white"
          >
            {copied ? "Copied ✓" : "Copy brief"}
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {brief.sections.map((section) => (
            <section key={section.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {section.heading}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {section.lines.map((line, i) => (
                  <li key={i} className="text-sm leading-relaxed text-slate-700">
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      {/* AI narrative memo — optional layer on top of the deterministic results */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">AI Memo</h2>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700">
                Narrative
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              AI-generated narrative based only on deterministic computed
              results.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {ai.status === "success" && (
              <button
                type="button"
                onClick={() => handleCopyMemo(ai.memo)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                {aiCopied ? "Copied ✓" : "Copy AI memo"}
              </button>
            )}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={ai.status === "loading" || !aiPayload}
              className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {ai.status === "loading"
                ? "Generating…"
                : ai.status === "success"
                  ? "Regenerate AI memo"
                  : "Generate AI memo"}
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          {/* Data notice — always shown near the button */}
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
            Use synthetic or anonymized data only. The AI memo sends a sanitized
            computed-results payload to the model provider. Do not use
            confidential client, publisher, campaign, or financial records in
            this prototype.
          </p>

          {ai.status === "idle" && (
            <p className="mt-4 text-sm text-slate-500">
              Optional: generate a narrative finance memo from the computed
              results above. The numbers remain the source of truth — the model
              only explains and structures them.
            </p>
          )}

          {ai.status === "loading" && (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500" />
              Generating narrative memo from computed results…
            </div>
          )}

          {ai.status === "error" && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-sm font-semibold text-rose-800">
                AI memo unavailable
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-rose-700">
                {ai.message}
              </p>
              <p className="mt-1 text-xs text-rose-600">
                The deterministic brief above remains complete and accurate.
              </p>
            </div>
          )}

          {ai.status === "success" && (
            <div className="mt-4 space-y-5">
              {MEMO_SECTIONS.map(({ key, heading }) => {
                const value = ai.memo[key];
                return (
                  <section key={key}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {heading}
                    </h3>
                    {Array.isArray(value) ? (
                      <ol className="mt-2 list-decimal space-y-1.5 pl-5">
                        {value.map((item, i) => (
                          <li
                            key={i}
                            className="text-sm leading-relaxed text-slate-700"
                          >
                            {item}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">
                        {value}
                      </p>
                    )}
                  </section>
                );
              })}
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                The numbers above remain the source of truth. This narrative was
                generated only from the deterministic computed results.
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          ← Back to analysis
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          Start over
        </button>
      </div>
    </div>
  );
}
