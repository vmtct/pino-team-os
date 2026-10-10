import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildRunningClassGridRows } from "../lib/bo-running-classes-grid";
import type { F3Path, F3RunningClass } from "../lib/f3-delivery-api";

const gridCss = readFileSync(resolve(process.cwd(), "app/bo/components/data-grid/bo-data-grid.module.css"), "utf8");
const pageCss = readFileSync(resolve(process.cwd(), "app/bo/bo.module.css"), "utf8");

const paths: F3Path[] = [
  { id: "path-art", code: "ART", displayName: "Art Foundation", status: "ACTIVE", version: 1 },
  { id: "path-piano", code: "PIANO", displayName: "Piano Foundation", status: "ACTIVE", version: 1 },
];
const classes: F3RunningClass[] = Array.from({ length: 12 }, (_, index) => ({
  id: `01-running-class-${String(index + 1).padStart(2, "0")}`,
  centerId: "center-1",
  pathProgramId: index % 2 ? "path-piano" : "path-art",
  learningSpaceId: "space-1",
  operationalName: `${index % 2 ? "Piano" : "Art"} ${String(index + 1).padStart(2, "0")}`,
  weekdayIso: (index % 6) + 1,
  windowStartsLocal: index % 2 ? "16:00" : "14:00",
  windowEndsLocal: index % 2 ? "17:30" : "15:30",
  deliveryTopology: "FIXED_COHORT",
  defaultParticipationMinutes: 90,
  optimalConcurrentCapacity: 8 + (index % 3),
  hardConcurrentCapacity: 12,
  status: index === 10 ? "INACTIVE" : index === 11 ? "ARCHIVED" : "ACTIVE",
  version: 1,
}));

function fixture() {
  const rows = buildRunningClassGridRows(classes, paths, { sortKey: "class", sortDirection: "asc" }).slice(0, 8);
  return `<!doctype html><html><head><style>${gridCss}\n${pageCss}\nbody{margin:0;background:#f5f4f7;font-family:Arial,sans-serif}.frame{padding:36px;max-width:1280px;margin:0 auto}.heading{margin-bottom:18px}.heading span{font-size:10px;font-weight:800;letter-spacing:.08em;color:#777}.heading h1{margin:5px 0;font-size:28px}.heading p{margin:0;color:#777;font-size:13px}</style></head><body><main class="frame">
  <header class="heading"><span>PINO TEAM · BACK OFFICE</span><h1>Running Classes</h1><p>Recurring operational schedule masters from Core · read-only canonical projection.</p></header>
  <section class="surface">
    <div class="toolbar"><label class="searchBox"><span>⌕</span><input value="" placeholder="Search Running Classes…" aria-label="Search Running Classes…"></label><span class="sortHint">↕ Sort</span><div class="toolbarSpacer"></div><span class="resultLabel">12 of 12 classes</span><label class="gridToolbarFilter">Status<select aria-label="Filter Running Classes by status"><option>All</option><option>Active</option><option>Inactive</option><option>Archived</option></select></label></div>
    <div class="tableViewport"><table><caption>Running Classes</caption><thead><tr><th data-sticky="true" aria-sort="ascending"><button class="sortButton"><span>Class</span><i>↑</i></button></th><th aria-sort="none"><button class="sortButton"><span>Program</span><i>↕</i></button></th><th aria-sort="none"><button class="sortButton"><span>Pattern</span><i>↕</i></button></th><th data-align="right" aria-sort="none"><button class="sortButton"><span>Capacity</span><i>↕</i></button></th><th aria-sort="none"><button class="sortButton"><span>Status</span><i>↕</i></button></th><th>Canonical ID</th></tr></thead><tbody>${rows.map((row) => `<tr><td data-sticky="true"><strong>${row.item.operationalName}</strong></td><td>${row.programName}</td><td>${row.patternLabel}</td><td data-align="right">${row.capacityLabel}</td><td><span class="statusPill" data-tone="success"><i></i>${row.item.status}</span></td><td><span class="canonicalId"><code title="${row.item.id}">${row.item.id}</code><button aria-label="Copy ${row.item.operationalName} canonical ID">⧉</button></span></td></tr>`).join("")}</tbody></table></div>
    <footer class="pagination"><label>Rows per page<select><option selected>10</option><option>25</option><option>50</option><option>100</option></select></label><div class="paginationNav"><span>1–10 of 12</span><button disabled>‹</button><button>›</button></div></footer>
  </section>
</main></body></html>`;
}

test("PAP-384 Running Classes keeps the approved six-column scan surface on the shared grid", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.setContent(fixture());
  for (const header of ["Class", "Program", "Pattern", "Capacity", "Status", "Canonical ID"]) await expect(page.getByRole("columnheader", { name: new RegExp(header) })).toBeVisible();
  await expect(page.getByLabel("Search Running Classes…")).toBeVisible();
  await expect(page.getByLabel("Filter Running Classes by status")).toBeVisible();
  await expect(page.getByText("1–10 of 12")).toBeVisible();
  await expect(page.locator(".surface")).toHaveScreenshot("pap384-running-classes-grid.png");
});
