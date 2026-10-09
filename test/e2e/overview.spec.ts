import { expect, test } from "@playwright/test";

test("the overview summarises the demo org and its findings", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "41 variables in 16 of 20 groups and projects",
  );
  await expect(page.getByText("Demo mode.")).toBeVisible();
  for (const title of [
    "Secrets that aren't masked",
    "Secrets available on every branch",
    "Same key, different values",
    "Places varatlas can't read",
    "Copies that could be shared",
    "Group variables overridden further down",
  ]) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }
});

test("a finding opens the variables behind it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Secrets that aren't masked/ }).click();
  await expect(page.getByText("Showing 2 of 41 variables")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear finding filter" })).toBeVisible();
});

test("selecting a project shows what it receives", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("treeitem", { name: /payments-api/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("payments-api receives 13 variables");
  await page.getByRole("navigation", { name: "Views" }).getByRole("button", { name: "Variables" }).click();
  await expect(
    page.getByText("Showing 13 of 13 variables, including what this project inherits"),
  ).toBeVisible();
  await expect(page.getByText("Inherited from").first()).toBeVisible();
});

test("a key's detail shows every copy", async ({ page }) => {
  await page.goto("/#variables");
  // The table only renders rows on screen, so find the key the way a user would.
  await page.getByLabel("Search variables").fill("DATABASE_URL");
  await page.getByRole("button", { name: "DATABASE_URL", exact: true }).first().click();
  const panel = page.getByRole("dialog", { name: "DATABASE_URL" });
  await expect(panel).toContainText("The copies hold different values.");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});
