import type { ReactNode } from "react";
import Link from "next/link";
import { AdminGate } from "@/components/layout/AdminGate";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGate>
      <DashboardHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-10">
        <div className="mb-6 flex items-center gap-6 border-b border-border pb-4 text-sm font-medium">
          <Link href="/admin" className="text-ink">
            Overview
          </Link>
          <Link href="/admin/products" className="text-ink-muted transition hover:text-ink">
            Products
          </Link>
        </div>
        {children}
      </main>
    </AdminGate>
  );
}
