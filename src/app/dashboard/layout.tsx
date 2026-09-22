import type { ReactNode } from "react";
import { AuthGate } from "@/components/layout/AuthGate";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <DashboardHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-10">{children}</main>
    </AuthGate>
  );
}
