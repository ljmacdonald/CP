import type { FullConfig } from "@playwright/test";

/**
 * `next start` (Turbopack) appears to still do some on-demand work for
 * less-frequently-hit routes on their very first request, which occasionally
 * lost the race against a fresh browser navigation in this sandboxed
 * environment and surfaced as Chromium's own network-error interstitial
 * instead of our app. Hitting each route once via plain HTTP before any
 * browser test runs avoids paying that cost during a real navigation.
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
