import { expect, test, type Page } from "@playwright/test";
import { buildSync } from "esbuild";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
const bundle = buildSync({ outfile: "freeze.js", entryPoints: ["e2e/fixtures/pap1105-freeze.tsx"], bundle: true, write: false, format: "iife", platform: "browser", banner: { js: "var process = { env: { NODE_ENV: 'production' } };" }, jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent" }).outputFiles[0].text;
test.use({ launchOptions: process.platform === "win32" ? { executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" } : {} });
async function fixture(page: Page, surface: "BO" | "HO") {
  page.on("pageerror", error => { throw error; });
  const css = readFileSync("public/" + surface.toLowerCase() + "-authority-source/" + surface.toLowerCase() + "-scoped.css", "utf8");
  const host = surface === "BO" ? 'data-bo-ui-authority="v25"' : 'data-surface="ho"';
  await page.route("**/*", route => route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="vi" ' + host + '><head><style>' + css + '</style></head><body><div id="root"></div><script>' + bundle + '</script></body></html>' }));
  await page.goto(surface === "BO" ? "https://bo.staging.pinohouse.art/bo?module=parents" : "https://ho.staging.pinohouse.art/ho/centers");
  await expect(page.locator("tbody tr[data-open]").first()).toBeVisible();
}
async function queryState(page: Page) {
  return page.evaluate(() => {
    const owned = Object.entries(history.state ?? {}).find(([key]) => key.startsWith("pino:tdd:"))?.[1] as { query?: { frozenThrough?: string | null; order?: string[] } } | undefined;
    return owned?.query;
  });
}
async function requested(page: Page) { return (await queryState(page))?.frozenThrough; }
const trigger = (page: Page, name = "Ghi chú") => page.locator('th[data-column="' + ({ "Ghi chú": "note", "Trạng thái": "status" } as Record<string, string>)[name] + '"]');
async function freeze(page: Page, name = "Ghi chú") {
  // A clipped horizontal header on mobile cannot receive pointer events behind the frozen prefix.
  // The keyboard menu path must remain equivalent to desktop right-click.
  if ((await page.evaluate(() => innerWidth)) <= 390) {
    await trigger(page, name).focus();
    await page.keyboard.press("Shift+F10");
  } else {
    await trigger(page, name).click({ button: "right" });
  }
  await page.getByRole("menuitem", { name: "Cố định đến cột này", exact: true }).click();
}
for (const surface of ["BO", "HO"] as const) {
  test(surface + " PAP-1437 row keyboard activation and full column context without visible arrow", async ({ page }) => {
    await fixture(page, surface);
    await expect(page.locator("button.row-open,th.quick-open-th,td.first-quick-cell")).toHaveCount(0);
    const row = page.locator("tbody tr[data-open]").first();
    await row.focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await row.focus(); await page.keyboard.press("Space");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.locator('th[data-column="name"]').click({button:"right"});
    await expect(page.getByRole("menu", { name:/Tùy chọn cột/ })).toBeVisible();
    await expect(page.getByRole("menuitem", { name:"Ẩn cột" })).toBeDisabled();
    await expect(page.getByRole("menuitem", { name:"Sắp xếp tăng dần" })).toBeEnabled();
    await page.keyboard.press("Escape");
    await page.locator('th[data-column="status"]').focus();
    await page.keyboard.press("Shift+F10");
    await expect(page.getByRole("menu", { name:/Tùy chọn cột/ })).toBeVisible();
  });
  test(surface + " PAP-1437 disabled sort still focuses first enabled column menu action", async ({ page }) => {
    await fixture(page, surface);
    await trigger(page, "Trạng thái").focus();
    await page.keyboard.press("Shift+F10");
    const menu = page.getByRole("menu", { name: /Tùy chọn cột/ });
    await expect(menu).toBeVisible();
    const firstEnabled = menu.locator('[role="menuitem"]:not(:disabled):not([aria-disabled="true"])').first();
    await expect(firstEnabled).toBeFocused();
    await page.keyboard.press("ArrowDown");
    const enabled = menu.locator('[role="menuitem"]:not(:disabled):not([aria-disabled="true"])');
    await expect(enabled.nth(1)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger(page, "Trạng thái")).toBeFocused();
  });
  test(surface + " PAP-1474 typed identity remains sticky while legacy second column scrolls", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await fixture(page, surface);
    const viewport = page.locator("#table-scroll");
    const id = page.locator('thead th[data-tdd-identity-column]');
    const second = page.locator('thead th[data-tdd-legacy-sticky-release]');
    await expect(id).toHaveCSS("position", "sticky");
    await expect(second).toHaveCSS("position", "static");
    const beforeId = (await id.boundingBox())!.x, beforeSecond = (await second.boundingBox())!.x;
    await viewport.evaluate(el => { el.scrollLeft = 120; el.dispatchEvent(new Event("scroll")); });
    await expect.poll(() => viewport.evaluate(el => el.scrollLeft)).toBeGreaterThan(50);
    const afterId = (await id.boundingBox())!.x, afterSecond = (await second.boundingBox())!.x;
    expect(Math.abs(afterId - beforeId)).toBeLessThan(2);
    expect(afterSecond).toBeLessThan(beforeSecond - 50);
    const cell = page.locator('tbody tr:first-child button[data-edit="status"]');
    const displayedValue = (await cell.innerText()).trim();
    expect(displayedValue.length).toBeGreaterThan(0);
    expect(await cell.getAttribute("aria-label")).toContain(displayedValue);
  });
  test(surface + " Freeze Escape restores trigger focus", async ({ page }) => {
    await fixture(page, surface);
    await trigger(page).focus(); await page.keyboard.press("Shift+F10");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
  });
  test(surface + " Freeze menu arrows, Tab trap and pointer unfreeze keep contiguous prefix", async ({ page }) => {
    await fixture(page, surface); await freeze(page);
    await page.locator('th[data-column="status"]').click({ button: "right" });
    const pin = page.getByRole("menuitem", { name: "Cố định đến cột này", exact: true });
    const unpin = page.getByRole("menuitem", { name: "Bỏ cố định từ cột này", exact: true });
    await pin.focus(); await page.keyboard.press("ArrowDown"); await expect(unpin).toBeFocused();
    await page.keyboard.press("Tab"); await expect(page.getByRole("menuitem", { name: "Ẩn cột", exact: true })).toBeFocused(); // Disabled sort is skipped.
    await page.keyboard.press("End"); await expect(unpin).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#table-scroll")).toHaveAttribute("data-tdd-freeze-limit", "count");
    await expect(trigger(page, "Trạng thái")).toBeFocused();
    await expect(page.locator("button.row-open")).toHaveCount(0);
    await page.locator('th[data-column="name"]').click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: /Cố định đến cột này/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toContainText("PRIVATE_MUST_NOT_RENDER");
  });
  test(surface + " Freeze query survives Drawer Detail Back reload and Undo", async ({ page }) => {
    await fixture(page, surface); await freeze(page);
    await page.locator("tbody tr[data-open]").first().click();
    await page.getByRole("button", { name: /Full Detail/ }).click();
    await page.getByRole("button", { name: "Quay lại bảng", exact: true }).click();
    await expect.poll(() => requested(page)).toBe("note");
    await page.reload();
    await expect.poll(() => requested(page)).toBe("note");
    await trigger(page).click({ button: "right" }); await page.getByRole("menuitem", { name: "Bỏ cố định từ cột này", exact: true }).click();
    await expect.poll(() => requested(page)).toBe("status");
    await page.getByRole("button", { name: "Hoàn tác", exact: true }).click();
    await expect.poll(() => requested(page)).toBe("note");
  });
  test(surface + " Freeze hide and reorder normalize only the optional boundary", async ({ page }) => {
    await fixture(page, surface); await freeze(page);
    await page.locator("#visible-columns").click();
    await page.getByRole("button", { name: "Ẩn Ghi chú", exact: true }).click();
    await expect.poll(() => requested(page)).toBeNull();
    await page.getByRole("button", { name: "Đóng cài đặt", exact: true }).click();
    await expect(page.locator('th[data-column="note"]')).toHaveCount(0);
    await freeze(page, "Trạng thái");
    await page.locator('th[data-column="status"]').dragTo(page.locator('th[data-column="count"]'));
    await expect.poll(async () => (await queryState(page))?.order).toEqual(["name","status","count","note","id"]);
    await expect.poll(() => requested(page)).toBe("status");
    await expect(page.locator("#table-scroll")).toHaveAttribute("data-tdd-freeze-limit", "status");
    await expect(page.locator('th[data-column="name"]')).toHaveAttribute("draggable","false");
  });
  test(surface + " Freeze local Saved All and built-in snapshots stay independent", async ({ page }) => {
    await fixture(page, surface); await freeze(page);
    await page.locator(".view-add").click();
    await page.getByRole("textbox", { name: "Tên Quick View", exact: true }).fill("SYNTHETIC Freeze");
    await page.getByRole("button", { name: "Lưu Quick View", exact: true }).click();
    await page.getByRole("button", { name: "Đóng cài đặt", exact: true }).click();
    await page.getByRole("tab", { name: "Count baseline", exact: true }).click();
    await expect.poll(() => requested(page)).toBe("count");
    await page.getByRole("tab", { name: /SYNTHETIC Freeze/ }).click();
    await expect.poll(() => requested(page)).toBe("note");
    await page.getByRole("tab", { name: /Tất cả/ }).click();
    await expect.poll(() => requested(page)).toBeNull();
    await page.getByRole("tab", { name: /SYNTHETIC Freeze/ }).click();
    await expect.poll(() => requested(page)).toBe("note");
  });
  test(surface + " Freeze resize clips effective prefix without mutating requested state", async ({ page }) => {
    await page.setViewportSize({width:1440,height:900}); await fixture(page,surface); await freeze(page);
    await page.setViewportSize({width:320,height:900});
    await expect(page.locator("#table-scroll")).toHaveAttribute("data-tdd-freeze-limit","name");
    await expect.poll(() => requested(page)).toBe("note");
    await page.setViewportSize({width:1440,height:900});
    // PAP-1474 fixed typed column widths make all three requested columns fit on desktop.
    // On narrow screens the effective prefix clips; widening restores the complete requested state.
    await expect(page.locator("#table-scroll")).toHaveAttribute("data-tdd-freeze-limit","note");
    await expect.poll(() => requested(page)).toBe("note");
  });
  for (const width of [1440, 1024, 768, 390, 320]) test(surface + " Freeze measured sticky geometry " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await fixture(page, surface); await freeze(page);
    await expect.poll(() => requested(page)).toBe("note");
    await expect(page.locator("thead [data-tdd-freeze-cell]").first()).toHaveAttribute("data-column", "name");
    if (width <= 390) await expect(page.locator("[data-tdd-freeze-notice]")).toContainText("Màn hình quá hẹp");
    // Query updates legitimately reload controller rows. Wait for the response
    // for this exact boundary, its mounted rows, and the measured body stamps.
    // Keep every physical geometry assertion below unchanged.
    await expect.poll(() => page.evaluate(() => {
      const owned = Object.entries(history.state ?? {}).find(([key]) => key.startsWith("pino:tdd:"))?.[1] as { query?: { frozenThrough?: string | null } } | undefined;
      const headers = document.querySelectorAll("thead [data-tdd-freeze-cell]");
      const rows = document.querySelectorAll("tbody tr[data-record]");
      return window.__freezeResolvedBoundary === owned?.query?.frozenThrough && headers.length > 0 && rows.length === 8
        && [...rows].every(row => row.querySelectorAll("td[data-tdd-freeze-cell]").length === headers.length);
    })).toBe(true);
    await page.locator("#table-scroll").evaluate(node => { node.scrollLeft = 240; });
    const geometry = await page.evaluate(() => {
      const viewport = document.getElementById("table-scroll")!;
      const vr = viewport.getBoundingClientRect();
      const columns = [...document.querySelectorAll<HTMLElement>("thead [data-tdd-freeze-cell]")].map(header => {
        const body = document.querySelector<HTMLElement>('tbody td[data-freeze-column="' + header.dataset.column + '"]')!;
        const hr = header.getBoundingClientRect(), br = body.getBoundingClientRect();
        return { key: header.dataset.column, headerLeft: hr.left, bodyLeft: br.left, width: hr.width, offset: parseFloat(getComputedStyle(header).left), position: getComputedStyle(header).position };
      });
      return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, viewportLeft: vr.left, viewportWidth: viewport.clientWidth, scrollLeft: viewport.scrollLeft, scrollWidth: viewport.scrollWidth, allColumns: [...document.querySelectorAll<HTMLElement>("thead th[data-column]")].map(th => ({ key: th.dataset.column, width: th.getBoundingClientRect().width })), columns };
    });
    expect(geometry.documentWidth).toBeLessThanOrEqual(width + 2);
    expect(geometry.columns[0]?.key).toBe("name");
    if (geometry.scrollWidth > geometry.viewportWidth + 2) expect(geometry.scrollLeft).toBeGreaterThan(0);
    for (let i = 0; i < geometry.columns.length; i++) {
      const column = geometry.columns[i]; expect(column.position).toBe("sticky");
      expect(Math.abs(column.headerLeft - column.bodyLeft)).toBeLessThan(2);
      expect(Math.abs(column.headerLeft - geometry.viewportLeft - column.offset)).toBeLessThan(2);
      if (i > 0) expect(column.headerLeft).toBeGreaterThanOrEqual(geometry.columns[i - 1].headerLeft + geometry.columns[i - 1].width - 2);
    }
    expect(geometry.columns.map(column => column.key)).toEqual(geometry.allColumns.slice(0, geometry.columns.length).map(column => column.key));
    const end = geometry.columns.at(-1)!.offset + geometry.columns.at(-1)!.width;
    expect(end).toBeLessThan(geometry.viewportWidth);
    if (geometry.columns.length > 1) expect(end).toBeLessThanOrEqual(geometry.viewportWidth - 112 + 2);
    const next = geometry.allColumns[geometry.columns.length];
    if (next) expect(end + next.width).toBeGreaterThan(geometry.viewportWidth - 112 - 2);
    mkdirSync("artifacts/pap1105-freeze", { recursive: true });
    writeFileSync("artifacts/pap1105-freeze/" + surface + "-" + width + ".json", JSON.stringify(geometry, null, 2));
    await page.screenshot({ path: "artifacts/pap1105-freeze/" + surface + "-" + width + ".png" });
  });
}
