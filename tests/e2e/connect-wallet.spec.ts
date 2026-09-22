import { test, expect } from "@playwright/test";
import { installFakeWallet } from "./helpers/fakeWallet";
import { mockStream, mockJson } from "./helpers/mockApi";
import { gotoResilient } from "./helpers/navigate";
import { emptyDashboardSnapshot } from "./helpers/fixtures";

const WALLET_ADDRESS = "11111111111111111111111111111111";

test("connect wallet: selecting a wallet signs the user in and lands on the dashboard", async ({ page }) => {
  await installFakeWallet(page, WALLET_ADDRESS);

  // Unauthenticated until /api/auth/verify succeeds, matching the real flow.
  let authenticated = false;
  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        authenticated
          ? { authenticated: true, userId: "user-1", walletAddress: WALLET_ADDRESS, isAdmin: false }
          : { authenticated: false }
      ),
    });
  });

  await mockJson(page, "**/api/auth/challenge", {
    message: "YIELD wants you to sign in with your Solana wallet.",
    challengeToken: "fake-challenge-token",
  });
  await page.route("**/api/auth/verify", async (route) => {
    authenticated = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ userId: "user-1", walletAddress: WALLET_ADDRESS }),
    });
  });
  await mockStream(page, emptyDashboardSnapshot());
  await mockJson(page, "**/api/dashboard", emptyDashboardSnapshot());

  await gotoResilient(page, "/");
  await page.getByRole("button", { name: /connect wallet/i }).first().click({ timeout: 15_000 });
  await page.getByRole("button", { name: /e2e fake wallet/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("1111...1111").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});
