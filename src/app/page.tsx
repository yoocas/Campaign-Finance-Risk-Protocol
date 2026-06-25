import CampaignWorkflow from "@/components/CampaignWorkflow";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-6 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Campaign Finance Risk Copilot
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Mock adtech revenue leakage, margin risk, and billing
                discrepancy workflow
              </p>
            </div>
            <span className="max-w-md rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800">
              <span className="font-semibold">Prototype</span> uses
              mock/anonymized data only. Do not upload confidential client,
              publisher, or financial data.
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <CampaignWorkflow />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-6 py-5">
          <p className="text-xs text-slate-400">
            Math is deterministic. AI layer can be added later for narrative
            summaries and finance/ops memos.
          </p>
        </div>
      </footer>
    </div>
  );
}
