type Tone = "neutral" | "positive" | "warning" | "negative";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-bg text-ink-muted border-border-strong",
  positive: "bg-accent-soft text-accent-strong border-accent/20",
  warning: "bg-[#fdf3e2] text-[#8a5a10] border-[#e9c98a]",
  negative: "bg-negative-soft text-negative border-negative/20",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): Tone {
  const positive = ["confirmed", "completed", "active"];
  const warning = ["pending", "submitted", "confirming", "verifying", "processing"];
  const negative = ["failed", "expired", "rejected", "cancelled"];
  if (positive.includes(status)) return "positive";
  if (warning.includes(status)) return "warning";
  if (negative.includes(status)) return "negative";
  return "neutral";
}
