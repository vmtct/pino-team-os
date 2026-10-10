import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "app/bo/components/data-grid/bo-data-grid.module.css"), "utf8");

let componentBundle: Promise<string> | null = null;

function actualComponentBundle() {
  componentBundle ??= build({
    bundle: true,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    write: false,
    stdin: {
      loader: "tsx",
      resolveDir: process.cwd(),
      sourcefile: "pap383-grid-harness.tsx",
      contents: `
        import React, { useState } from "react";
        import { createRoot } from "react-dom/client";
        import { BoDataGrid, BoDataGridCanonicalId, BoDataGridSidePeek } from "./app/bo/components/data-grid/BoDataGrid";
        function Harness() {
          const [open, setOpen] = useState(false);
          const row = { id: "01a0e728-test" };
          return <>
            <BoDataGrid
              rows={[row]}
              columns={[{ key: "id", header: "ID", render: (item) => <BoDataGridCanonicalId value={item.id} /> }]}
              rowKey={(item) => item.id}
              caption="Actual component grid"
              onRowOpen={() => setOpen(true)}
            />
            {open ? <BoDataGridSidePeek title="Learner" onClose={() => setOpen(false)} footer={<button type="button">Footer action</button>}>
              <button type="button">Body action</button>
            </BoDataGridSidePeek> : null}
          </>;
        }
        createRoot(document.getElementById("root")).render(<Harness />);
      `,
    },
    define: { "process.env.NODE_ENV": '"test"' },
    plugins: [{
      name: "pap383-test-resolve",
      setup(context) {
        context.onResolve({ filter: /^@\// }, (args) => ({ path: resolve(process.cwd(), `${args.path.slice(2)}.ts`) }));
        context.onLoad({ filter: /\.module\.css$/ }, () => ({ contents: 'export default new Proxy({}, { get: (_, key) => String(key) });', loader: "js" }));
      },
    }],
  }).then((result) => result.outputFiles[0]!.text);
  return componentBundle;
}

async function mountActualComponent(page: import("@playwright/test").Page) {
  await page.setContent('<!doctype html><html><body><div id="root"></div><script>window.__pap383Errors=[];addEventListener("error",(event)=>window.__pap383Errors.push(event.error?.stack||event.message));addEventListener("unhandledrejection",(event)=>window.__pap383Errors.push(String(event.reason?.stack||event.reason)));</script></body></html>');
  await page.addScriptTag({ content: await actualComponentBundle() });
  await page.waitForTimeout(100);
  const errors = await page.evaluate(() => (window as unknown as { __pap383Errors: string[] }).__pap383Errors);
  if (errors.length) throw new Error(`Actual component harness failed: ${errors.join(" | ")}`);
  await expect(page.getByRole("table", { name: "Actual component grid" })).toBeVisible();
}

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


test("PAP-383 actual shared component traps SidePeek focus and restores the row", async ({ page }) => {
  await mountActualComponent(page);
  const row = page.getByRole("row").filter({ hasText: "01a0e728-test" });
  await row.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Learner detail" });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", { name: "Close detail" });
  await expect(close).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Footer action" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(row).toBeFocused();
});

test("PAP-383 actual shared row ignores keyboard activation from nested controls", async ({ page }) => {
  await mountActualComponent(page);
  const copy = page.getByRole("button", { name: "Copy canonical ID" });
  await copy.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Learner detail" })).toHaveCount(0);
});
