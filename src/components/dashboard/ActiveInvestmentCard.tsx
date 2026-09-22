import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { formatMinorUnits } from "@/lib/money";
import type { PositionWithLiveValue } from "@/lib/services/investmentService";

export function ActiveInvestmentCard({ activePosition }: { activePosition: PositionWithLiveValue | null }) {
  if (!activePosition) {
    return (
      <Card className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <TrendUpIcon />
        </div>
        <div>
          <p className="text-base font-medium text-ink">You don&apos;t have an active investment yet.</p>
          <p className="mt-1 text-sm text-ink-muted">Start putting your money to work.</p>
        </div>
        <LinkButton href="/dashboard/deposit" size="lg">
          Invest now
        </LinkButton>
      </Card>
    );
  }

  const { position, product, elapsedDays, remainingDays, accruedReturn, currentValue } = activePosition;

  return (
    <Card className="p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-ink-faint">Active investment</span>
          <h3 className="mt-1 text-lg font-semibold text-ink">{product.name}</h3>
        </div>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
          {(product.target_annual_rate_bps / 100).toFixed(1)}% target
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        <Field label="Principal" value={formatMinorUnits(position.principal_minor_units)} />
        <Field label="Current value" value={formatMinorUnits(currentValue)} accent />
        <Field label="Earned" value={formatMinorUnits(accruedReturn)} accent />
        <Field label="Days elapsed" value={`${elapsedDays}`} />
        <Field label="Days remaining" value={`${remainingDays}`} />
        <Field label="Maturity date" value={new Date(position.maturity_date).toLocaleDateString()} />
        <Field label="Target rate" value={`${(product.target_annual_rate_bps / 100).toFixed(1)}%`} />
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        <LinkButton href="/dashboard/deposit">Deposit</LinkButton>
        <LinkButton href={`/dashboard/investment/${position.id}?action=withdraw`} variant="secondary">
          Withdraw
        </LinkButton>
        <LinkButton href={`/dashboard/investment/${position.id}`} variant="ghost">
          View investment
        </LinkButton>
      </div>
    </Card>
  );
}

function Field({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={`font-tabular mt-1 text-sm font-semibold ${accent ? "text-accent" : "text-ink"}`}>{value}</div>
    </div>
  );
}

function TrendUpIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 17l6-6 4 4 8-8M21 7v6M21 7h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
