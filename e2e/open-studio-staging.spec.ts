import { test, expect } from "@playwright/test";

const STAGING_ORIGIN = "https://pino-team-os-staging.minhtri-van42.workers.dev";

test.use({ baseURL: STAGING_ORIGIN });

test.describe("Open Studio BO staging acceptance", () => {
  test.describe.configure({ mode: "serial" });

  test("loads the canonical Open Studio control plane", async ({ page }) => {
    await page.goto("/bo/open-studio");
    await expect(page.getByRole("heading", { name: "Open Studio Operations" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Policy Control" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tạo Listing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Listings" })).toBeVisible();
  });

  test("creates and publishes a no-op cancellation policy version through BO", async ({ page }) => {
    await page.goto("/bo/open-studio");
    const card = page.locator("article").filter({ hasText: "Cancellation" }).first();
    await expect(card).toBeVisible();

    const createDraft = card.getByRole("button", { name: "Create Draft" });
    await expect(createDraft).toBeEnabled();
    const cutoff = card.getByLabel("Release cutoff (phút)");
    const currentCutoff = await cutoff.inputValue();
    await cutoff.fill(currentCutoff);
    const reason = `Open Studio staging browser E2E ${Date.now()}`;
    await card.getByLabel("Change reason").fill(reason);
    await expect(card.getByLabel("Change reason")).toHaveValue(reason);
    await createDraft.click();

    await expect(card.getByText("Draft canonical đã được tạo. Review rồi Publish.")).toBeVisible();
    const publish = card.getByRole("button", { name: "Publish Draft" });
    await expect(publish).toBeVisible();
    await publish.click();
    await expect(card.getByText(/^Published từ /)).toBeVisible();

    await page.reload();
    const reloaded = page.locator("article").filter({ hasText: "Cancellation" }).first();
    await expect(reloaded.locator("span").filter({ hasText: /^LIVE v\d+$/ })).toBeVisible();
    await expect(reloaded.getByLabel("Release cutoff (phút)")).toHaveValue(currentCutoff);
  });
});
