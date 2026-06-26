import { BarChart3 } from "lucide-react";

interface TopHeaderProps {
  /** Loads the verified sample dataset and jumps into the workflow. */
  onLoadSample: () => void;
  /** Clears all session state back to step 1. */
  onStartOver: () => void;
}

/**
 * Persistent application header: brand mark, synthetic-data pill, and the two
 * global actions that map to real workflow behavior (Load Sample / Start Over).
 */
export default function TopHeader({ onLoadSample, onStartOver }: TopHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line bg-ivory px-6 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage text-white shadow-sm">
          <BarChart3 size={20} strokeWidth={2.2} aria-hidden />
        </span>
        <div>
          <h1 className="font-serif text-base font-semibold leading-tight tracking-tight text-ink">
            Campaign Finance Risk Copilot
          </h1>
          <p className="text-xs text-muted">Mock adtech finance workflow</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="hidden items-center gap-1.5 rounded-full border border-warn-line bg-warn-bg px-3 py-1.5 text-xs font-medium text-warn sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-warn" aria-hidden />
          Synthetic / Anonymized Data Only
        </span>
        <button
          type="button"
          onClick={onLoadSample}
          className="rounded-lg border border-line bg-card px-3.5 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-card-alt"
        >
          Load Sample
        </button>
        <button
          type="button"
          onClick={onStartOver}
          className="rounded-lg border border-line bg-card px-3.5 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-card-alt"
        >
          Start Over
        </button>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full bg-sage-tint text-xs font-semibold text-sage-deep"
          aria-hidden
        >
          AR
        </span>
      </div>
    </header>
  );
}
