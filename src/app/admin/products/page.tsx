"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import type { InvestmentProductsRow } from "@/types/database";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<InvestmentProductsRow[]>([]);
  const [editing, setEditing] = useState<Record<string, { rate: string; cycle: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    fetch("/api/admin/products", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((json) => {
        const list: InvestmentProductsRow[] = json.products ?? [];
        setProducts(list);
        setEditing(
          Object.fromEntries(
            list.map((p) => [p.id, { rate: (p.target_annual_rate_bps / 100).toString(), cycle: p.cycle_days.toString() }])
          )
        );
      })
      .catch(() => {});
  };

  useEffect(load, []);

  const handleSave = async (product: InvestmentProductsRow) => {
    setSavingId(product.id);
    setMessage(null);
    try {
      const edited = editing[product.id];
      const res = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          productId: product.id,
          targetAnnualRateBps: Math.round(Number(edited?.rate ?? 0) * 100),
          cycleDays: Number(edited?.cycle ?? product.cycle_days),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Could not update product.");
      setMessage("Saved. This change was recorded in the audit log.");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update product.");
    } finally {
      setSavingId(null);
    }
  };

  const toggleStatus = async (product: InvestmentProductsRow) => {
    setSavingId(product.id);
    try {
      const nextStatus = product.status === "active" ? "paused" : "active";
      const res = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ productId: product.id, status: nextStatus }),
      });
      if (!res.ok) throw new Error("Could not update status.");
      load();
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Investment products</h1>
      {message && <p className="text-sm text-ink-muted">{message}</p>}

      <div className="flex flex-col gap-4">
        {products.map((product) => (
          <Card key={product.id} className="p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-ink">{product.name}</h3>
                <Badge tone={statusTone(product.status)}>{product.status}</Badge>
              </div>
              <Button variant="secondary" size="sm" onClick={() => toggleStatus(product)} disabled={savingId === product.id}>
                {product.status === "active" ? "Pause" : "Activate"}
              </Button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                  Target rate (%)
                </label>
                <input
                  value={editing[product.id]?.rate ?? ""}
                  onChange={(e) =>
                    setEditing((s) => ({ ...s, [product.id]: { ...s[product.id]!, rate: e.target.value } }))
                  }
                  className="mt-1.5 w-full rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm font-tabular outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-ink-faint">Cycle (days)</label>
                <input
                  value={editing[product.id]?.cycle ?? ""}
                  onChange={(e) =>
                    setEditing((s) => ({ ...s, [product.id]: { ...s[product.id]!, cycle: e.target.value } }))
                  }
                  className="mt-1.5 w-full rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm font-tabular outline-none focus:border-ink"
                />
              </div>
            </div>

            <Button className="mt-5" size="sm" onClick={() => handleSave(product)} disabled={savingId === product.id}>
              {savingId === product.id ? "Saving…" : "Save changes"}
            </Button>
            <p className="mt-2 text-xs text-ink-faint">
              Every change here is written to the audit log with the admin wallet, before and after values.
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
