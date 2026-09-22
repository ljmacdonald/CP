"use client";

import { useState } from "react";
import { explorerTxUrl } from "@/lib/env.client";
import { formatMinorUnits } from "@/lib/money";
import type { DepositsRow } from "@/types/database";

export function DepositConfirmedBanner({ deposit }: { deposit: DepositsRow | null }) {
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (!deposit || deposit.status !== "confirmed" || !deposit.transaction_signature) return null;
  if (dismissed === deposit.id) return null;

  return (
    <div className="animate-fade-up flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/25 bg-accent-soft px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-bg">
          <CheckIcon />
        </span>
        <div>
          <p className="text-sm font-semibold text-accent-strong">Deposit confirmed</p>
          <p className="text-xs text-ink-muted">
            {formatMinorUnits(deposit.actual_amount_minor_units ?? deposit.requested_amount_minor_units)} added to
            your portfolio.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <a
          href={explorerTxUrl(deposit.transaction_signature)}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-accent-strong underline underline-offset-2"
        >
          View on Explorer
        </a>
        <button
          onClick={() => setDismissed(deposit.id)}
          aria-label="Dismiss"
          className="text-ink-faint transition hover:text-ink"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
