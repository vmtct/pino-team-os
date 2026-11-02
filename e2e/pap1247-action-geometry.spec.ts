import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** PAP-1247: five-viewport actual shared Action Host geometry. No Staging or Prod credentials. */
const widths = [1440, 1024, 768, 390, 320] as const;
const expected = {
  table: { "table.header": ["Xuất", "Tạo mới"] },
  drawer: { "drawer.header": ["Sao chép", "Chỉnh sửa"] },
  detail: { "detail.header": ["Chỉnh sửa"], "overview.section": ["Tải lại"] },
  form: { "drawer.footer": ["Hủy", "Tạo"] },
  businessTab: { "detail.header": ["Chỉnh sửa"], "businessTab.toolbar": ["Xem thêm"] },
} as const;

for (const surface of ["BO", "HO"] as const) for (const width of widths) {
  test(`PAP-1247 ${surface} real declarative actions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const dest = resolve("artifacts/pap1247-actions", surface.toLowerCase(), String(width));
    mkdirSync(dest, { recursive: true });
    const all: Record<string, unknown> = {};
    for (const stage of Object.keys(expected) as (keyof typeof expected)[]) {
      const file = resolve("node_modules/.cache/pap1073", `${surface}-action-${stage}.html`);
      await page.setContent(readFileSync(file, "utf8"), { waitUntil: "load" });
      const expectedHosts = expected[stage] as Record<string, readonly string[]>;
      const actual = await page.locator("[data-tdd-action-slot]").evaluateAll((nodes) =>
        nodes.map(node => ({
          slot: node.getAttribute("data-tdd-action-slot"),
          labels: [...node.querySelectorAll("button")].map(button => button.textContent?.trim()),
          rect: (() => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width }; })(),
        })));
      expect(actual.map(item => item.slot).sort()).toEqual(Object.keys(expectedHosts).sort());
      for (const host of actual) {
        expect(host.labels).toEqual(expectedHosts[host.slot!]);
        expect(host.rect.left, `${stage} ${host.slot} left clipped at ${width}`).toBeGreaterThanOrEqual(-1);
        expect(host.rect.right, `${stage} ${host.slot} right clipped at ${width}`).toBeLessThanOrEqual(width + 1);
      }
      const documentOverflow = await page.evaluate(() => Math.max(
        document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
      expect(documentOverflow, `${surface} ${stage} document overflow ${width}`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: resolve(dest, `${stage}.png`) });
      all[stage] = { hosts: actual, documentOverflow };
    }
    writeFileSync(resolve(dest, "action-geometry.json"),
      JSON.stringify({ surface, width, stages: all }, null, 2) + "\n", "utf8");
  });
}
