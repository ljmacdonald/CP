"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardStream } from "@/hooks/useDashboardStream";
import { StatTile } from "@/components/ui/StatTile";
import { Card } from "@/components/ui/Card";
import { ActiveInvestmentCard } from "@/components/dashboard/ActiveInvestmentCard";
import { PerformanceChart, type PerformancePoint } from "@/components/dashboard/PerformanceChart";
import { DepositConfirmedBanner } from "@/components/dashboard/DepositConfirmedBanner";
import { formatMinorUnits } from "@/lib/money";

function truncate(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function DashboardPage() {
  const { walletAddress } = useAuth();
  const { snapshot, loading, error } = useDashboardStream();
  const [performance, setPerformance] = useState<PerformancePoint[]>([]);

  const positionId = snapshot?.activePosition?.position.id;

  useEffect(() => {
    if (!positionId) return;
    let cancelled = false;
    fetch(`/api/positions/${positionId}`, { credentials: "same-origin" })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.performance) setPerformance(json.performance);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [positionId]);

  return (
    <div className="flex flex-col gap-8">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Welcome back.</h1>
        {walletAddress && <p className="mt-1 font-tabular text-sm text-ink-muted">{truncate(walletAddress)}</p>}
      </div>

      <DepositConfirmedBanner deposit={snapshot?.latestDeposit ?? null} />

      {error && (
        <Card className="border-negative/30 bg-negative-soft px-5 py-4 text-sm text-negative">{error}</Card>
      )}

      <Card className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
        <StatTile
          label="Portfolio value"
          value={loading ? "—" : formatMinorUnits(snapshot?.portfolioValueMinorUnits ?? "0")}
        />
        <StatTile
          label="Today's earnings"
          value={loading ? "—" : formatMinorUnits(snapshot?.todaysEarningsMinorUnits ?? "0")}
          accent
        />
        <StatTile
          label="Total earnings"
          value={loading ? "—" : formatMinorUnits(snapshot?.totalEarningsMinorUnits ?? "0")}
          accent
        />
        <StatTile
          label="Target annualized return"
          value={loading || !snapshot ? "—" : `${(snapshot.product.target_annual_rate_bps / 100).toFixed(1)}%`}
        />
      </Card>

      <Card className="p-6 sm:p-7">
        <PerformanceChart data={performance} />
      </Card>

      <ActiveInvestmentCard activePosition={snapshot?.activePosition ?? null} />
    </div>
  );
}
