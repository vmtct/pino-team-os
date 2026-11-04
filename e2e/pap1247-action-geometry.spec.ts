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
      // PAP-1455: labels and geometry alone did not catch browser-native
      // buttons. Validate actual BO/HO DS variants and computed CSS.
      const visuals = await page.locator("[data-tdd-action-slot] button").evaluateAll(nodes =>
        nodes.map(node => {
          const element = node as HTMLButtonElement;
          const style = getComputedStyle(element);
          return {
            label: element.textContent?.trim() ?? "",
            primary: element.classList.contains("primary-btn"),
            secondary: element.classList.contains("secondary-btn"),
            background: style.backgroundColor,
            radius: Number.parseFloat(style.borderRadius),
            padding: Number.parseFloat(style.paddingLeft),
            fontSize: Number.parseFloat(style.fontSize),
            height: element.getBoundingClientRect().height,
          };
        }));
      expect(visuals.length).toBeGreaterThan(0);
      for (const visual of visuals) {
        expect(visual.primary !== visual.secondary, surface + " " + stage + " incorrect DS variant").toBe(true);
        expect(visual.background, surface + " " + stage + " transparent background").not.toBe("rgba(0, 0, 0, 0)");
        expect(visual.radius, surface + " " + stage + " missing border radius").toBeGreaterThanOrEqual(6);
        expect(visual.padding, surface + " " + stage + " missing padding").toBeGreaterThanOrEqual(8);
        expect(visual.fontSize, surface + " " + stage + " missing typography").toBeGreaterThanOrEqual(10);
        expect(visual.height, surface + " " + stage + " insufficient hit target").toBeGreaterThanOrEqual(32);
      }
      const primary = visuals.find(button => button.primary);
      const secondary = visuals.find(button => button.secondary);
      if (primary && secondary) expect(primary.background).not.toBe(secondary.background);
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


// Negative control: a CSS-less SSR page must visibly diverge from the
// authoritative DS control, ensuring the G3 harness cannot silently regress.
test("PAP-1455 CSS omission is detected by computed-style regression", async ({ page }) => {
  const html = readFileSync(resolve("node_modules/.cache/pap1073", "BO-action-detail.html"), "utf8");
  const button = page.getByRole("button", { name: "Chỉnh sửa", exact: true });
  await page.setContent(html, { waitUntil: "load" });
  const styled = await button.evaluate(node => {
    const css = getComputedStyle(node);
    return { radius: Number.parseFloat(css.borderRadius), padding: Number.parseFloat(css.paddingLeft) };
  });
  expect(styled.radius).toBeGreaterThanOrEqual(6);
  expect(styled.padding).toBeGreaterThanOrEqual(8);
  await page.setContent(html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, ""), { waitUntil: "load" });
  const unstyled = await button.evaluate(node => {
    const css = getComputedStyle(node);
    return { radius: Number.parseFloat(css.borderRadius), padding: Number.parseFloat(css.paddingLeft) };
  });
  expect(unstyled.radius).toBeLessThan(styled.radius);
  expect(unstyled.padding).toBeLessThan(styled.padding);
});

for (const surface of ["BO", "HO"] as const) {
  test("PAP-1455 keyboard focus and disabled state in " + surface, async ({ page }) => {
    const html = readFileSync(resolve("node_modules/.cache/pap1073", surface + "-action-detail.html"), "utf8");
    await page.setContent(html, { waitUntil: "load" });
    const edit = page.getByRole("button", { name: "Chỉnh sửa", exact: true });
    await page.keyboard.press("Tab");
    await edit.focus();
    await expect(edit).toBeFocused();
    const focused = await edit.evaluate(node => {
      const css = getComputedStyle(node);
      return { width: Number.parseFloat(css.outlineWidth), style: css.outlineStyle };
    });
    expect(focused.style, surface + " focus outline lost").not.toBe("none");
    expect(focused.width, surface + " focus ring width lost").toBeGreaterThanOrEqual(1);
    await edit.evaluate(node => { (node as HTMLButtonElement).disabled = true; });
    await expect(edit).toBeDisabled();
    await expect(edit).not.toBeFocused();
  });
}
