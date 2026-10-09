import { expect, test } from "@playwright/test";

test("explains an unreachable varatlas server instead of spinning", async ({ page }) => {
  await page.route("**/api/auth", (route) => route.abort("connectionrefused"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Can't reach varatlas" })).toBeVisible();
  await expect(page.getByLabel("Loading")).toBeHidden();
});

test("explains a token without the scope varatlas needs", async ({ page }) => {
  await page.route("**/api/auth", (route) =>
    route.fulfill({
      json: {
        configured: false,
        source: "cookie",
        baseUrl: "https://gitlab.com",
        problem: "scope",
        token: { name: "t", scopes: ["read_user"], expiresAt: null },
      },
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "This token can't read CI/CD variables" })).toBeVisible();
  await expect(page.getByText("read_user")).toBeVisible();
  await expect(page.getByRole("link", { name: /Create a token in GitLab/ })).toHaveAttribute(
    "href",
    "https://gitlab.com/-/user_settings/personal_access_tokens?name=varatlas&scopes=api",
  );
});
