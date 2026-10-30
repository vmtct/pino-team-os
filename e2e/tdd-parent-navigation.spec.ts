import { expect, test } from "@playwright/test";
import { buildSync } from "esbuild";

const bundle = buildSync({ outfile: "fixture.js", banner: { js: "var process = { env: { NODE_ENV: 'production' } };" }, entryPoints: ["e2e/fixtures/pap1184-navigation.tsx"], bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent" }).outputFiles[0].text;
test.use({ launchOptions: process.platform === "win32" ? { executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" } : {} });

for (const path of ["Escape", "Full Detail Back"] as const) {
  test(`PAP-1184 ${path} restores Parent row focus after asynchronous Table refresh`, async ({ page }) => {
    page.on("pageerror", error => console.log("fixture page error:", error.message));
    await page.route("**/*", route => route.fulfill({ contentType: "text/html", body: `<div id="root"></div><script>${bundle}</script>` }));
    await page.goto("https://bo.staging.pinohouse.art/bo?module=parents&pilot=tdd");
    const opener = page.getByRole("button", { name: "Quick View Parent fixture" });
    await opener.focus();
    await opener.press("Enter");
    const drawer = page.locator('[data-tdd-shell="drawer"]');
    await expect(drawer).toBeVisible();
    if (path === "Escape") await page.keyboard.press("Escape");
    else {
      await drawer.getByRole("button", { name: /Full Detail/ }).click();
      await page.getByRole("button", { name: "Quay lại bảng" }).click();
    }
    await expect(drawer).toHaveCount(0);
    await expect(opener).toBeVisible();
    await expect(opener).toBeFocused();
  });
}

test("PAP-1184 Table-only sort keeps focus on its own control", async ({ page }) => {
  await page.route("**/*", route => route.fulfill({ contentType: "text/html", body: `<div id="root"></div><script>${bundle}</script>` }));
  await page.goto("https://bo.staging.pinohouse.art/bo?module=parents&pilot=tdd");
  const opener = page.getByRole("button", { name: "Quick View Parent fixture" });
  await opener.focus();
  await opener.press("Enter");
  await expect(page.locator('[data-tdd-shell="drawer"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  const sort = page.locator('button[data-sort="name"]');
  await sort.click();
  await expect(opener).toBeVisible();
  await expect(sort).toBeFocused();
});
