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

export async function mockStream(page: Page, snapshot: unknown): Promise<void> {
  await page.route("**/api/stream", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`,
    });
  });
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
