import { expect, test, type Page } from "@playwright/test";
import { buildSync } from "esbuild";
import { readFileSync } from "node:fs";

const actionCss = readFileSync("node_modules/@pino/design-system/dist/0.3.0/components.css", "utf8");

const bundle = buildSync({
  entryPoints: ["e2e/fixtures/pap1247-action-interactions.tsx"],
  bundle: true, write: false, outfile: "fixture.js", platform: "browser", format: "iife", jsx: "automatic",
  banner: { js: "var process = { env: { NODE_ENV: 'production' } };" },
  define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
}).outputFiles[0].text;
test.use({ launchOptions: process.platform === "win32" ?
  { executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" } : {} });
async function scenario(page: Page, mode: string) {
  page.on("pageerror", error => { throw error; });
  await page.route("**/*", route => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html lang="vi"><head><style>${actionCss}</style></head><body><main id="root"></main><script>${bundle}</script></body></html>`,
  }));
  await page.goto(`https://ho.staging.pinohouse.art/pap1247-g2-synthetic?mode=${mode}`);
  await expect(page.getByRole("button", { name: "Xem", exact: true })).toBeVisible();
}
test("PAP-1247 DS host keeps 8px wrapping and native keyboard focus/disabled behavior", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 });
  await scenario(page, "verified");
  const host = page.locator('[data-tdd-action-slot="table.header"]');
  await expect(host).toHaveClass(/pds-bo-action-group/);
  await expect(host).toHaveCSS("gap", "8px");
  await expect(host).toHaveCSS("flex-wrap", "wrap");
  const buttons = host.getByRole("button");
  const read = buttons.first();
  const disabled = buttons.nth(1);
  const save = buttons.last();
  await expect(disabled).toBeDisabled();
  await page.keyboard.press("Tab");
  await expect(read).toBeFocused();
  await expect(read).toHaveCSS("outline-style", "solid");
  await expect(read).toHaveCSS("outline-width", "2px");
  await page.keyboard.press("Tab");
  await expect(save).toBeFocused();
  await expect(disabled).toHaveCSS("cursor", "not-allowed");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
for (const mode of ["verified", "conflict", "invalid", "denied-result", "unverified", "network"] as const) {
  test(`PAP-1247 actual host ${mode} is truthful; no blind replay`, async ({ page }) => {
    await scenario(page, mode);
    const save = page.getByRole("button", { name: "Lưu", exact: true });
    await save.focus();
    await expect(save).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-tdd-action-slot="table.header"]')).toHaveAttribute("aria-busy", "false");
    await expect.poll(() => page.evaluate(() => window.__actionCount)).toBe(1);
    if (mode === "verified") {
      await expect(page.getByRole("status")).toContainText("đã được xác minh");
      await expect(page.getByRole("alert")).toHaveCount(0);
    } else {
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(page.getByRole("status")).toHaveCount(0);
      if (mode === "conflict") await expect(page.getByRole("alert")).toContainText("thay đổi");
      if (mode === "denied-result") await expect(page.getByRole("alert")).toContainText("Không có quyền");
      if (mode === "network") await expect(page.locator("body")).not.toContainText("private upstream secret");
    }
    await expect(save).toBeEnabled();
  });
}
test("PAP-1247 G2 visible/disabled/denied fail closed", async ({ page }) => {
  await scenario(page, "denied");
  await expect(page.getByRole("button", { name: "Ẩn" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tạm khóa" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Lưu" })).toHaveCount(0);
  await expect(page.locator('[data-tdd-action-slot="table.header"] button')).toHaveCount(2);
});
test("PAP-1247 G2 synchronous double click is single flight and ARIA busy", async ({ page }) => {
  await scenario(page, "slow");
  const save = page.getByRole("button", { name: "Lưu", exact: true });
  await save.evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click(); });
  await expect(page.locator('[data-tdd-action-slot="table.header"]')).toHaveAttribute("aria-busy", "true");
  await expect(save).toBeDisabled();
  expect(await page.evaluate(() => window.__actionCount)).toBe(1);
  await page.evaluate(() => window.__releaseAction?.());
  await expect(page.getByRole("status")).toContainText("đã được xác minh");
  await expect(save).toBeEnabled();
  expect(await page.evaluate(() => window.__actionCount)).toBe(1);
});
test("PAP-1247 G2 navigation action never fabricates mutation success", async ({ page }) => {
  await scenario(page, "verified");
  const read = page.getByRole("button", { name: "Xem", exact: true });
  await read.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate(() => window.__actionCount)).toBe(0);
});
