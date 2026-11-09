import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const widths = [1440, 1024, 768, 390, 320] as const;
const settingButtons = [
  { id: "filter-toggle", label: "Bộ lọc", icon: "filter" },
  { id: "visible-columns", label: "Hiển thị thuộc tính", icon: "table-columns" },
  { id: "reset-all", label: "Đặt lại", icon: "rotate-left" },
  { id: "group-shortcut", label: "Nhóm", icon: "layer-group" },
] as const;
test.use({ launchOptions: process.platform === "win32"
  ? { executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" } : {} });

async function capture(page: Page, surface: "BO" | "HO") {
  const html = readFileSync(resolve("node_modules/.cache/pap1073", surface + "-table.html"), "utf8");
  await page.setContent(html, { waitUntil: "load" });
  return page.evaluate(() => {
    const ids = ["filter-toggle", "visible-columns", "reset-all", "group-shortcut"];
    return ids.map(id => {
      const button = document.getElementById(id) as HTMLButtonElement | null;
      const rect = button?.getBoundingClientRect();
      const icon = button?.querySelector("svg[data-prefix='fas']") as SVGElement | null;
      const svgRect = icon?.getBoundingClientRect();
      const css = button && getComputedStyle(button);
      return {
        id, label: button?.getAttribute("aria-label"), tooltip: button?.getAttribute("title"),
        icon: icon?.getAttribute("data-icon"), ariaHidden: icon?.getAttribute("aria-hidden"),
        visibleText: button?.textContent?.trim() ?? "",
        count: button?.querySelector(".filter-count")?.textContent,
        display: css?.display, padding: css?.padding,
        width: rect?.width, height: rect?.height,
        iconWidth: svgRect?.width, iconHeight: svgRect?.height,
        targetVisible: Boolean(rect && rect.width > 0 && rect.height > 0),
      };
    });
  });
}

for (const width of widths) {
  test("PAP-1476 BO/HO icon-only Table settings @ " + width + "px", async ({ browser }) => {
    const bo = await browser.newPage({ viewport: { width, height: 900 } });
    const ho = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      const a = await capture(bo, "BO");
      const b = await capture(ho, "HO");
      for (const actual of [a, b]) {
        expect(actual).toHaveLength(4);
        for (const [i, entry] of actual.entries()) {
          const expected = settingButtons[i];
          expect(entry.id).toBe(expected.id);
          expect(entry.label).toBe(expected.label);
          expect(entry.tooltip).toBe(expected.label);
          expect(entry.icon).toBe(expected.icon);
          expect(entry.ariaHidden).toBe("true");
          expect(entry.visibleText, expected.id + " must contain no visible text").toBe("");
          expect(entry.targetVisible).toBe(true);
          expect(["flex", "inline-flex"]).toContain(entry.display);
          expect(entry.width).toBeGreaterThanOrEqual(35);
          expect(entry.width).toBeLessThanOrEqual(37);
          expect(entry.height).toBeGreaterThanOrEqual(35);
          expect(entry.height).toBeLessThanOrEqual(37);
          expect(entry.iconWidth).toBeGreaterThanOrEqual(15);
          expect(entry.iconHeight).toBeGreaterThanOrEqual(15);
        }
      }
      expect(a.map(x => [x.id, x.width, x.height, x.iconWidth, x.iconHeight]))
        .toEqual(b.map(x => [x.id, x.width, x.height, x.iconWidth, x.iconHeight]));
      await expect(bo.locator("#filter-toggle")).toHaveAttribute("aria-expanded", "false");
      await expect(ho.locator("#filter-toggle")).toHaveAttribute("aria-expanded", "false");
      const overflow = async (page: Page) => page.evaluate(() =>
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
      expect(await overflow(bo)).toBeLessThanOrEqual(1);
      expect(await overflow(ho)).toBeLessThanOrEqual(1);
    } finally { await Promise.all([bo.close(), ho.close()]); }
  });
}
test("PAP-1476 icon geometry anti-drift negative control", async ({ browser }) => {
  const bo = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const ho = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await Promise.all([capture(bo, "BO"), capture(ho, "HO")]);
    await ho.addStyleTag({ content: ".toolbar .toolbar-button.tdd-setting-icon {width:48px!important;min-width:48px!important;max-width:48px!important;flex-basis:48px!important}" });
    const size = (page: Page) => page.locator("#visible-columns").evaluate(el => el.getBoundingClientRect().width);
    expect(Math.abs(await size(bo) - await size(ho))).toBeGreaterThanOrEqual(10);
  } finally { await Promise.all([bo.close(), ho.close()]); }
});
