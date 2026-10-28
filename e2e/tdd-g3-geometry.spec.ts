import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * PAP-1073 G3: HTML is generated beforehand from actual TddTable/TddDrawer/TddDetail
 * by scripts/render-tdd-g3-fixtures.tsx (Node/tsx, no Playwright JSX transform).
 * This browser suite only measures DOM produced by the canonical renderer + authority CSS.
 * npm script: tdd:g3:fixtures then tdd:g3.
 */
const widths = [1440, 1024, 768, 390, 320] as const;
type Surface = "BO" | "HO";
type Stage = "table" | "drawer" | "detail";

function fixture(surface: Surface, stage: Stage): string {
  const path = resolve("node_modules/.cache/pap1073", `${surface}-${stage}.html`);
  try { return readFileSync(path, "utf8"); }
  catch { throw Error("G3 fixtures missing: run npm run tdd:g3:fixtures before Playwright"); }
}

type Geometry = {
  width: number; documentOverflow: number; shellWidth: number; shellLeft: number;
  rowHeight: number | null; drawerWidth: number | null; propertyColumns: number;
  minPropertyValueWidth: number | null; tablistWidth: number | null;
  tablistOverflow: number | null; heroWidth: number | null; visibleTabs: number;
  hiddenToolbar: boolean; mountedPanel: boolean;
};
async function measure(page: Page, stage: Stage): Promise<Geometry> {
  return page.evaluate((stage): Geometry => {
    const locate = (selector: string) => document.querySelector<HTMLElement>(selector);
    const dim = (selector: string) => locate(selector)?.getBoundingClientRect().width ?? null;
    const visible = (node: Element | null) => !!node && getComputedStyle(node).display !== "none" && node.getBoundingClientRect().height > 0;
    const props = [...document.querySelectorAll<HTMLElement>('[data-tdd-properties="drawer"] .property-control')].filter(visible);
    const tabs = locate('[role="tablist"]');
    const shell = locate('[data-tdd-shell="' + stage + '"]');
    const rect = shell?.getBoundingClientRect();
    return {
      width: innerWidth, documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      shellWidth: rect?.width ?? 0, shellLeft: rect?.left ?? 0,
      rowHeight: locate('#typed-table tbody tr')?.getBoundingClientRect().height ?? null,
      drawerWidth: dim('[data-tdd-shell="drawer"]'),
      propertyColumns: props.length,
      minPropertyValueWidth: props.length ? Math.min(...props.map(node => node.getBoundingClientRect().width)) : null,
      tablistWidth: tabs?.getBoundingClientRect().width ?? null,
      tablistOverflow: tabs ? Math.max(0, tabs.scrollWidth - tabs.clientWidth) : null,
      heroWidth: dim('.detail-hero'),
      visibleTabs: [...document.querySelectorAll('[role="tab"]')].filter(visible).length,
      hiddenToolbar: stage === "table" && !visible(locate('#search')),
      mountedPanel: stage === "detail" && !!locate('[role="tabpanel"]'),
    };
  }, stage);
}
function issues(metrics: Geometry, stage: Stage): string[] {
  const problems: string[] = [];
  if (metrics.shellWidth < 100 || metrics.shellWidth > metrics.width + 1) problems.push("shell width invalid");
  if (metrics.documentOverflow > 1) problems.push("document horizontal overflow");
  if (stage === "table") {
    if (metrics.hiddenToolbar) problems.push("table search/toolbar hidden");
    if (!metrics.rowHeight || metrics.rowHeight < 28 || metrics.rowHeight > 130) problems.push("table row geometry invalid");
  }
  if (stage === "drawer") {
    if (!metrics.drawerWidth || metrics.drawerWidth > metrics.width + 1) problems.push("drawer clipped by viewport");
    if (metrics.propertyColumns < 3) problems.push("drawer property controls missing");
    if ((metrics.minPropertyValueWidth ?? 0) < 105) problems.push("drawer property value too cramped (PAP-1029)");
  }
  if (stage === "detail") {
    if (!metrics.heroWidth || metrics.heroWidth > metrics.width + 1) problems.push("detail hero overflow");
    if (!metrics.mountedPanel || metrics.visibleTabs < 2) problems.push("tab or panel not visible");
    if ((metrics.tablistWidth ?? 0) > metrics.width + 1) problems.push("tablist overflows viewport");
  }
  return problems;
}
for (const surface of ["BO", "HO"] as const) {
  for (const width of widths) {
    test(`PAP-1073 ${surface} measured TDD geometry at ${width}px`, async ({ page }, info: TestInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const measured: Record<Stage, Geometry> = {} as Record<Stage, Geometry>;
      for (const stage of ["table", "drawer", "detail"] as const) {
        await page.setContent(fixture(surface, stage), { waitUntil: "load" });
        await expect(page.locator(`[data-tdd-shell="${stage}"]`)).toBeVisible();
        const value = await measure(page, stage);
        measured[stage] = value;
        await info.attach(`pap1073-${surface.toLowerCase()}-${width}-${stage}.png`, { body: await page.screenshot(), contentType: "image/png" });
        expect(issues(value, stage), JSON.stringify({ surface, width, stage, value }, null, 2)).toEqual([]);
      }
      await info.attach(`pap1073-${surface.toLowerCase()}-${width}-geometry.json`, {
        body: Buffer.from(JSON.stringify({ surface, width, stages: measured }, null, 2)), contentType: "application/json",
      });
    });
  }
}
test("PAP-1073 negative: actual cramped two-column Drawer DOM fails despite correct outer width", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.setContent(fixture("BO", "drawer"));
  const original = await measure(page, "drawer");
  expect(issues(original, "drawer")).toEqual([]);
  await page.addStyleTag({ content: '[data-tdd-properties="drawer"]{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important} [data-tdd-properties="drawer"] .property-row{grid-template-columns:110px 92px!important} [data-tdd-properties="drawer"] .property-control{width:92px!important;min-width:0!important}' });
  const broken = await measure(page, "drawer");
  expect(broken.drawerWidth).toBe(original.drawerWidth);
  expect(broken.minPropertyValueWidth).toBeLessThanOrEqual(93);
  expect(issues(broken, "drawer")).toContain("drawer property value too cramped (PAP-1029)");
});
test("PAP-1073 negative: actual detached Detail panel and clipped tabs are rejected", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.setContent(fixture("BO", "detail"));
  const healthy = await measure(page, "detail");
  expect(issues(healthy, "detail")).toEqual([]);
  await page.locator('[role="tabpanel"]').evaluate(node => node.remove());
  const detached = await measure(page, "detail");
  expect(issues(detached, "detail")).toContain("tab or panel not visible");
  await page.setContent(fixture("BO", "detail"));
  await page.addStyleTag({ content: '[role="tablist"]{width:520px!important;min-width:520px!important}' });
  const overflowing = await measure(page, "detail");
  expect(issues(overflowing, "detail")).toContain("tablist overflows viewport");
});
