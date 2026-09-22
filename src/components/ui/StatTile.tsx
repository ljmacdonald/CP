import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 p-5 sm:p-6">
      <span className="text-xs font-medium uppercase tracking-wider text-ink-faint">{label}</span>
      <span className={`font-tabular text-2xl font-semibold sm:text-3xl ${accent ? "text-accent" : "text-ink"}`}>
        {value}
      </span>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </div>
  );
}
