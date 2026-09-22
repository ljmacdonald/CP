"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { WalletSelectModal } from "@/components/wallet/WalletSelectModal";

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function ConnectWalletButton({ className = "" }: { className?: string }) {
  const { status, walletAddress, signOut, error, clearError } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (status === "authenticated" && walletAddress) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-ink shadow-sm transition hover:border-border-strong"
        >
          <span className="h-2 w-2 rounded-full bg-accent" />
          {truncateAddress(walletAddress)}
          <ChevronIcon />
        </button>
        {menuOpen && (
          <div className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-surface shadow-lg animate-fade-up">
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push("/dashboard");
              }}
              className="block w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-bg"
            >
              Dashboard
            </button>
            <button
              onClick={async () => {
                setMenuOpen(false);
                await signOut();
                router.push("/");
              }}
              className="block w-full px-4 py-2.5 text-left text-sm text-negative hover:bg-negative-soft"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  const isBusy = status === "connecting" || status === "authenticating";

  return (
    <>
      <button
        onClick={() => {
          clearError();
          setModalOpen(true);
        }}
        disabled={isBusy}
        className={`inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-60 ${className}`}
      >
        {isBusy && <Spinner />}
        {status === "authenticating" ? "Sign the message..." : status === "connecting" ? "Connecting..." : "Connect Wallet"}
      </button>
      {error && (
        <p role="alert" className="mt-2 max-w-xs text-xs text-negative">
          {error}
        </p>
      )}
      <WalletSelectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
