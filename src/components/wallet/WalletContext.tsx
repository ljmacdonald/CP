"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { useMemo, type ReactNode } from "react";
import { clientEnv } from "@/lib/env.client";

/**
 * No explicit wallet adapters are registered here — `wallets={[]}` relies
 * entirely on the Wallet Standard, so any compatible installed wallet
 * (Phantom, Solflare, Backpack, etc.) is auto-detected without us shipping
 * per-wallet SDKs.
 *
 * `autoConnect` is on so that calling `select(walletName)` (see
 * WalletSelectModal) is enough to connect — wallet-adapter-react performs
 * the actual `.connect()` once the selected wallet's adapter is ready.
 * Calling `connect()` ourselves immediately after `select()` doesn't work:
 * `select` only *schedules* a state update, so a `connect` obtained from the
 * same render still closes over the previous (unselected) wallet and throws
 * WalletNotSelectedError.
 */
export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => clientEnv.solanaRpcUrl, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
