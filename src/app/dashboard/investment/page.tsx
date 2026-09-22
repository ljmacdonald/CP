"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { formatMinorUnits } from "@/lib/money";
import type { InvestmentPositionsRow } from "@/types/database";

export default function InvestmentsListPage() {
  const [positions, setPositions] = useState<InvestmentPositionsRow[] | null>(null);

  useEffect(() => {
    fetch("/api/positions", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((json) => setPositions(json.positions ?? []))
      .catch(() => setPositions([]));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Investments</h1>
        <LinkButton href="/dashboard/deposit" size="sm">
          Invest now
        </LinkButton>
      </div>

      {positions === null ? (
        <Card className="p-8 text-sm text-ink-muted">Loading…</Card>
      ) : positions.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <p className="text-sm font-medium text-ink">You don&apos;t have any investments yet.</p>
          <LinkButton href="/dashboard/deposit">Invest now</LinkButton>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {positions.map((position) => (
            <Link key={position.id} href={`/dashboard/investment/${position.id}`}>
              <Card className="flex flex-wrap items-center justify-between gap-4 p-5 transition hover:border-border-strong">
                <div>
                  <p className="text-sm font-semibold text-ink">Growth Portfolio</p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    Started {new Date(position.start_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="font-tabular text-sm font-semibold text-ink">
                  {formatMinorUnits(position.principal_minor_units)}
                </div>
                <Badge tone={statusTone(position.status)}>{position.status}</Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
