import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "app/bo/components/data-grid/bo-data-grid.module.css"), "utf8");

function fixture() {
  const rows = Array.from({ length: 8 }, (_, index) => {
    const active = index !== 6;
    return `<tr data-interactive="true" tabindex="0" ${index === 0 ? 'data-selected="true" aria-selected="true"' : 'aria-selected="false"'}>
      <td data-sticky="true"><strong>${index === 0 ? "Architect · Fri Studio" : `Running Class ${index + 1}`}</strong><br><small>Recurring class master</small></td>
      <td><span class="badge">${index % 2 ? "PianoHouse" : "Artchitect"}</span></td>
      <td>Fri · 18:00–21:00</td>
      <td>8 / 10 hard</td>
      <td><span class="statusPill" data-tone="${active ? "success" : "neutral"}"><i></i>${active ? "ACTIVE" : "INACTIVE"}</span></td>
      <td><span class="canonicalId"><code>01a0e728…${String(index).padStart(3, "0")}</code><button aria-label="Copy canonical ID">⧉</button></span></td>
    </tr>`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box} body{margin:0;padding:30px;background:#f6f5f2;color:#26242b;font-family:Arial,Helvetica,sans-serif}
    ${css}
  </style></head><body>
    <section class="surface" aria-busy="false">
      <div class="toolbar">
        <label class="searchBox"><span>⌕</span><input aria-label="Search classes" placeholder="Search classes…"></label>
        <button class="toolButton">☷ Filter <b>1</b></button>
        <span class="sortHint">↕ Sort</span>
        <button class="toolButton">▥ Columns</button>
        <div class="toolbarSpacer"></div><span class="resultLabel">12 results</span><button class="iconButton" aria-label="Refresh data">↻</button>
      </div>
      <div class="filterBar"><span class="filterChip"><span>Status is Active</span><button aria-label="Clear Status filter">×</button></span></div>
      <div class="tableViewport"><table aria-describedby="caption"><caption id="caption">Running Classes</caption>
        <thead><tr>
          <th data-sticky="true" aria-sort="ascending"><button class="sortButton"><span>Class</span><i>↑</i></button></th>
          <th>Program</th><th>Pattern</th><th>Capacity</th><th>Status</th><th>Canonical ID</th>
        </tr></thead><tbody>${rows}</tbody></table></div>
      <footer class="pagination"><label>Rows per page <select><option>25</option></select></label><div class="paginationNav"><span>1–8 of 12</span><button disabled aria-label="Previous page">‹</button><button aria-label="Next page">›</button></div></footer>
    </section>
  </body></html>`;
}

test("PAP-383 foundation keeps the approved dense grid language at desktop width", async ({ page }) => {
  test.skip(process.platform !== "win32", "Founder-approved visual baseline is pinned to the Windows i5 review workstation; cross-platform structure is covered below.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.setContent(fixture());
  await expect(page.locator(".surface")).toHaveScreenshot("pap383-data-grid-foundation.png");
  await expect(page.getByRole("table", { name: "Running Classes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear Status filter" })).toBeVisible();
  await expect(page.getByText("1–8 of 12")).toBeVisible();
});

test("PAP-383 foundation preserves sticky header and first identity column", async ({ page }) => {
  await page.setViewportSize({ width: 920, height: 480 });
  await page.setContent(fixture());
  const viewport = page.locator(".tableViewport");
  await viewport.evaluate((node) => { node.scrollTop = 180; node.scrollLeft = 200; });
  const header = page.locator("thead th").first();
  const identity = page.locator("tbody td").first();
  expect(await header.evaluate((node) => getComputedStyle(node).position)).toBe("sticky");
  expect(await identity.evaluate((node) => getComputedStyle(node).position)).toBe("sticky");
  expect(await identity.evaluate((node) => getComputedStyle(node).left)).toBe("0px");
});

test("PAP-383 foundation exposes keyboard-focusable selectable rows and named controls", async ({ page }) => {
  await page.setContent(fixture());
  const firstRow = page.locator("tbody tr").first();
  await firstRow.focus();
  await expect(firstRow).toBeFocused();
  await expect(firstRow).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Search classes")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy canonical ID" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Next page" })).toBeEnabled();
});
