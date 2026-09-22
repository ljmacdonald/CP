import { test, expect } from "@playwright/test";
import { installFakeWallet } from "./helpers/fakeWallet";
import { mockJson, mockStreamHang, mockSolanaRpc } from "./helpers/mockApi";
import { gotoResilient } from "./helpers/navigate";
import { emptyDashboardSnapshot, PRODUCT } from "./helpers/fixtures";

const WALLET_ADDRESS = "11111111111111111111111111111111";
const DEPOSIT_WALLET = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

test("deposit: signing and submitting a transaction credits the portfolio", async ({ page }) => {
  await installFakeWallet(page, WALLET_ADDRESS);

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
  await mockStreamHang(page);
  await mockJson(page, "**/api/dashboard", emptyDashboardSnapshot());
  await mockJson(page, "**/api/products/active", { product: PRODUCT });

  await mockJson(page, "**/api/deposits/intent", {
    depositId: "deposit-1",
    destinationWallet: DEPOSIT_WALLET,
    expectedUsdcBaseUnits: "100000000000",
    requestedAmountMinorUnits: "10000000",
  });
  await mockJson(page, "**/api/deposits/submit", {
    deposit: { id: "deposit-1", status: "confirming" },
  });
  await mockJson(page, "**/api/deposits/verify", {
    deposit: { id: "deposit-1", status: "confirmed", actual_amount_minor_units: "10000000" },
    position: { id: "position-1", status: "active" },
    credited: true,
  });

  await mockSolanaRpc(page, {
    getLatestBlockhash: {
      context: { slot: 1 },
      value: { blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 1000 },
    },
    getSignatureStatuses: {
      context: { slot: 1 },
      value: [{ slot: 1, confirmations: null, err: null, confirmationStatus: "confirmed" }],
    },
  });

  await gotoResilient(page, "/");
  await page.getByRole("button", { name: /connect wallet/i }).first().click({ timeout: 15_000 });
  await page.getByRole("button", { name: /e2e fake wallet/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await gotoResilient(page, "/dashboard/deposit");
  await page.getByPlaceholder("0.00").fill("100000");
  await expect(page.getByText(/estimated earnings/i)).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText(/confirm deposit/i)).toBeVisible();
  await page.getByRole("button", { name: /confirm.*sign/i }).click();

  await expect(page.getByText(/deposit complete/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("$100,000.00")).toBeVisible();
});
