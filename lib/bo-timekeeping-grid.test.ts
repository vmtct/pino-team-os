import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("PAP-408 Timekeeping uses shared Data Grid with URL-backed bounded server paging", async () => {
  const [view, api, handler] = await Promise.all([
    readFile("app/bo/workforce/timekeeping/TimekeepingView.tsx", "utf8"),
    readFile("lib/bo-api.ts", "utf8"),
    readFile("lib/bo-read-handler.ts", "utf8"),
  ]);

  assert.match(view, /BoDataGrid/);
  assert.match(view, /BoDataGridSidePeek/);
  assert.match(view, /useBoDataGridUrlState/);
  assert.match(view, /PAGE_SIZES = \[25, 50, 100\]/);
  assert.match(view, /limit: state\.pageSize/);
  assert.match(view, /offset: \(state\.page - 1\) \* state\.pageSize/);
  assert.match(view, /Math\.ceil\(result\.summary\.totalSessions \/ state\.pageSize\)/);
  assert.match(view, /setPageRef\.current\(canonicalPage\)/);
  assert.match(view, /Filter Timekeeping by status/);
  assert.match(view, /Filter Timekeeping by staff/);
  assert.match(view, /Timekeeping history from/);
  assert.match(view, /Timekeeping history to/);
  assert.match(view, /Recorded attendance stays immutable/);
  assert.match(view, />Recorded</);
  assert.match(view, />Corrected</);
  assert.match(view, /latestCorrection/);
  assert.doesNotMatch(view, /Load next page/);

  assert.match(api, /timekeeping:[\s\S]*offset\?: number/);
  assert.match(handler, /const offset = url\.searchParams\.get\("offset"\)/);
  assert.match(handler, /if \(offset\) body\.offset = Number\(offset\)/);
});
