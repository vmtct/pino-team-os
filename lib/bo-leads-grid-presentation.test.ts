import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(path, "utf8");

test("PAP-390 Leads reuses shared Data Grid with URL browse state and side peek", async () => {
  const source = await read("app/bo/sales/leads/SalesLeadPipelineView.tsx");
  assert.match(source, /useBoDataGridUrlState\(LEAD_GRID_OPTIONS\)/);
  assert.match(source, /searchParams\.get\("leadIntent"\)/);
  assert.match(source, /params\.set\("leadIntent", nextId\)/);
  assert.match(source, /router\.push\(href, \{ scroll: false \}\)/);
  assert.match(source, /<BoDataGrid/);
  assert.match(source, /BoDataGridSidePeek/);
  assert.match(source, /Lead \/ contact/);
  assert.match(source, /Intent \/ age/);
  assert.match(source, /Filter Leads by lifecycle/);
  assert.doesNotMatch(source, /className=\{styles\.leadCard/);
});

test("PAP-390 preserves canonical lifecycle, idempotent retry and Pancake detail authority", async () => {
  const source = await read("app/bo/sales/leads/SalesLeadPipelineView.tsx");
  assert.match(source, /pendingAttempt\?\.key === key/);
  assert.match(source, /idempotencyKey: crypto\.randomUUID\(\)/);
  assert.match(source, /boApi\.markAcquisitionContacted/);
  assert.match(source, /boApi\.verifyAcquisitionContact/);
  assert.match(source, /boApi\.closeAcquisitionIntent/);
  assert.match(source, /expectedVersion và transition rules luôn do Core quyết định/);
  assert.match(source, /conversation\.providerDeepLink/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|leadScore|pipelineValue/i);
});
