import { test, expect } from "@playwright/test";
import { loginAs, TEST_USER } from "./helpers/auth";
import { mockMe, mockJson } from "./helpers/mockApi";
import { gotoResilient } from "./helpers/navigate";
import { buildPosition, performanceSeries } from "./helpers/fixtures";

test("withdraw: requesting a quote and confirming redemption credits the cash balance", async ({
  page,
  context,
  baseURL,
}) => {
  await loginAs(context, TEST_USER, baseURL!);
  await mockMe(page, TEST_USER);

  const detail = { position: buildPosition(), performance: performanceSeries(), transactions: [] };
  await mockJson(page, "**/api/positions/position-1", detail);

  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  await mockJson(page, "**/api/redemption/quote", {
    quote: {
      id: "quote-1",
      investment_position_id: "position-1",
      current_value_minor_units: "11000000",
      liquidity_adjustment_minor_units: "550000",
      redemption_value_minor_units: "10450000",
      expires_at: expiresAt,
      consumed_at: null,
      created_at: new Date().toISOString(),
    },
  });
  await mockJson(page, "**/api/redemption/confirm", {
    position: { ...buildPosition().position, status: "redeemed" },
    cashBalance: "10450000",
  });
  await mockJson(page, "**/api/withdrawals", { withdrawal: { id: "withdrawal-1", status: "processing" } });

  await gotoResilient(page, "/dashboard/investment/position-1");

  await page.getByRole("button", { name: "Withdraw" }).click({ timeout: 15_000 });

  await expect(page.getByText("₦110,000.00")).toBeVisible();
  await expect(page.getByText("- ₦5,500.00")).toBeVisible();
  await expect(page.getByText("₦104,500.00")).toBeVisible();
  await expect(page.getByText(/quote valid for/i)).toBeVisible();

  await page.getByRole("button", { name: /confirm redemption/i }).click();

  await expect(page.getByText(/redemption complete/i)).toBeVisible();

  await page.getByRole("button", { name: /withdraw to my wallet/i }).click();
  await expect(page.getByText(/withdrawal requested to your connected wallet/i)).toBeVisible();
});
