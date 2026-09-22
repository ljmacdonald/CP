"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { TransactionList } from "@/components/transactions/TransactionList";
import type { TransactionsRow, TransactionType } from "@/types/database";

const tabs: { key: TransactionType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "deposit", label: "Deposits" },
  { key: "withdrawal", label: "Withdrawals" },
  { key: "earning", label: "Earnings" },
];

export default function TransactionsPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("all");
  const [transactions, setTransactions] = useState<TransactionsRow[] | null>(null);
  const [loadedTab, setLoadedTab] = useState<(typeof tabs)[number]["key"] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const query = tab === "all" ? "" : `?type=${tab}`;
    fetch(`/api/transactions${query}`, { credentials: "same-origin" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setTransactions(json.transactions ?? []);
        setLoadedTab(tab);
      })
      .catch(() => {
        if (cancelled) return;
        setTransactions([]);
        setLoadedTab(tab);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const loading = loadedTab !== tab;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Transactions</h1>

      <div className="flex gap-1 rounded-full border border-border bg-surface p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t.key ? "bg-bg text-ink shadow-sm" : "text-ink-faint hover:text-ink-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="px-6 sm:px-7">
        {loading || transactions === null ? (
          <div className="py-16 text-center text-sm text-ink-muted">Loading…</div>
        ) : (
          <TransactionList transactions={transactions} />
        )}
      </Card>
    </div>
  );
}
