import { requireSession } from "@/lib/auth/session";
import { getDashboardSnapshot } from "@/lib/services/dashboardService";
import { apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 2_000;
const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * Server-Sent Events endpoint that polls this user's dashboard snapshot and
 * pushes it to the browser whenever it changes, so a confirmed deposit or
 * accrual updates the UI without a page refresh. Polling (rather than
 * Postgres LISTEN/NOTIFY or Supabase Realtime channels) keeps this endpoint
 * self-contained and correctly scoped to the authenticated user without
 * needing to bridge our wallet-based session into Postgres RLS/auth.uid().
 */
export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch (error) {
    return apiError(401, "wallet_not_connected", (error as Error).message);
  }

  const userId = session.userId;
  const encoder = new TextEncoder();
  let closed = false;
  let pollInterval: ReturnType<typeof setInterval> | undefined;
  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      let lastPayload = "";

      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const poll = async () => {
        if (closed) return;
        try {
          const snapshot = await getDashboardSnapshot(userId);
          const serialized = JSON.stringify(snapshot);
          if (serialized !== lastPayload) {
            lastPayload = serialized;
            send("snapshot", snapshot);
          }
        } catch {
          // Transient DB/RPC errors shouldn't kill the stream; next tick retries.
        }
      };

      await poll();
      pollInterval = setInterval(poll, POLL_INTERVAL_MS);
      heartbeatInterval = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, HEARTBEAT_INTERVAL_MS);
    },
    cancel() {
      closed = true;
      if (pollInterval) clearInterval(pollInterval);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
