interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  /** Visual emphasis for the metric. */
  tone?: "neutral" | "positive" | "warning" | "critical";
}

const valueTone: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  neutral: "text-ink",
  positive: "text-sage",
  warning: "text-warn",
  critical: "text-danger",
};

const subTone: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  neutral: "text-muted",
  positive: "text-sage",
  warning: "text-warn",
  critical: "text-danger",
};

export default function KpiCard({
  label,
  value,
  sub,
  tone = "neutral",
}: KpiCardProps) {
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3.5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-2 text-xl font-semibold tabular-nums ${valueTone[tone]}`}>
        {value}
      </p>
      {sub ? <p className={`mt-1 text-[11px] ${subTone[tone]}`}>{sub}</p> : null}
    </div>
  );
}
