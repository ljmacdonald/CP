import { test, expect } from "@playwright/test";

test.describe("landing page", () => {
  test("shows the hero, headline stats, and prototype disclaimer", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /put your money to work/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /connect wallet/i }).first()).toBeVisible();
    await expect(page.getByText("25%", { exact: true })).toBeVisible();
    await expect(page.getByText(/target annualized return/i).first()).toBeVisible();
    await expect(page.getByText(/prototype\. investment figures shown are simulated/i)).toBeVisible();
  });

  test("navigates to the how it works page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /how it works/i }).first().click();
    await expect(page).toHaveURL(/\/how-it-works$/);
    await expect(page.getByRole("heading", { name: /how yield works/i })).toBeVisible();
  });

  test("redirects unauthenticated visitors away from the dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/$/);
  });

  test("redirects unauthenticated visitors away from the admin area", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/$/);
  });
});
