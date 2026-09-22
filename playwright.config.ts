import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Some sandboxed environments pre-install a Chromium revision that doesn't
// match the @playwright/test version pinned here; when that stable symlink
// exists, point at it directly instead of the (possibly absent) auto-managed
// browser. Falls back to normal Playwright browser discovery everywhere else.
const sandboxChromium = "/opt/pw-browsers/chromium";
const executablePath = existsSync(sandboxChromium) ? sandboxChromium : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // A small safety margin for CI's own flakiness (network blips, resource
  // contention); the suite passes reliably with zero retries locally.
  retries: 2,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },
  ],
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      SESSION_SECRET: "e2e-test-session-secret-do-not-use-in-prod",
      DEPOSIT_WALLET_ADDRESS: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      ADMIN_WALLET_ADDRESSES: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
      SOL_TO_NGN_RATE_MINOR_UNITS: "150000000",
      NEXT_PUBLIC_SOLANA_NETWORK: "devnet",
      NEXT_PUBLIC_SOLANA_RPC_URL: "https://api.devnet.solana.com",
      NEXT_PUBLIC_SOLANA_EXPLORER: "https://explorer.solana.com",
    },
  },
});
