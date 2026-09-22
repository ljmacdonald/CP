"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { status, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "idle" || status === "error") {
      router.replace("/");
    } else if (status === "authenticated" && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [status, isAdmin, router]);

  if (status !== "authenticated" || !isAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center py-32 text-sm text-ink-muted">Loading…</div>
    );
  }

  return <>{children}</>;
}
