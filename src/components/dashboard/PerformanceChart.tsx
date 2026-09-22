"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMinorUnits, minorUnitsToMajorNumber } from "@/lib/money";
import { ChartErrorBoundary } from "@/components/dashboard/ChartErrorBoundary";

const PERIODS = [
  { key: "7D", days: 7 },
  { key: "30D", days: 30 },
  { key: "90D", days: 90 },
  { key: "1Y", days: 365 },
  { key: "ALL", days: Infinity },
] as const;

type PeriodKey = (typeof PERIODS)[number]["key"];

export interface PerformancePoint {
  date: string;
  value: string;
}

export function PerformanceChart({ data }: { data: PerformancePoint[] }) {
  const [period, setPeriod] = useState<PeriodKey>("30D");
  // Recharts' ResponsiveContainer measures its container via ResizeObserver;
  // rendering it only after mount avoids a class of intermittent measurement
  // races tied to the very first paint (see ChartErrorBoundary for the
  // belt-and-suspenders fallback if it still throws).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate SSR/client mount gate, not derivable from props/state
    setMounted(true);
  }, []);

  const filtered = useMemo(() => {
    const activeDays = PERIODS.find((p) => p.key === period)?.days ?? 30;
    if (!Number.isFinite(activeDays)) return data;
    return data.slice(-activeDays);
  }, [data, period]);

  const chartData = useMemo(
    () =>
      filtered.map((point) => ({
        date: point.date,
        value: minorUnitsToMajorNumber(BigInt(point.value)),
      })),
    [filtered]
  );

  const isEmpty = chartData.length < 2;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Portfolio performance</h3>
        <div className="flex gap-1 rounded-full border border-border bg-bg p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                period === p.key ? "bg-surface text-ink shadow-sm" : "text-ink-faint hover:text-ink-muted"
              }`}
            >
              {p.key}
            </button>
          ))}
        </div>
      </div>

      {isEmpty ? (
        <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-border-strong text-sm text-ink-faint">
          Performance will appear here once your investment has a few days of history.
        </div>
      ) : !mounted ? (
        <div className="h-56" />
      ) : (
        <ChartErrorBoundary>
          <ResponsiveContainer width="100%" height={224}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--ink-faint)" }}
                minTickGap={32}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--ink-faint)" }}
                width={56}
                tickFormatter={(v: number) => `₦${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value) => [formatMinorUnits(BigInt(Math.round(Number(value) * 100))), "Value"]}
                labelFormatter={(label) => String(label)}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  fontSize: 12,
                  background: "var(--surface)",
                }}
              />
              <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#portfolioGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartErrorBoundary>
      )}
    </div>
  );
}
