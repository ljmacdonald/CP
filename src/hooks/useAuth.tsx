"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";

export type AuthStatus = "loading" | "idle" | "connecting" | "authenticating" | "authenticated" | "error";

export interface AuthState {
  status: AuthStatus;
  userId: string | null;
  walletAddress: string | null;
  isAdmin: boolean;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message ?? "Something went wrong. Please try again.");
  }
  return json as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage, connected, connecting, disconnect } = useWallet();
  const [state, setState] = useState<AuthState>({
    status: "loading",
    userId: null,
    walletAddress: null,
    isAdmin: false,
    error: null,
  });
  const signInAttempted = useRef<string | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { credentials: "same-origin" });
      const json = await res.json();
      if (json.authenticated) {
        setState((s) => ({
          ...s,
          status: "authenticated",
          userId: json.userId,
          walletAddress: json.walletAddress,
          isAdmin: json.isAdmin,
          error: null,
        }));
        return true;
      }
      setState((s) => ({ ...s, status: "idle", userId: null, walletAddress: null, isAdmin: false }));
      return false;
    } catch {
      setState((s) => ({ ...s, status: "idle" }));
      return false;
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const signIn = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setState((s) => ({
        ...s,
        status: "error",
        error: "This wallet does not support message signing, which is required to sign in.",
      }));
      return;
    }

    const walletAddress = publicKey.toBase58();
    if (signInAttempted.current === walletAddress) return;
    signInAttempted.current = walletAddress;

    setState((s) => ({ ...s, status: "authenticating", error: null }));

    try {
      const { message, challengeToken } = await postJson<{ message: string; challengeToken: string }>(
        "/api/auth/challenge",
        { walletAddress }
      );

      const signatureBytes = await signMessage(new TextEncoder().encode(message));
      const signature = bs58.encode(signatureBytes);

      const result = await postJson<{ userId: string; walletAddress: string }>("/api/auth/verify", {
        walletAddress,
        message,
        signature,
        challengeToken,
      });

      await refreshSession();
      void result;
    } catch (error) {
      signInAttempted.current = null;
      setState((s) => ({
        ...s,
        status: "error",
        error: error instanceof Error ? error.message : "Could not sign in with this wallet.",
      }));
    }
  }, [publicKey, signMessage, refreshSession]);

  useEffect(() => {
    if (connected && publicKey && state.status !== "authenticated" && state.status !== "authenticating") {
      void signIn();
    }
  }, [connected, publicKey, state.status, signIn]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    signInAttempted.current = null;
    await disconnect().catch(() => {});
    setState({ status: "idle", userId: null, walletAddress: null, isAdmin: false, error: null });
  }, [disconnect]);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, status: s.status === "error" ? "idle" : s.status, error: null }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, status: connecting ? "connecting" : state.status, signOut, clearError }),
    [state, connecting, signOut, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
