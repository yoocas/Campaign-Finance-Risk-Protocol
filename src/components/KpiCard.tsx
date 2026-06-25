interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  /** Visual emphasis for the metric. */
  tone?: "neutral" | "positive" | "warning" | "critical";
}

const toneStyles: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  neutral: "text-slate-900",
  positive: "text-emerald-600",
  warning: "text-amber-600",
  critical: "text-rose-600",
};

export default function KpiCard({
  label,
  value,
  sub,
  tone = "neutral",
}: KpiCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-3 text-2xl font-semibold tabular-nums ${toneStyles[tone]}`}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
}
