import type { FullConfig } from "@playwright/test";

/**
 * Hits each route once via plain HTTP before any browser test runs, so the
 * server has already handled a first request for every route (module init,
 * any first-hit caching) before a real browser navigation depends on it.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL as string | undefined;
  if (!baseURL) return;

  const routes = ["/", "/how-it-works", "/dashboard", "/dashboard/deposit", "/dashboard/investment/warmup"];

  for (const route of routes) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await fetch(`${baseURL}${route}`);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
}
