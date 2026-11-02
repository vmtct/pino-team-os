import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("PAP-1033 uses canonical DS primitives, not a parallel table", async () => {
  const [grid, detail, css] = await Promise.all([
    readFile("app/bo/subscriptions/SubscriptionHistoryGrid.tsx", "utf8"),
    readFile("app/bo/components/registration/BoFullDetail.tsx", "utf8"),
    readFile("app/bo/components/data-grid/bo-data-grid.module.css", "utf8")
  ]);
  assert.match(grid, /import \{ BoDataGrid,/);
  assert.match(grid, /<BoQuickView/);
  assert.match(grid, /useAuthorizedBoPublicView/);
  assert.match(grid, /<BoDataGrid/);
  assert.match(grid, /rowsAlreadyFiltered/);
  assert.match(grid, /subscriptionDirectory/);
  assert.match(grid, /serverFilters/);
  assert.match(grid, /nextCursors/);
  assert.doesNotMatch(grid, /<table/);
  assert.match(detail, /"Enrollment"/);
  assert.match(css, /first Quick View and sticky identity must not overlap/);
});

test("PAP-1033 does not fabricate financial mutation or paged sort", async () => {
  const grid = await readFile("app/bo/subscriptions/SubscriptionHistoryGrid.tsx", "utf8");
  assert.doesNotMatch(grid, /createBillingSale|activateSubscription|placeBulkEnrollments|POST|\bfetch\(/);
  assert.match(grid, /sortableKeys:\[\]/);
  assert.match(grid, /serverFilters\(typed\)/);
  assert.match(grid, /BoApiError/);
  assert.match(grid, /"permission"/);
});
