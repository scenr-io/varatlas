import { expect, test, type Page } from "@playwright/test";

interface Snapshot {
  entities: {
    entity: string;
    id: number;
    variables: { key: string; environment_scope: string; masked: boolean }[];
  }[];
}

/** Every variable that isn't masked, from the page's own API (same origin, so the guards pass). */
async function unmasked(page: Page) {
  const snapshot = await page.evaluate(
    async () => (await fetch("/api/variables")).json() as Promise<unknown>,
  );
  return (snapshot as Snapshot).entities.flatMap((e) =>
    e.variables
      .filter((v) => !v.masked)
      .map((v) => ({ entity: e.entity, id: e.id, key: v.key, scope: v.environment_scope })),
  );
}

test("mask the secrets behind a finding that GitLab can mask", async ({ page }) => {
  await page.goto("/");
  const before = await unmasked(page);

  try {
    await page.getByRole("button", { name: "Mask all" }).click();
    const panel = page.getByRole("dialog", { name: "Mask secrets" });
    await expect(panel.getByRole("checkbox", { name: "Select all" })).toBeChecked();
    // The demo's signing key has spaces in its value, which GitLab refuses to mask.
    await expect(panel.getByText("1 of these can't be masked as it is.")).toBeVisible();
    await panel.getByRole("button", { name: "Mask 1 variable" }).click();
    await expect(page.getByText("Masked 1 variable")).toBeVisible();
    await expect(panel).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Secrets that aren't masked: 1 variable. Show them." }),
    ).toBeVisible();
  } finally {
    // The demo org is shared by every test: unmask what this test masked.
    const still = new Set((await unmasked(page)).map((v) => JSON.stringify(v)));
    const updates = before
      .filter((v) => !still.has(JSON.stringify(v)))
      .map((v) => ({ ...v, changes: { masked: false } }));
    if (updates.length > 0) {
      await page.evaluate(
        async (body) => {
          await fetch("/api/variables", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        },
        { updates },
      );
    }
  }
});

test("protecting warns first and applies only what is ticked", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Protect all" }).click();
  const panel = page.getByRole("dialog", { name: "Protect secrets" });
  await expect(panel.getByRole("note")).toContainText("unprotected branches and merge requests");

  await panel.getByRole("checkbox", { name: "Select all" }).uncheck();
  await expect(panel.getByRole("button", { name: "Protect 0 variables" })).toBeDisabled();
  await panel.getByRole("button", { name: "Cancel" }).click();
  await expect(panel).toBeHidden();
});
