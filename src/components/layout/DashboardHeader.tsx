"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { useAuth } from "@/hooks/useAuth";

const navLinks = [
  { href: "/dashboard", label: "Portfolio" },
  { href: "/dashboard/investment", label: "Investments" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/how-it-works", label: "How it works" },
];

export function DashboardHeader() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" prefetch={false} className="text-lg font-semibold tracking-tight text-ink">
            YIELD
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            {navLinks.map((link) => {
              const active = link.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  className={active ? "text-ink" : "text-ink-muted transition hover:text-ink"}
                >
                  {link.label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link href="/admin" className="text-ink-muted transition hover:text-ink">
                Admin
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <ConnectWalletButton />
          <button
            className="rounded-lg p-2 text-ink md:hidden"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <MenuIcon open={mobileOpen} />
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav className="flex flex-col gap-1 border-t border-border px-5 py-3 md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-surface"
            >
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-surface"
            >
              Admin
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {open ? (
        <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
      )}
    </svg>
  );
}
