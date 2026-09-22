import { Badge, statusTone } from "@/components/ui/Badge";
import { formatMinorUnits } from "@/lib/money";
import { explorerTxUrl } from "@/lib/env.client";
import type { TransactionsRow } from "@/types/database";

const typeLabels: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  earning: "Earning",
  redemption: "Redemption",
};

export function TransactionList({ transactions }: { transactions: TransactionsRow[] }) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 px-6 py-16 text-center text-sm text-ink-muted">
        No transactions yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {transactions.map((tx) => (
        <div key={tx.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-ink">{typeLabels[tx.type] ?? tx.type}</span>
              <Badge tone={statusTone(tx.status)}>{tx.status}</Badge>
            </div>
            <p className="mt-1 text-xs text-ink-faint">{new Date(tx.created_at).toLocaleString()}</p>
          </div>
          <div className="text-right">
            <div className="font-tabular text-sm font-semibold text-ink">{formatMinorUnits(tx.amount_minor_units)}</div>
            {tx.blockchain_signature && (
              <a
                href={explorerTxUrl(tx.blockchain_signature)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent underline underline-offset-2"
              >
                View on Explorer
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
