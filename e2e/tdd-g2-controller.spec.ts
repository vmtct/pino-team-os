import { expect, test, type Page } from "@playwright/test";
import { buildSync } from "esbuild";

const bundle = buildSync({ outfile: "fixture.js", entryPoints: ["e2e/fixtures/tdd-g2-controller.tsx"], bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", banner: { js: "var process = { env: { NODE_ENV: 'production' } };" }, define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent" }).outputFiles[0].text;
test.use({ launchOptions: process.platform === "win32" ? { executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" } : {} });
const opener = (page: Page, number = "01") => page.getByRole("button", { name: `Quick View Fixture ${number}`, exact: true });
async function fixture(page: Page, surface: "BO" | "HO", scenario = "ready") {
  page.on("pageerror", error => { throw error; });
  await page.route("**/*", route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="vi"><body><div id="root"></div><script>${bundle}</script></body></html>` }));
  await page.goto(surface === "BO" ? `https://bo.staging.pinohouse.art/bo?module=parents&scenario=${scenario}` : `https://ho.staging.pinohouse.art/ho/centers?scenario=${scenario}`);
}
async function open(page: Page) { await opener(page).focus(); await opener(page).press("Enter"); await expect(page.locator('[data-tdd-shell="drawer"]')).toBeVisible(); }
async function detail(page: Page) { await open(page); await page.getByRole("button", { name: /Full Detail/ }).click(); await expect(page.getByRole("tab", { name: "Tổng quan" })).toBeVisible(); }
async function tabIssues(page: Page) {
  return page.evaluate(() => {
    const selected = [...document.querySelectorAll('[role="tab"][aria-selected="true"]')];
    if (selected.length !== 1) return ["selection"];
    const tab = selected[0], panel = document.getElementById(tab.getAttribute("aria-controls") ?? "");
    if (!panel || panel.getAttribute("role") !== "tabpanel") return ["panel"];
    return panel.getAttribute("aria-labelledby") === tab.id ? [] : ["label"];
  });
}
for (const surface of ["BO", "HO"] as const) {
  for (const path of ["Escape", "Back", "Reload then Back"] as const) test(`${surface} actual controller ${path} restores the row`, async ({ page }) => {
    await fixture(page, surface); await open(page);
    if (path === "Escape") await page.keyboard.press("Escape");
    else { await page.getByRole("button", { name: /Full Detail/ }).click(); if (path === "Reload then Back") await page.reload(); await page.getByRole("button", { name: "Quay lại bảng" }).click(); }
    await expect(opener(page)).toBeFocused();
    expect(new URL(page.url()).searchParams.has("record")).toBe(false);
  });
  test(`${surface} Drawer traps Tab and keeps properties read-only`, async ({ page }) => {
    await fixture(page, surface); await open(page);
    const full = page.getByRole("button", { name: /Full Detail/ }); await expect(full).toBeEnabled(); await full.focus();
    await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "Đóng", exact: true })).toBeFocused();
    await page.keyboard.press("Shift+Tab"); await expect(full).toBeFocused();
    await expect(page.getByRole("button", { name: "Chỉ đọc Tên", exact: true })).toBeDisabled();
    await expect(page.locator("body")).not.toContainText("PRIVATE_MUST_NOT_RENDER");
  });
  test(`${surface} tab keys, ARIA, history and browser navigation`, async ({ page }) => {
    await fixture(page, surface); await detail(page);
    await page.getByRole("tab", { name: "Tổng quan" }).focus(); await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Quan hệ" })).toBeFocused(); expect(await tabIssues(page)).toEqual([]);
    await page.keyboard.press("End"); await expect(page.getByRole("tab", { name: "Lịch sử" })).toBeFocused();
    await expect(page.getByRole("tabpanel")).toContainText("Chưa có lịch sử khả dụng"); expect(await tabIssues(page)).toEqual([]);
    await page.reload(); await expect(page.getByRole("tab", { name: "Lịch sử" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "Quay lại bảng" }).click(); await expect(opener(page)).toBeFocused();
    await page.goBack(); await expect(page.getByRole("tab", { name: "Lịch sử" })).toHaveAttribute("aria-selected", "true");
    await page.goForward(); await expect(opener(page)).toBeVisible();
  });
  for (const scenario of ["denied", "cross-surface"] as const) test(`${surface} ${scenario} never renders record data`, async ({ page }) => {
    await fixture(page, surface, scenario); await expect(page.getByRole("status").first()).toContainText("Không có quyền");
    await expect(page.getByRole("button", { name: /Quick View Fixture/ })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("PRIVATE_MUST_NOT_RENDER");
    await expect(page.locator("body")).not.toContainText("Fixture 01");
  });
  test(`${surface} denied business/history capabilities stay truthful`, async ({ page }) => {
    await fixture(page, surface, "business-denied"); await detail(page); await expect(page.getByRole("tab", { name: "Quan hệ" })).toHaveCount(0);
    await fixture(page, surface, "history-denied"); await detail(page); await page.getByRole("tab", { name: "Lịch sử" }).click();
    await expect(page.getByRole("tabpanel")).toContainText("Không có quyền");
  });
  for (const scenario of ["list-error", "detail-error"] as const) test(`${surface} ${scenario} retry resolves actual data`, async ({ page }) => {
    await fixture(page, surface, scenario); if (scenario === "detail-error") await open(page);
    await expect(page.getByRole("alert").first()).toBeVisible(); await page.getByRole("button", { name: "Thử lại", exact: true }).click();
    if (scenario === "list-error") await expect(opener(page)).toBeVisible(); else await expect(page.getByRole("button", { name: /Full Detail/ })).toBeEnabled();
  });
  test(`${surface} late previous-record detail cannot replace selected record`, async ({ page }) => {
    await fixture(page, surface, "stale"); await open(page); await page.getByRole("button", { name: "Đóng", exact: true }).click();
    await opener(page, "02").click(); await expect(page.locator("#drawer-title")).toHaveText("Fixture 02");
    await page.evaluate(() => window.__g2ReleaseOld?.());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.locator("#drawer-title")).toHaveText("Fixture 02");
  });
  test(`${surface} Table search, sort and pagination preserve typed state`, async ({ page }) => {
    await fixture(page, surface); await expect(opener(page)).toBeVisible();
    await page.locator("#search").fill("Fixture 03"); await expect(page.getByRole("button", { name: /^Quick View Fixture/ })).toHaveCount(1); await expect(opener(page, "03")).toBeVisible();
    await page.locator("#search").fill(""); await page.locator('button[data-sort="count"]').click(); await page.locator('button[data-sort="count"]').click();
    await expect(page.getByRole("button", { name: /^Quick View Fixture/ }).first()).toHaveAttribute("aria-label", "Quick View Fixture 32");
    await page.getByRole("button", { name: "Trang sau", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Quick View Fixture/ }).first()).toHaveAttribute("aria-label", "Quick View Fixture 24");
  });
  test(`${surface} module ARIA contract detects a detached or mislabelled panel`, async ({ page }) => {
    await fixture(page, surface); await detail(page); expect(await tabIssues(page)).toEqual([]);
    await page.getByRole("tabpanel").evaluate(panel => panel.removeAttribute("aria-labelledby")); expect(await tabIssues(page)).toEqual(["label"]);
    await page.getByRole("tabpanel").evaluate(panel => panel.remove()); expect(await tabIssues(page)).toEqual(["panel"]);
  });
}
