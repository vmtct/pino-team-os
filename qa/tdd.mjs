import { expect } from "@playwright/test";

// The caller supplies a known synthetic record and expected visible values.
// Never find a different record if the requested fixture is absent or ambiguous.
export async function checkTdd(page, fixture) {
  const row = page.getByRole("row").filter({
    has: page.getByText(fixture.row, { exact: true })
  });
  await expect(row).toHaveCount(1);
  const identity = row.locator('button[data-edit="name"]');
  const opener = await identity.count() ? identity : row.getByRole("button", { name: /quick view/i }).first();
  await opener.click();
  const drawer = page.locator('[data-tdd-shell="drawer"]');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(fixture.drawer, { exact: true }).first()).toBeVisible();
  await checkFields(drawer, fixture.drawerFields);
  await drawer.getByRole("button", { name: /full detail/i }).click();
  const detail = page.locator('[data-tdd-shell="detail"]');
  await expect(detail).toBeVisible();
  await expect(detail.getByText(fixture.detail, { exact: true }).first()).toBeVisible();
  await checkFields(detail, fixture.detailFields);
  await expect(detail.getByRole("tabpanel")).toBeVisible();
}

async function checkFields(shell, fields = {}) {
  for (const [key, expected] of Object.entries(fields)) {
    if (!/^[a-zA-Z0-9_-]+$/.test(key) || typeof expected !== "string" || !expected.trim()) throw Error("Invalid expected field");
    const field = shell.locator('[data-tdd-field="' + key + '"]');
    await expect(field).toHaveCount(1);
    await expect(field.getByText(expected, { exact: true })).toBeVisible();
  }
}
