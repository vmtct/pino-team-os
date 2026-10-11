import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { accessAuditPagePath } from "./bo-api";

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
  assert.match(source, /offset: \(state\.page - 1\) \* state\.pageSize/);
  assert.match(source, /query: state\.search/);
  assert.match(source, /outcome/);
  assert.match(source, /BoDataGridSidePeek/);
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
