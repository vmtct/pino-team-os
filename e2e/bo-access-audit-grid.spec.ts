import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const gridCss = readFileSync(resolve(process.cwd(), "app/bo/components/data-grid/bo-data-grid.module.css"), "utf8");
const pageCss = readFileSync(resolve(process.cwd(), "app/bo/bo.module.css"), "utf8");

function fixture() {
  const rows = Array.from({ length: 10 }, (_, index) => `<tr tabindex="0"><td data-sticky="true"><strong>ACCESS_ROLE_${index % 2 ? "UPDATED" : "CREATED"}</strong><span class="canonicalId"><code>evt-${index + 1}</code><button>⧉</button></span></td><td><strong>11/10/2026 08:${String(30 - index).padStart(2, "0")}</strong><br><span class="statusPill" data-tone="success"><i></i>succeeded</span></td><td>user<br><code>user-${index + 1}</code></td><td>access_role<br><code>role-${index + 1}</code></td><td><span class="canonicalId"><code>request-${index + 1}</code><button>⧉</button></span></td></tr>`).join("");
  return `<!doctype html><html><head><style>${gridCss}\n${pageCss}\nbody{margin:0;background:#f5f4f7;font-family:Arial,sans-serif}.frame{padding:36px;max-width:1280px;margin:0 auto}</style></head><body><main class="frame"><header class="heading"><span>PINO TEAM · SYSTEM</span><h1>Audit</h1><p>Privileged Access administration history · canonical newest-first server projection.</p></header><section class="surface"><div class="toolbar"><label class="searchBox"><span>⌕</span><input aria-label="Search event, request, actor or target…" placeholder="Search event, request, actor or target…"></label><div class="toolbarSpacer"></div><span class="resultLabel" id="result">26 Access events · newest first</span><button class="iconButton" aria-label="Refresh data">↻</button><label class="gridToolbarFilter">Result<select aria-label="Filter Audit by result"><option value="">All</option><option value="succeeded">Succeeded</option><option value="failed">Failed</option><option value="denied">Denied</option></select></label></div><div class="tableViewport"><table><caption>Access audit events</caption><thead><tr><th data-sticky="true">Event</th><th>Time / Result</th><th>Actor</th><th>Target</th><th>Request ID</th></tr></thead><tbody>${rows}</tbody></table></div><footer class="pagination"><label>Rows per page<select aria-label="Rows per page"><option selected>10</option><option>25</option><option>50</option></select></label><div class="paginationNav"><span id="range">1–10 of 26</span><button id="prev" disabled aria-label="Previous page">‹</button><button id="next" aria-label="Next page">›</button></div></footer></section><script>let page=1;document.querySelector('#next').onclick=()=>{page=2;document.querySelector('#range').textContent='11–20 of 26';document.querySelector('#prev').disabled=false};document.querySelector('[aria-label="Filter Audit by result"]').onchange=(e)=>{if(e.target.value==='denied'){document.querySelector('#result').textContent='3 Access events · newest first';document.querySelector('#range').textContent='1–3 of 3'}};</script></main></body></html>`;
}

test("PAP-386 Audit uses the shared grid with bounded page and filter controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.setContent(fixture());
  for (const header of ["Event", "Time / Result", "Actor", "Target", "Request ID"]) await expect(page.getByRole("columnheader", { name: header })).toBeVisible();
  await expect(page.getByLabel("Search event, request, actor or target…")).toBeVisible();
  await expect(page.getByLabel("Filter Audit by result")).toBeVisible();
  await expect(page.getByText("1–10 of 26")).toBeVisible();
  await page.getByLabel("Next page").click();
  await expect(page.getByText("11–20 of 26")).toBeVisible();
  await page.getByLabel("Filter Audit by result").selectOption("denied");
  await expect(page.getByText("1–3 of 3")).toBeVisible();
  await expect(page.locator(".surface")).toHaveScreenshot("pap386-access-audit-grid.png");
});
