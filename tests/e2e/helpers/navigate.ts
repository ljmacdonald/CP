import type { Page } from "@playwright/test";

/**
 * Thin wrapper around `page.goto` that waits for the app to actually render
 * (the "YIELD" wordmark present in every page's header) before returning,
 * so callers don't need a manual settle delay after navigating.
 *
 * Note: `locator.isVisible({ timeout })` does NOT wait — that option is
 * deprecated and ignored (Playwright always returns immediately). An earlier
 * version of this helper used it to decide whether to retry, which meant it
 * almost always saw "not visible yet" a few milliseconds after navigating
 * and reloaded the page in a tight loop — interrupting the real load
 * in-flight and *causing* the intermittent failures it was meant to work
 * around. `locator.waitFor` is the version that genuinely polls.
 */
export async function gotoResilient(page: Page, url: string, timeout = 15_000): Promise<void> {
  await page.goto(url);
  await page.getByText("YIELD", { exact: true }).first().waitFor({ state: "visible", timeout });
}
