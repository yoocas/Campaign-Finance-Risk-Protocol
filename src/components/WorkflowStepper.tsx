export interface WorkflowStep {
  id: number;
  label: string;
  hint: string;
}

interface WorkflowStepperProps {
  steps: WorkflowStep[];
  current: number;
  /** Steps after Input are locked until data has been loaded. */
  dataLoaded: boolean;
  onSelect: (id: number) => void;
}

export default function WorkflowStepper({
  steps,
  current,
  dataLoaded,
  onSelect,
}: WorkflowStepperProps) {
  return (
    <nav aria-label="Workflow steps" className="w-full">
      <ol className="flex w-full items-center">
        {steps.map((step, idx) => {
          const isActive = step.id === current;
          const isComplete = step.id < current;
          const enabled = step.id === 1 || dataLoaded;
          const isLast = idx === steps.length - 1;

          return (
            <li
              key={step.id}
              className={`flex items-center ${isLast ? "" : "flex-1"}`}
            >
              <button
                type="button"
                disabled={!enabled}
                onClick={() => enabled && onSelect(step.id)}
                className={`group flex items-center gap-3 text-left ${
                  enabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : isComplete
                        ? "bg-emerald-600 text-white"
                        : "border border-slate-300 bg-white text-slate-500"
                  }`}
                >
                  {isComplete ? "✓" : step.id}
                </span>
                <span className="hidden flex-col sm:flex">
                  <span
                    className={`text-sm font-medium ${
                      isActive ? "text-slate-900" : "text-slate-600"
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="text-[11px] text-slate-400">{step.hint}</span>
                </span>
              </button>
              {!isLast && (
                <span
                  className={`mx-3 h-px flex-1 ${
                    isComplete ? "bg-emerald-500" : "bg-slate-200"
                  }`}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
