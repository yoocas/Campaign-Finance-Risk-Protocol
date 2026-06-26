import { Check } from "lucide-react";

export interface WorkflowStep {
  id: number;
  label: string;
}

interface WorkflowStepperProps {
  steps: WorkflowStep[];
  current: number;
  /** Steps after Input are locked until data has been loaded. */
  dataLoaded: boolean;
  onSelect: (id: number) => void;
}

const STATUS_LABEL: Record<"complete" | "active" | "pending", string> = {
  complete: "Complete",
  active: "In progress",
  pending: "Pending",
};

/**
 * Left vertical workflow rail. Shows completed / active / pending states, a
 * dynamic progress bar (step N of total → N/total), and the local-session note.
 */
export default function WorkflowStepper({
  steps,
  current,
  dataLoaded,
  onSelect,
}: WorkflowStepperProps) {
  const progress = Math.round((current / steps.length) * 100);

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-line bg-ivory px-4 py-6">
      <nav aria-label="Workflow steps">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
          Workflow
        </p>
        <ol className="mt-3 space-y-1">
          {steps.map((step) => {
            const state =
              step.id === current
                ? "active"
                : step.id < current
                  ? "complete"
                  : "pending";
            const enabled = step.id === 1 || dataLoaded;

            return (
              <li key={step.id}>
                <button
                  type="button"
                  disabled={!enabled}
                  aria-current={state === "active" ? "step" : undefined}
                  onClick={() => enabled && onSelect(step.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    state === "active"
                      ? "bg-sage-tint shadow-sm ring-1 ring-sage-line"
                      : enabled
                        ? "hover:bg-card-alt"
                        : "cursor-not-allowed opacity-55"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      state === "complete"
                        ? "bg-sage-tint text-sage-deep"
                        : state === "active"
                          ? "bg-sage text-white"
                          : "border border-line text-faint"
                    }`}
                  >
                    {state === "complete" ? (
                      <Check size={14} strokeWidth={3} aria-hidden />
                    ) : (
                      step.id
                    )}
                  </span>
                  <span className="flex flex-col">
                    <span
                      className={`text-sm font-medium ${
                        state === "pending" ? "text-muted" : "text-ink"
                      }`}
                    >
                      {step.label}
                    </span>
                    <span
                      className={`text-[11px] ${
                        state === "active" ? "text-sage" : "text-faint"
                      }`}
                    >
                      {STATUS_LABEL[state]}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="rounded-xl border border-line bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-ink-soft">
            Workflow progress
          </span>
          <span className="text-xs font-semibold tabular-nums text-sage">
            {progress}%
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line-soft">
          <div
            className="h-full rounded-full bg-sage transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-3 text-[11px] leading-snug text-muted">
          Step {current} of {steps.length} · raw data stays local to this
          session; the AI memo sends only sanitized computed results.
        </p>
      </div>
    </aside>
  );
}
