const steps = ["Your Wallet", "YIELD Platform", "Investment Portfolio", "Returns", "Your Wallet"];

export function FlowDiagram() {
  return (
    <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
      {steps.map((step, i) => (
        <div key={`${step}-${i}`} className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
          <div className="rounded-full border border-border-strong bg-surface px-5 py-2.5 text-sm font-medium text-ink shadow-sm">
            {step}
          </div>
          {i < steps.length - 1 && (
            <span className="text-ink-faint" aria-hidden>
              <span className="hidden sm:inline">→</span>
              <span className="sm:hidden">↓</span>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
