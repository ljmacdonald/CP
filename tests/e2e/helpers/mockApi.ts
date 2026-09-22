import type { Page } from "@playwright/test";

export async function mockJson(
  page: Page,
  urlGlob: string,
  body: unknown,
  opts: { status?: number; method?: string } = {}
): Promise<void> {
  await page.route(urlGlob, async (route) => {
    if (opts.method && route.request().method() !== opts.method) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: opts.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

export async function mockMe(
  page: Page,
  user: { userId: string; walletAddress: string; isAdmin?: boolean } | null
): Promise<void> {
  await mockJson(
    page,
    "**/api/me",
    user ? { authenticated: true, ...user, isAdmin: user.isAdmin ?? false } : { authenticated: false }
  );
}

/**
 * Fulfills the SSE mock with one snapshot event, like the real endpoint's
 * first push. Only use this in a test that actually asserts on that pushed
 * data (e.g. dashboard-update) — a fulfilled `text/event-stream` response
 * closes immediately, and per the EventSource spec the browser auto-reconnects
 * on any closed connection, so every other test that merely lands on
 * /dashboard would otherwise leave a reconnect loop running against this
 * origin for the rest of the suite. Use `mockStreamHang` instead when a test
 * doesn't care about live updates.
 */
export async function mockStream(page: Page, snapshot: unknown): Promise<void> {
  await page.route("**/api/stream", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`,
    });
  });
}

/**
 * Leaves /api/stream connecting forever (never fulfills), matching how the
 * real endpoint behaves (it never closes on its own) and avoiding the
 * EventSource auto-reconnect storm described on `mockStream` above. Use this
 * in any test that lands on /dashboard but isn't testing the live stream.
 */
export async function mockStreamHang(page: Page): Promise<void> {
  await page.route("**/api/stream", () => new Promise<void>(() => {}));
}

/** Blocks real Solana RPC calls (getLatestBlockhash, getSignatureStatus, …) with per-method fixtures. */
export async function mockSolanaRpc(page: Page, handlers: Record<string, unknown>): Promise<void> {
  await page.route("**/api.devnet.solana.com/**", async (route) => {
    const body = route.request().postDataJSON() as { method: string; id: number };
    const result = handlers[body.method];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ jsonrpc: "2.0", id: body.id, result: result ?? null }),
    });
  });
}
