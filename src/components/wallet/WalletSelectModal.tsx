"use client";

import { useWallet, type Wallet } from "@solana/wallet-adapter-react";
import { useEffect } from "react";

export function WalletSelectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { wallets, select } = useWallet();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // `select` only schedules the wallet-adapter context to pick this wallet;
  // actual connection happens via WalletProvider's autoConnect once that
  // state update lands (see WalletContext.tsx for why we don't call
  // connect() here directly).
  const handleSelect = (w: Wallet) => {
    select(w.adapter.name);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl border border-border bg-surface p-6 shadow-2xl sm:rounded-2xl animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Connect a wallet</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-ink-faint transition hover:bg-bg hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>

        {wallets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong p-5 text-sm text-ink-muted">
            No Solana wallets were detected in this browser. Install{" "}
            <a
              href="https://phantom.app"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent underline underline-offset-2"
            >
              Phantom
            </a>{" "}
            or another Wallet Standard–compatible wallet, then refresh this page.
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {wallets.map((w) => (
              <li key={w.adapter.name}>
                <button
                  onClick={() => handleSelect(w)}
                  className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition hover:border-border hover:bg-bg"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={w.adapter.icon} alt="" width={28} height={28} className="rounded-md" />
                  <span className="text-sm font-medium text-ink">{w.adapter.name}</span>
                  <span className="ml-auto text-xs text-ink-faint">{w.readyState === "Installed" ? "Detected" : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-5 text-xs leading-relaxed text-ink-faint">
          Your wallet&apos;s public address becomes your YIELD identity. We never ask for a password, email, or your
          seed phrase.
        </p>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}
