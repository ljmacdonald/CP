"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardSnapshot } from "@/lib/services/dashboardService";

export interface DashboardStreamState {
  snapshot: DashboardSnapshot | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
}

/**
 * Subscribes to /api/stream (Server-Sent Events) for live dashboard updates
 * and falls back to a one-off fetch if EventSource is unavailable or the
 * stream errors out, so the UI degrades gracefully rather than going blank.
 */
export function useDashboardStream(): DashboardStreamState {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchOnce = async () => {
      try {
        const res = await fetch("/api/dashboard", { credentials: "same-origin" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? "Could not load your dashboard.");
        if (!cancelled) {
          setSnapshot(json);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load your dashboard.");
          setLoading(false);
        }
      }
    };

    void fetchOnce();

    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return () => {
        cancelled = true;
      };
    }

    const source = new EventSource("/api/stream");

    source.addEventListener("snapshot", (event) => {
      if (cancelled) return;
      try {
        const data = JSON.parse((event as MessageEvent).data) as DashboardSnapshot;
        setSnapshot(data);
        setLoading(false);
        setError(null);
        setConnected(true);
      } catch {
        // ignore malformed event
      }
    });

    source.onopen = () => setConnected(true);
    source.onerror = () => {
      setConnected(false);
      // EventSource auto-reconnects; also keep the fallback poll warm in case
      // the connection stays down for a while (e.g. a proxy dropping SSE).
      if (!fallbackTimer.current) {
        fallbackTimer.current = setInterval(fetchOnce, 8_000) as unknown as ReturnType<typeof setTimeout>;
      }
    };

    return () => {
      cancelled = true;
      source.close();
      if (fallbackTimer.current) {
        clearInterval(fallbackTimer.current as unknown as number);
        fallbackTimer.current = null;
      }
    };
  }, []);

  return { snapshot, loading, error, connected };
}
