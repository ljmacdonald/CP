import { test, expect } from "@playwright/test";
import { loginAs, TEST_USER } from "./helpers/auth";
import { mockMe, mockJson } from "./helpers/mockApi";
import { gotoResilient } from "./helpers/navigate";
import { buildPosition, performanceSeries } from "./helpers/fixtures";

test("view investment: shows current value, earned, and maturity details for a position", async ({
  page,
  context,
  baseURL,
}) => {
  await loginAs(context, TEST_USER, baseURL!);
  await mockMe(page, TEST_USER);

  const detail = { position: buildPosition(), performance: performanceSeries(), transactions: [] };
  await mockJson(page, "**/api/positions/position-1", detail);

  await gotoResilient(page, "/dashboard/investment/position-1");

  await expect(page.getByRole("heading", { name: "Growth Portfolio" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("$110,000.00")).toBeVisible(); // current value
  await expect(page.getByText("$100,000.00")).toBeVisible(); // original investment
  await expect(page.getByText("$10,000.00")).toBeVisible(); // earned
  await expect(page.getByText("25.0%")).toBeVisible();
  await expect(page.getByText("120", { exact: true })).toBeVisible(); // days remaining
});
