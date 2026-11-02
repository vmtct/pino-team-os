import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildEffectCatalogGridRows, type EffectCatalogDefinition } from "../lib/bo-pinoria-effects-grid";

const gridCss = readFileSync(resolve(process.cwd(), "app/bo/components/data-grid/bo-data-grid.module.css"), "utf8");
const pageCss = readFileSync(resolve(process.cwd(), "app/bo/pinoria-effects/pinoria-effects.module.css"), "utf8");
const catalog: EffectCatalogDefinition[] = [
  { key: "TINY", displayName: "Tiny", rarity: "COMMON", implementationVersion: 2, description: "Small traveler", capabilities: ["FULL_AVATAR", "HOUSE_MINI"], fullAvatarDescription: "Small", houseMiniDescription: "Mini" },
  { key: "RAINBOW", displayName: "Rainbow", rarity: "LEGENDARY", implementationVersion: 4, description: "Rainbow aura", capabilities: ["FULL_AVATAR"], fullAvatarDescription: "Rainbow", houseMiniDescription: "Unsupported" },
  { key: "GHOST", displayName: "Ghost", rarity: "EPIC", implementationVersion: 3, description: "Ghost effect", capabilities: ["HOUSE_MINI"], fullAvatarDescription: "Unsupported", houseMiniDescription: "Ghost" },
];

function fixture() {
  const rows = buildEffectCatalogGridRows(catalog);
  return `<!doctype html><html><head><style>${gridCss}\n${pageCss}\nbody{margin:0}</style></head><body><main class="shell"><header class="topbar"><div><p class="eyebrow">PINORIA · BACK OFFICE</p><h1>Effect Catalog</h1><span>Code-defined mutations · read only</span></div><div class="readOnlyBadge">READ ONLY</div></header><div class="gridWrap"><section class="surface"><div class="toolbar"><label class="searchBox"><span>⌕</span><input aria-label="Search effect, key, capability…" placeholder="Search effect, key, capability…"></label><span class="sortHint">↕ Sort</span><div class="toolbarSpacer"></div><span class="resultLabel">3 of 3 effects</span><label class="gridToolbarFilter">Rarity<select aria-label="Filter Effects by rarity"><option>All</option><option>Common</option><option>Rare</option><option>Epic</option><option>Legendary</option></select></label></div><div class="tableViewport"><table><caption>Pinoria Effect Catalog</caption><thead><tr><th data-sticky="true" aria-sort="ascending">Effect</th><th aria-sort="none">Rarity</th><th aria-sort="none">Version</th><th aria-sort="none">Capabilities</th><th aria-sort="none">Surfaces</th></tr></thead><tbody>${rows.map((row) => `<tr tabindex="0"><td data-sticky="true"><span class="itemCell"><i data-effect="${row.item.key}">✦</i><span><strong>${row.item.displayName}</strong><span class="canonicalId"><code>${row.item.key}</code><button>⧉</button></span></span></span></td><td><span class="statusPill" data-tone="neutral"><i></i>${row.item.rarity}</span></td><td>v${row.item.implementationVersion}</td><td><span class="badgeList">${row.item.capabilities.map((capability) => `<span class="badge">${capability}</span>`).join("")}</span></td><td>${row.surfaceLabel}</td></tr>`).join("")}</tbody></table></div><footer class="pagination"><label>Rows per page<select><option>10</option><option selected>25</option></select></label><div class="paginationNav"><span>1–3 of 3</span><button disabled>‹</button><button disabled>›</button></div></footer></section></div></main></body></html>`;
}

test("PAP-385 Effects uses the shared grid language and preserves the five approved scan columns", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.setContent(fixture());
  for (const header of ["Effect", "Rarity", "Version", "Capabilities", "Surfaces"]) await expect(page.getByRole("columnheader", { name: header })).toBeVisible();
  await expect(page.getByLabel("Search effect, key, capability…")).toBeVisible();
  await expect(page.getByLabel("Filter Effects by rarity")).toBeVisible();
  await expect(page.getByText("READ ONLY", { exact: true })).toBeVisible();
  await expect(page.locator(".surface")).toHaveScreenshot("pap385-effects-grid.png");
});
