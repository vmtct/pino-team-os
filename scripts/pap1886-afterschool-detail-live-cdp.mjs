/** PAP-1886 / PAP-1912 — read-only BO Detail portion of Staging QA. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const manifest = JSON.parse(readFileSync(new URL("../config/pap1912-detail-parity.json", import.meta.url), "utf8"));
const contract = manifest.consumers.find(({ jira }) => jira === "PAP-1886");
const scope = contract.g4;
const parentLabel = process.env.PAP1886_QA_PARENT_LABEL ?? "";
assert(!process.env.CI && process.env.PAP1912_DETAIL_G4 === "1", "Explicit local QA opt-in required");
assert(/^[a-f0-9]{40}$/i.test(process.env.PAP1912_SERVED_SHA ?? "") &&
  process.env.PAP1912_DEPLOYMENT_ID, "Independent served SHA and deployment evidence required");
assert(/^(?:QA|TEST)[ _-]/i.test(parentLabel), "Use the name of an existing labeled disposable account");

const browser = await chromium.connectOverCDP("http://127.0.0.1:" + scope.authPort, {
  timeout: 20000, isLocal: true,
});
try {
  const page = await browser.contexts()[0].newPage();
  try {
    const origin = "https://bo.staging.pinohouse.art";
    const writes = [];
    const errors = [];
    await page.route(origin + "/**", async (route) => {
      const request = route.request();
      if (["GET", "HEAD", "OPTIONS"].includes(request.method())) await route.continue();
      else {
        writes.push(request.method());
        await route.abort();
      }
    });
    page.on("pageerror", () => errors.push("pageerror"));
    await page.goto(origin + scope.route, { waitUntil: "domcontentloaded" });
    const row = page.locator(scope.tableSelector).filter({
      has: page.getByText(parentLabel, { exact: true }),
    });
    await row.waitFor({ state: "visible" });
    const create = page.locator(".page-heading .heading-actions").getByRole("button", {
      name: "Tạo tài khoản", exact: true,
    });
    assert(await create.isVisible() && await create.isEnabled());
    await row.click();
    await page.getByRole("button", { name: /Full Detail/i }).click();
    const detail = page.locator(scope.detailSelector);
    await detail.getByRole("heading", { name: parentLabel, exact: true }).waitFor();
    const tab = detail.getByRole("tab", { name: contract.tabs[0][1], exact: true });
    const panel = detail.getByRole("tabpanel");
    const widths = [320, 390, 768, 1024, 1440, 1920];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      assert(await tab.isVisible() && await panel.isVisible(), "Hidden Detail tab or panel at " + width);
      assert.equal(await tab.getAttribute("aria-selected"), "true");
      assert.equal(await tab.getAttribute("aria-controls"), await panel.getAttribute("id"));
      assert.equal(await panel.getAttribute("aria-labelledby"), await tab.getAttribute("id"));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Overflow at " + width);
    }
    await detail.getByRole("button", { name: "Quay lại bảng", exact: true }).click();
    await row.waitFor({ state: "visible" });
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ check: "PAP-1886 read-only Detail", widths, status: "PASS" }));
  } finally {
    await page.close();
  }
} finally {
  await browser.close();
}
