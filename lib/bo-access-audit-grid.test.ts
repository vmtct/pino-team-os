import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { accessAuditPagePath } from "./bo-api";
import { loadBoAccessAuditPageForState } from "./bo-access-audit-page-controller";

test("Access Audit page path preserves bounded server browse state", () => {
  assert.equal(accessAuditPagePath({ limit: 25, offset: 50 }), "access/audit?limit=25&offset=50");
  assert.equal(
    accessAuditPagePath({ limit: 10, offset: 20, query: " ACCESS_ROLE ", outcome: " denied " }),
    "access/audit?limit=10&offset=20&query=ACCESS_ROLE&outcome=denied",
  );
});

test("Access Audit view uses the shared Data Grid and delegates paging/filtering to the server", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app/bo/system/audit/AccessAuditView.tsx"), "utf8");
  assert.match(source, /<BoDataGrid/);
  assert.match(source, /boApi\.accessAuditPage/);
  assert.match(source, /outcome/);
  const controller = fs.readFileSync(path.join(process.cwd(), "lib/bo-access-audit-page-controller.ts"), "utf8");
  assert.match(controller, /offset: \(state\.page - 1\) \* state\.pageSize/);
  assert.match(controller, /query: state\.search/);
  assert.match(source, /BoDataGridSidePeek/);
  assert.match(source, /loadBoAccessAuditPageForState/);
  assert.match(source, /result\.kind === \"reconcile-page\"/);
  assert.match(source, /setPageRef\.current\(result\.page\)/);
  assert.equal(source.includes("[outcome, refreshToken, setPage"), false);
  assert.doesNotMatch(source, /\.slice\(/);
  assert.doesNotMatch(source, /\.filter\(/);
});

test("Team BO read facade forwards bounded Access Audit page and filter inputs only", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "lib/bo-read-handler.ts"), "utf8");
  const auditBranch = source.slice(source.indexOf('if (path === "access/audit")'), source.indexOf('if (path === "identity/parents")'));
  for (const token of ["limit", "offset", "query", "outcome"]) assert.match(auditBranch, new RegExp(token));
  assert.doesNotMatch(auditBranch, /cursor|retention|delete|mutation/i);
});


test("Access Audit controller reconciles stale URL page then refetches the visible event without a loop", async () => {
  const offsets: number[] = [];
  const fetchPage = async (input: { limit: number; offset: number }) => {
    offsets.push(input.offset);
    return input.offset === 25
      ? { events: [], page: { limit: 25, offset: 25, total: 1, page: 2, pageCount: 1, hasPrevious: true, hasNext: false } }
      : { events: [{ id: "evt-1" } as never], page: { limit: 25, offset: 0, total: 1, page: 1, pageCount: 1, hasPrevious: false, hasNext: false } };
  };

  const first = await loadBoAccessAuditPageForState({ page: 2, pageSize: 25, search: "", outcome: "" }, fetchPage);
  assert.deepEqual(first, { kind: "reconcile-page", page: 1 });
  const second = await loadBoAccessAuditPageForState({ page: first.page, pageSize: 25, search: "", outcome: "" }, fetchPage);
  assert.equal(second.kind, "ready");
  if (second.kind === "ready") assert.deepEqual(second.data.events.map((event) => event.id), ["evt-1"]);
  assert.deepEqual(offsets, [25, 0]);
});
