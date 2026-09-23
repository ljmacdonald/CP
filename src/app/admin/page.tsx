"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatTile } from "@/components/ui/StatTile";
import { Badge, statusTone } from "@/components/ui/Badge";
import { formatMinorUnits, minorUnitsToMajorNumber } from "@/lib/money";
import type { AdminMetrics } from "@/lib/services/adminService";
import type { DepositsRow, WithdrawalsRow, UsersRow, TransactionsRow, InvestmentProductsRow } from "@/types/database";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
}

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [deposits, setDeposits] = useState<DepositsRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalsRow[]>([]);
  const [users, setUsers] = useState<UsersRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionsRow[]>([]);
  const [products, setProducts] = useState<InvestmentProductsRow[]>([]);
  const [togglingInvesting, setTogglingInvesting] = useState(false);

  const loadProducts = () =>
    getJson<{ products: InvestmentProductsRow[] }>("/api/admin/products")
      .then((r) => setProducts(r.products))
      .catch(() => {});

  useEffect(() => {
    getJson<AdminMetrics>("/api/admin/metrics").then(setMetrics).catch(() => {});
    getJson<{ deposits: DepositsRow[] }>("/api/admin/deposits").then((r) => setDeposits(r.deposits)).catch(() => {});
    getJson<{ withdrawals: WithdrawalsRow[] }>("/api/admin/withdrawals")
      .then((r) => setWithdrawals(r.withdrawals))
      .catch(() => {});
    getJson<{ users: UsersRow[] }>("/api/admin/users").then((r) => setUsers(r.users)).catch(() => {});
    getJson<{ transactions: TransactionsRow[] }>("/api/admin/transactions")
      .then((r) => setTransactions(r.transactions))
      .catch(() => {});
    loadProducts();
  }, []);

  // New deposits require at least one product with status "active" (see
  // getDefaultProduct) — this toggles the earliest-created one, the same
  // product that path picks, so this single button is a reliable platform-
  // wide switch as long as there's only the one seeded product. With more
  // than one product, use the Products page below for per-product control.
  const primaryProduct = products[0] ?? null;
  const investingPaused = primaryProduct ? primaryProduct.status !== "active" : false;

  const toggleInvesting = async () => {
    if (!primaryProduct) return;
    setTogglingInvesting(true);
    try {
      await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          productId: primaryProduct.id,
          status: investingPaused ? "active" : "paused",
        }),
      });
      await loadProducts();
    } finally {
      setTogglingInvesting(false);
    }
  };

  const depositChartData = useMemo(() => buildDailySeries(deposits, (d) => d.actual_amount_minor_units), [deposits]);
  const withdrawalChartData = useMemo(
    () => buildDailySeries(withdrawals, (w) => w.amount_minor_units),
    [withdrawals]
  );

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Admin overview</h1>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">New investments</h3>
            {primaryProduct && (
              <Badge tone={investingPaused ? "warning" : "positive"}>
                {investingPaused ? "Paused" : "Open"}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {investingPaused
              ? "Investors cannot start a new deposit right now — the deposit page shows them a paused notice."
              : "Investors can deposit and open new positions normally."}
            {products.length > 1 && (
              <>
                {" "}
                Manage individual products on the{" "}
                <Link href="/admin/products" className="underline underline-offset-2">
                  Products page
                </Link>
                .
              </>
            )}
          </p>
        </div>
        <Button
          variant={investingPaused ? "primary" : "danger"}
          onClick={toggleInvesting}
          disabled={!primaryProduct || togglingInvesting}
        >
          {togglingInvesting ? "Saving…" : investingPaused ? "Resume investing" : "Pause investing"}
        </Button>
      </Card>

      <Card className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 sm:divide-y-0">
        <StatTile label="Total users" value={metrics ? metrics.totalUsers.toLocaleString() : "—"} />
        <StatTile
          label="Total deposits"
          value={metrics ? formatMinorUnits(metrics.totalDepositsMinorUnits) : "—"}
        />
        <StatTile
          label="Total portfolio value"
          value={metrics ? formatMinorUnits(metrics.totalPortfolioValueMinorUnits) : "—"}
        />
        <StatTile
          label="Total earnings"
          value={metrics ? formatMinorUnits(metrics.totalEarningsMinorUnits) : "—"}
          accent
        />
        <StatTile label="Pending deposits" value={metrics ? `${metrics.pendingDeposits}` : "—"} />
        <StatTile label="Pending withdrawals" value={metrics ? `${metrics.pendingWithdrawals}` : "—"} />
        <StatTile label="Active positions" value={metrics ? `${metrics.activePositions}` : "—"} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-4 text-sm font-semibold text-ink">Deposits (confirmed, last 14 days)</h3>
          <MiniBarChart data={depositChartData} color="var(--accent)" />
        </Card>
        <Card className="p-6">
          <h3 className="mb-4 text-sm font-semibold text-ink">Withdrawals (last 14 days)</h3>
          <MiniBarChart data={withdrawalChartData} color="var(--negative)" />
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-ink">Recent deposits</h3>
        <SimpleTable
          rows={deposits.slice(0, 10)}
          columns={[
            { header: "Wallet", render: (d) => truncate(d.wallet_address) },
            { header: "Amount", render: (d) => formatMinorUnits(d.actual_amount_minor_units ?? d.requested_amount_minor_units) },
            { header: "Status", render: (d) => <Badge tone={statusTone(d.status)}>{d.status}</Badge> },
            { header: "Date", render: (d) => new Date(d.created_at).toLocaleString() },
          ]}
        />
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-ink">Recent withdrawals</h3>
        <SimpleTable
          rows={withdrawals.slice(0, 10)}
          columns={[
            { header: "Destination", render: (w) => truncate(w.destination_wallet) },
            { header: "Amount", render: (w) => formatMinorUnits(w.amount_minor_units) },
            { header: "Status", render: (w) => <Badge tone={statusTone(w.status)}>{w.status}</Badge> },
            { header: "Date", render: (w) => new Date(w.created_at).toLocaleString() },
          ]}
        />
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-ink">Recent users</h3>
        <SimpleTable
          rows={users.slice(0, 10)}
          columns={[
            { header: "Wallet", render: (u) => truncate(u.wallet_address) },
            { header: "Status", render: (u) => <Badge tone={statusTone(u.status)}>{u.status}</Badge> },
            { header: "Joined", render: (u) => new Date(u.created_at).toLocaleString() },
          ]}
        />
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-ink">Recent blockchain transactions</h3>
        <SimpleTable
          rows={transactions.slice(0, 10)}
          columns={[
            { header: "Type", render: (t) => t.type },
            { header: "Amount", render: (t) => formatMinorUnits(t.amount_minor_units) },
            { header: "Status", render: (t) => <Badge tone={statusTone(t.status)}>{t.status}</Badge> },
            { header: "Signature", render: (t) => (t.blockchain_signature ? truncate(t.blockchain_signature) : "—") },
          ]}
        />
      </Card>
    </div>
  );
}

function truncate(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function buildDailySeries<T>(rows: T[], amountOf: (row: T) => string | null): { date: string; value: number }[] {
  const days = 14;
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of rows) {
    const dateKey = (row as { created_at?: string }).created_at?.slice(0, 10);
    const amount = amountOf(row);
    if (!dateKey || !amount || !buckets.has(dateKey)) continue;
    buckets.set(dateKey, buckets.get(dateKey)! + minorUnitsToMajorNumber(BigInt(amount)));
  }
  return Array.from(buckets.entries()).map(([date, value]) => ({ date: date.slice(5), value }));
}

function MiniBarChart({ data, color }: { data: { date: string; value: number }[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--ink-faint)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "var(--ink-faint)" }} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12, background: "var(--surface)" }}
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SimpleTable<T>({
  rows,
  columns,
}: {
  rows: T[];
  columns: { header: string; render: (row: T) => React.ReactNode }[];
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">No data yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-ink-faint">
            {columns.map((c) => (
              <th key={c.header} className="pb-2.5 pr-4 font-medium">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.header} className="py-2.5 pr-4 text-ink">
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
