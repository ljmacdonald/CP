"use client";

import type { ReactNode } from "react";
import { SolanaWalletProvider } from "@/components/wallet/WalletContext";
import { AuthProvider } from "@/hooks/useAuth";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SolanaWalletProvider>
      <AuthProvider>{children}</AuthProvider>
    </SolanaWalletProvider>
  );
}
