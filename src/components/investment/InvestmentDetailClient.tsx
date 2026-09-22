"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { PerformanceChart, type PerformancePoint } from "@/components/dashboard/PerformanceChart";
import { TransactionList } from "@/components/transactions/TransactionList";
import { RedemptionPanel } from "@/components/investment/RedemptionPanel";
import { formatMinorUnits } from "@/lib/money";
import type { PositionWithLiveValue } from "@/lib/services/investmentService";
import type { TransactionsRow } from "@/types/database";

interface PositionDetailResponse {
  position: PositionWithLiveValue;
  performance: PerformancePoint[];
  transactions: TransactionsRow[];
}

export function InvestmentDetailClient({ id }: { id: string }) {
  const [data, setData] = useState<PositionDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Read the query string directly rather than via next/navigation's
  // useSearchParams(): that hook requires a Suspense boundary and, combined
  // with this component's own data-fetching effect, was observed to trigger
  // an extra mount/unmount cycle whose cleanup could mark an in-flight fetch
  // "cancelled" before it resolved — leaving the page stuck on its loading
  // state even though the request had already succeeded.
  const [autoWithdraw, setAutoWithdraw] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of window.location, not derivable from props/state
    setAutoWithdraw(new URLSearchParams(window.location.search).get("action") === "withdraw");
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/positions/${id}`, { credentials: "same-origin" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? "Could not load this investment.");
        return json as PositionDetailResponse;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this investment.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return <Card className="p-8 text-sm text-negative">{error}</Card>;
  }

  if (!data || !data.position?.product || !data.position?.position) {
    return <Card className="p-8 text-sm text-ink-muted">Loading…</Card>;
  }

  const { position: live, performance, transactions } = data;
  const { position, product, remainingDays, accruedReturn, currentValue } = live;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="text-xs font-medium uppercase tracking-wider text-ink-faint">Investment</span>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{product.name}</h1>
      </div>

      <Card className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
        <StatTile label="Current value" value={formatMinorUnits(currentValue)} accent />
        <StatTile label="Original investment" value={formatMinorUnits(position.principal_minor_units)} />
        <StatTile label="Earned" value={formatMinorUnits(accruedReturn)} accent />
        <StatTile label="Target annualized return" value={`${(product.target_annual_rate_bps / 100).toFixed(1)}%`} />
      </Card>

      <Card className="grid grid-cols-2 gap-y-5 p-6 sm:grid-cols-3 sm:p-7">
        <Field label="Start date" value={new Date(position.start_date).toLocaleDateString()} />
        <Field label="Maturity date" value={new Date(position.maturity_date).toLocaleDateString()} />
        <Field label="Days remaining" value={`${remainingDays}`} />
      </Card>

      <Card className="p-6 sm:p-7">
        <PerformanceChart data={performance} />
      </Card>

      {position.status === "active" && <RedemptionPanel positionId={position.id} autoOpen={autoWithdraw} />}

      <Card className="p-6 sm:p-7">
        <h3 className="mb-1 text-sm font-semibold text-ink">Transaction history</h3>
        <TransactionList transactions={transactions} />
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">{label}</div>
      <div className="font-tabular mt-1 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}
