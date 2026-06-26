import { ArrowRight } from "lucide-react";

interface StepHeaderProps {
  stepNumber: number;
  totalSteps?: number;
  title: string;
  description: string;
  onBack?: () => void;
  backLabel?: string;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  /** Show the trailing arrow on the primary action (advance steps). */
  nextArrow?: boolean;
}

/**
 * Page-level header for a workflow step: "STEP X OF 5", title, description on
 * the left; Back + primary advance action on the right (mockup placement).
 */
export default function StepHeader({
  stepNumber,
  totalSteps = 5,
  title,
  description,
  onBack,
  backLabel = "Back",
  onNext,
  nextLabel,
  nextDisabled = false,
  nextArrow = true,
}: StepHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
          Step {stepNumber} of {totalSteps}
        </p>
        <h2 className="mt-1 font-serif text-xl font-semibold tracking-tight text-ink">
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
      </div>

      {(onBack || onNext) && (
        <div className="flex shrink-0 items-center gap-2.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-card-alt"
            >
              {backLabel}
            </button>
          )}
          {onNext && nextLabel && (
            <button
              type="button"
              onClick={onNext}
              disabled={nextDisabled}
              className="inline-flex items-center gap-2 rounded-lg bg-sage px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sage-dark disabled:cursor-not-allowed disabled:bg-faint"
            >
              {nextLabel}
              {nextArrow && <ArrowRight size={16} strokeWidth={2.4} aria-hidden />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
