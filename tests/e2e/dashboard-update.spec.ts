import { test, expect } from "@playwright/test";
import { loginAs, TEST_USER } from "./helpers/auth";
import { mockMe, mockJson } from "./helpers/mockApi";
import { gotoResilient } from "./helpers/navigate";
import { activeDashboardSnapshot, emptyDashboardSnapshot } from "./helpers/fixtures";

test("dashboard update: a confirmed deposit updates the portfolio value live via SSE", async ({
  page,
  context,
  baseURL,
}) => {
  await loginAs(context, TEST_USER, baseURL!);
  await mockMe(page, TEST_USER);
  await mockJson(page, "**/api/dashboard", emptyDashboardSnapshot());

  const updatedSnapshot = {
    ...activeDashboardSnapshot(),
    latestDeposit: {
      id: "deposit-1",
      user_id: TEST_USER.userId,
      wallet_address: TEST_USER.walletAddress,
      requested_amount_minor_units: "10000000",
      actual_amount_minor_units: "10000000",
      asset: "USDC",
      transaction_signature: "4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi",
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  };

  await page.route("**/api/stream", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: `event: snapshot\ndata: ${JSON.stringify(updatedSnapshot)}\n\n`,
    });
  });
  await page.route("**/api/positions/*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ performance: [] }) });
  });

  await gotoResilient(page, "/dashboard");

  await expect(page.getByText("$0.00").first()).toBeVisible({ timeout: 15_000 });

  // The SSE snapshot should replace the zeroed values without a page reload.
  await expect(page.getByText("$110,000.00").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/deposit confirmed/i)).toBeVisible();
});
