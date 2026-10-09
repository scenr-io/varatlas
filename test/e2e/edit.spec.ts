import { expect, test } from "@playwright/test";

test("add, edit and delete a variable", async ({ page }) => {
  await page.goto("/#variables");

  // Add, on the top group.
  await page.getByRole("banner").getByRole("button", { name: "Add variable" }).click();
  const form = page.getByRole("dialog", { name: "Add a variable" });
  await form.getByLabel("Key", { exact: true }).fill("E2E_CHECK");
  await form.getByLabel("Value", { exact: true }).fill("first-value");
  await form.getByRole("button", { name: "Add variable" }).click();
  await expect(page.getByText("Added E2E_CHECK to northwind")).toBeVisible();

  // Edit it.
  await page.getByLabel("Search variables").fill("E2E_CHECK");
  await expect(page.getByText("Showing 1 of")).toBeVisible();
  await page.getByRole("row").filter({ hasText: "E2E_CHECK" }).hover();
  await page.getByRole("button", { name: "Edit E2E_CHECK in northwind" }).click();
  const edit = page.getByRole("dialog", { name: "Edit E2E_CHECK" });
  await edit.getByLabel("Value", { exact: true }).fill("second-value");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved E2E_CHECK in northwind")).toBeVisible();

  // Delete it.
  await page.getByRole("row").filter({ hasText: "E2E_CHECK" }).hover();
  await page.getByRole("button", { name: "Delete E2E_CHECK from northwind" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete variable" }).click();
  await expect(page.getByText("Deleted E2E_CHECK from northwind")).toBeVisible();
  await expect(page.getByText("No variables match these filters")).toBeVisible();
});
