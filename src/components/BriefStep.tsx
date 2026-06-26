"use client";

import { useState } from "react";
import type { Brief } from "@/lib/safe-risk-engine";
import type { AiBriefPayload, AiMemo } from "@/lib/ai-brief-payload";
import type { DimensionKey, DimensionSufficiency } from "@/lib/sufficiency";
import StepHeader from "./StepHeader";

interface BriefStepProps {
  brief: Brief;
  aiPayload: AiBriefPayload | null;
  sufficiency: DimensionSufficiency[];
  dataConfidence: number | null;
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

const RECS_HEADING = "Ranked Finance Review Actions";

// Per-dimension plain-language limits, derived from sufficiency status.
const CANNOT_CONCLUDE: Record<DimensionKey, string> = {
  billing:
    "Whether invoice gaps stem from billing error vs. contractual make-goods — requires invoice-line detail.",
  margin: "True profitability for rows where cost inputs are missing.",
  delivery: "Final delivery outcomes for rows missing pacing data.",
  attention: "True attention outcomes for rows missing attention/viewability data.",
  supply: "Supply-quality or fraud exposure — vendor-level data was not provided.",
};

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
  sufficiency,
  dataConfidence,
  onBack,
  onReset,
}: BriefStepProps) {
  const [copied, setCopied] = useState(false);
  const [recsCopied, setRecsCopied] = useState(false);
  const [ai, setAi] = useState<AiState>({ status: "idle" });
  const [aiCopied, setAiCopied] = useState(false);

  const recsSection = brief.sections.find((s) => s.heading === RECS_HEADING) ?? null;
  const narrativeSections = brief.sections.filter((s) => s.heading !== RECS_HEADING);
  const cannotConclude = sufficiency.filter((d) => d.status !== "available");

  async function copyText(text: string, set: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
      set(true);
      window.setTimeout(() => set(false), 2000);
    } catch {
      set(false);
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

  return (
    <div className="space-y-5">
      <StepHeader
        stepNumber={5}
        title="Brief"
        description="An analyst-ready summary. The deterministic brief is the source of truth; the AI memo is supporting narrative."
        onBack={onBack}
        backLabel="Back"
        onNext={() => copyText(brief.text, setCopied)}
        nextLabel={copied ? "Copied ✓" : "Copy Brief"}
        nextArrow={false}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Left: deterministic brief + key recommendations */}
        <div className="space-y-5">
          <section className="overflow-hidden rounded-xl border border-sage-line bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-line-soft bg-sage-tint/40 px-5 py-3.5">
              <span className="h-2 w-2 rounded-full bg-sage" aria-hidden />
              <h3 className="text-sm font-semibold text-ink">Deterministic Brief</h3>
              <span className="rounded-full border border-sage-line bg-sage-tint px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sage-deep">
                Source of truth
              </span>
              {dataConfidence !== null && (
                <span className="rounded-full border border-line bg-card px-2 py-0.5 text-[10px] font-medium text-muted">
                  Data confidence {dataConfidence}%
                </span>
              )}
              <button
                type="button"
                onClick={() => copyText(brief.text, setCopied)}
                className="ml-auto rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-card-alt"
              >
                {copied ? "Copied ✓" : "Copy Brief"}
              </button>
            </div>
            <div className="space-y-5 px-5 py-5">
              {narrativeSections.map((section) => (
                <div key={section.heading}>
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
                    {section.heading}
                  </h4>
                  <ul className="mt-2 space-y-1.5">
                    {section.lines.map((line, i) => (
                      <li
                        key={i}
                        className="flex gap-2 text-sm leading-relaxed text-ink-soft"
                      >
                        <span
                          className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sage"
                          aria-hidden
                        />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-line bg-card">
            <div className="flex items-center justify-between border-b border-line-soft px-5 py-3.5">
              <h3 className="text-sm font-semibold text-ink">Key Recommendations</h3>
              {recsSection && (
                <button
                  type="button"
                  onClick={() =>
                    copyText(recsSection.lines.join("\n"), setRecsCopied)
                  }
                  className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-card-alt"
                >
                  {recsCopied ? "Copied ✓" : "Copy"}
                </button>
              )}
            </div>
            <div className="px-5 py-4">
              {recsSection ? (
                <ol className="space-y-3">
                  {recsSection.lines.map((line, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-tint text-[11px] font-semibold text-sage-deep">
                        {i + 1}
                      </span>
                      <span className="text-sm leading-relaxed text-ink-soft">
                        {line.replace(/^\d+\.\s*/, "")}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">
                  No campaigns crossed a risk threshold on the available data.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Right: AI memo + cannot-conclude */}
        <div className="space-y-5">
          <section className="overflow-hidden rounded-xl border border-line bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-5 py-3.5">
              <span className="h-2 w-2 rounded-full bg-faint" aria-hidden />
              <h3 className="text-sm font-semibold text-ink">AI Memo</h3>
              <span className="rounded-full border border-line bg-card-alt px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                Secondary
              </span>
              <div className="ml-auto flex items-center gap-2">
                {ai.status === "success" && (
                  <button
                    type="button"
                    onClick={() => copyText(memoToText(ai.memo), setAiCopied)}
                    className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-card-alt"
                  >
                    {aiCopied ? "Copied ✓" : "Copy AI Memo"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={ai.status === "loading" || !aiPayload}
                  className="rounded-lg bg-sage px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sage-dark disabled:cursor-not-allowed disabled:bg-faint"
                >
                  {ai.status === "loading"
                    ? "Generating…"
                    : ai.status === "success"
                      ? "Regenerate AI Memo"
                      : "Generate AI Memo"}
                </button>
              </div>
            </div>

            <div className="px-5 py-4">
              {ai.status === "idle" && (
                <p className="py-2 text-sm leading-relaxed text-muted">
                  Optional: generate a narrative memo from the deterministic
                  results using the button above. The memo uses only sanitized
                  computed figures — never raw rows — and the numbers remain the
                  source of truth.
                </p>
              )}

              {ai.status === "loading" && (
                <div className="flex items-center gap-2 py-6 text-sm text-muted">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-sage" />
                  Generating narrative memo from computed results…
                </div>
              )}

              {ai.status === "error" && (
                <div className="rounded-lg border border-danger-line bg-danger-bg px-4 py-3">
                  <p className="text-sm font-semibold text-danger">
                    AI memo unavailable
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-danger/90">
                    {ai.message}
                  </p>
                  <p className="mt-1 text-xs text-danger/80">
                    The deterministic brief remains complete and accurate.
                  </p>
                </div>
              )}

              {ai.status === "success" && (
                <div className="max-h-[460px] space-y-4 overflow-y-auto pr-1">
                  {MEMO_SECTIONS.map(({ key, heading }) => {
                    const value = ai.memo[key];
                    return (
                      <div key={key}>
                        <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
                          {heading}
                        </h4>
                        {Array.isArray(value) ? (
                          <ol className="mt-1.5 list-decimal space-y-1 pl-5">
                            {value.map((item, i) => (
                              <li
                                key={i}
                                className="text-sm leading-relaxed text-ink-soft"
                              >
                                {item}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                            {value}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  <p className="rounded-lg border border-line bg-card-alt px-3 py-2 text-xs text-muted">
                    The numbers remain the source of truth. This narrative was
                    generated only from the deterministic computed results.
                  </p>
                </div>
              )}

              <p className="mt-4 rounded-lg border border-warn-line bg-warn-bg px-3 py-2 text-[11px] leading-relaxed text-warn">
                Synthetic / anonymized data only. The AI memo sends a sanitized
                computed-results payload — never raw rows or original CSV text.
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-warn-line bg-warn-bg/60 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="text-warn" aria-hidden>
                !
              </span>
              <h3 className="text-sm font-semibold text-ink">
                What this analysis cannot conclude
              </h3>
            </div>
            <ul className="mt-3 space-y-2">
              {cannotConclude.length === 0 ? (
                <li className="flex gap-2 text-xs leading-relaxed text-ink-soft">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-warn" aria-hidden />
                  All analysis dimensions were computable, but signal-level limits
                  still apply — confirm drivers before any billing action.
                </li>
              ) : (
                cannotConclude.map((d) => (
                  <li
                    key={d.key}
                    className="flex gap-2 text-xs leading-relaxed text-ink-soft"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-warn" aria-hidden />
                    {CANNOT_CONCLUDE[d.key]}
                  </li>
                ))
              )}
            </ul>
            <p className="mt-3 border-t border-warn-line pt-3 text-[11px] leading-relaxed text-warn">
              <span className="font-semibold">
                N/A means not computable, not zero.
              </span>{" "}
              This tool prioritizes human review — it does not make autonomous
              credit or billing decisions.
            </p>
          </section>

        </div>
      </div>

      <div className="flex justify-end border-t border-line pt-4">
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg bg-sage px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sage-dark"
        >
          Start Over
        </button>
      </div>
    </div>
  );
}
