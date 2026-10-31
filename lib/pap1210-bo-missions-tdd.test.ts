import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { assignmentDefinition, assignmentFields, assignmentProvider, assignmentQuery, assignmentSchema } from "../app/bo/missions/schema";
import { parseMissionAssignment, readMissionAssignment, readMissionAssignments } from "./bo-mission-assignments";
import { BoApiError } from "./bo-api-error";
import { composeTabs, TddRegistry, validateModule } from "./workspace-schema";
import { createBoTddAdapter } from "./workspace-adapters";
import { TddTable } from "../app/components/workspace-renderer/Table";
import { handleBoOperationalReadRequest, type BoReadEnv } from "./bo-read-handler";
import type { BoAccessRequest } from "./bo-core";
import { decideHostBoundary } from "./host-boundary";
import { BO_SIDEBAR_MODULES } from "./bo-sidebar-routes";
import { currentBoModuleHref } from "./bo-url-contract";
import { unifiedBoWorkspaceSource } from "../app/bo/architecture/bo-unified-workspace-source";
import { isBoStagingRouteAdmitted } from "../app/bo/architecture/bo-staging-route-policy";
import { missionCenterFromUrl, missionCenterUrl } from "../app/bo/missions/navigation";

const center = "01900000-0000-7000-8000-000000000001", id = "01900000-0000-7000-8000-000000000002", other = "01900000-0000-7000-8000-000000000003";
const row = { id, centerId: center, studentId: other, missionId: id, missionCodeSnapshot: "TEST-READ", missionNameSnapshot: "Source test assignment",
  contextKey: "", contextLabel: null, status: "ASSIGNED", assignedAt: "2026-10-30T00:00:00.000Z", updatedAt: "2026-10-30T00:00:00.000Z",
  assignedByUserId: other, updatedByUserId: other, cancelledAt: null, cancelledReason: null, version: 1 };
const signal = () => new AbortController().signal;
const reply = (data: unknown, status = 200): typeof fetch => async () => Response.json({ data }, { status });

test("PAP-1210: reload restores only authorized Center; Center change clears assignment identity", () => {
  const url = new URL(`https://bo.staging.pinohouse.art/bo?module=missions&centerId=${center}&record=${id}`);
  assert.equal(missionCenterFromUrl([{ id: center }, { id: other }], url), center);
  assert.equal(missionCenterFromUrl([{ id: other }], url), "");
  assert.equal(missionCenterFromUrl([{ id: center }], new URL("https://bo.staging.pinohouse.art/bo/missions")), center);
  const changed = new URL(missionCenterUrl(url, other), url);
  assert.equal(changed.searchParams.get("module"), "missions");
  assert.equal(changed.searchParams.get("centerId"), other);
  assert.equal(changed.searchParams.has("record"), false);
  assert.equal(url.searchParams.get("record"), id);
  url.searchParams.append("centerId", other);
  assert.equal(missionCenterFromUrl([{ id: center }, { id: other }], url), "");
});

test("PAP-1210: one typed BO assignment schema, read-only capabilities and honest tabs", () => {
  validateModule(assignmentSchema);
  assert.equal(assignmentSchema.key, "missions");
  assert.deepEqual(composeTabs(assignmentSchema).map(t => [t.id, t.label]), [["overview", "Tổng quan"], ["results", "Kết quả"], ["diary", "Nhật Ký"], ["history", "Lịch sử"]]);
  assert.deepEqual(assignmentDefinition.capabilities, { read: "student.mission_assignment.view" });
  assert.equal(assignmentDefinition.detail.history.kind, "unavailable");
  assert.equal(assignmentProvider.mutation, undefined);
  assert.equal(assignmentSchema.drawer.density, "one-column");
  const ui = readFileSync("app/bo/missions/BoMissionsTdd.tsx", "utf8");
  assert.match(ui, /SurfaceWorkspace/);
  assert.match(ui, /liên kết trực tiếp/);
  assert.match(ui, /nguồn kết quả học viên chưa được kết nối/);
  assert.match(ui, /chưa xác minh đầy đủ nguồn chọn Student/);
  assert.doesNotMatch(ui, /localStorage|mission-assignments-prototype|<table\b|MissionCatalogView/);
});

test("PAP-1210: query entry, dedicated route, real sidebar and host boundaries", () => {
  assert.ok(BO_SIDEBAR_MODULES.includes("missions"));
  assert.equal(currentBoModuleHref("missions", {}), "/bo?module=missions");
  assert.equal(unifiedBoWorkspaceSource.modules.missions?.label, "Nhiệm vụ");
  assert.equal(isBoStagingRouteAdmitted("/bo/missions"), true);
  assert.match(readFileSync("app/bo/components/registration/BoRuntimeBoundary.tsx", "utf8"), /if \(moduleKey === "missions"\) return <MissionsTdd/);
  assert.match(readFileSync("app/bo/missions/page.tsx", "utf8"), /<BoMissionsTdd/);
  for (const path of ["/bo/missions", "/api/bo/learning/mission-assignments", "/api/bo/learning/mission-assignments/" + id]) {
    assert.equal(decideHostBoundary("bo.staging.pinohouse.art", path).action, "next");
    assert.equal(decideHostBoundary("tos.staging.pinohouse.art", path).action, "not_found");
    assert.equal(decideHostBoundary("ho.staging.pinohouse.art", path).action, "not_found");
  }
  for (const method of ["POST", "PUT", "DELETE"]) assert.equal(decideHostBoundary("bo.staging.pinohouse.art", "/api/bo/learning/mission-assignments/" + id, method).action, "not_found");
});

test("PAP-1210: parser rejects wrong Center, identities, statuses, versions and malformed fields", () => {
  assert.deepEqual(parseMissionAssignment({ ...row, secret: "drop" }, center), row);
  for (const patch of [{ centerId: other }, { id: "bad" }, { studentId: "bad" }, { missionId: 2 }, { status: "COMPLETED" }, { version: 0 }, { version: "1" }, { missionNameSnapshot: null }, { contextLabel: 3 }, { assignedAt: "yesterday" }, { cancelledReason: "inconsistent" }, { status: "CANCELLED" }]) {
    assert.throws(() => parseMissionAssignment({ ...row, ...patch }, center), BoApiError);
  }
  assert.throws(() => parseMissionAssignment(row, center, other), BoApiError);
  assert.throws(() => parseMissionAssignment(null, center), BoApiError);
});

test("PAP-1210: provider reads exact scoped list/detail, preserves empty and errors", async () => {
  const paths: string[] = [];
  const fetcher: typeof fetch = async input => { paths.push(String(input)); return Response.json({ data: String(input).includes("/" + id + "?") ? row : [row] }); };
  const result = await assignmentProvider.list(assignmentQuery, { surface: "BO", centerId: center }, fetcher, signal());
  assert.equal(result.total, 1); assert.equal(result.records[0]?.centerId, center); assert.equal(result.records[0]?.version, "1");
  assert.equal(result.records[0]?.row.status, "Đang giao");
  assert.equal((await assignmentProvider.detail(id, { surface: "BO", centerId: center }, fetcher, signal()))?.row.id, id);
  assert.equal(paths[0], "/api/bo/learning/mission-assignments?centerId=" + center + "&limit=100&offset=0");
  assert.equal(paths[1], "/api/bo/learning/mission-assignments/" + id + "?centerId=" + center);
  assert.deepEqual(await readMissionAssignments(reply([]), center, signal()), []);
  assert.equal(await readMissionAssignment(reply(null, 404), center, id, signal()), null);
  for (const status of [401, 403, 409, 503]) await assert.rejects(readMissionAssignments(reply(null, status), center, signal()), e => e instanceof BoApiError && e.status === status);
  for (const data of [null, {}, [row, row], [{ ...row, centerId: other }]]) await assert.rejects(readMissionAssignments(reply(data), center, signal()));
  await assert.rejects(assignmentProvider.list(assignmentQuery, { surface: "HO" }, fetcher, signal()));
  const abort = new AbortController(); abort.abort();
  await assert.rejects(readMissionAssignments(reply([]), center, abort.signal));
});

test("PAP-1210: pagination reads the next offset, rejects repetition and never uses page size as total", async () => {
  const first = Array.from({ length: 100 }, (_, i) => ({ ...row, id: `01900000-0000-7000-8000-${String(i + 10).padStart(12, "0")}` }));
  const paths: string[] = [];
  const fetcher: typeof fetch = async input => { paths.push(String(input)); return Response.json({ data: paths.length === 1 ? first : [row] }); };
  assert.equal((await readMissionAssignments(fetcher, center, signal())).length, 101);
  assert.match(paths[1]!, /offset=100$/);
  await assert.rejects(readMissionAssignments(reply(first), center, signal()));
});

test("PAP-1210: BFF passes Center and supported filters to Core, rejects forged/unbounded query", async () => {
  const forwarded: BoAccessRequest[] = [];
  const env: BoReadEnv = { APP_ENV: "staging", PINO_BO_CORE: { async executeWithStaffPassword(request) { forwarded.push(request); return { status: 403, body: { error: { code: "ACCESS_PERMISSION_DENIED" } }, requestId: "scope-denied" }; } } };
  const path = "learning/mission-assignments";
  const request = (query: string, auth = true) => new Request("https://bo.staging.pinohouse.art/api/bo/" + path + query, { headers: auth ? { cookie: "pino_staff_password_session=" + "a".repeat(48) } : {} });
  const response = await handleBoOperationalReadRequest(request("?centerId=" + center + "&status=ASSIGNED&studentId=" + other + "&limit=15&offset=0"), env, path);
  assert.equal(response.status, 403); assert.equal(response.headers.get("x-request-id"), "scope-denied");
  assert.deepEqual(forwarded, [{ method: "GET", path: path + "?centerId=" + center + "&status=ASSIGNED&studentId=" + other + "&limit=15&offset=0" }]);
  for (const query of ["", "?centerId=bad", "?centerId=" + center + "&centerId=" + other, ...["status=COMPLETED", "limit=101", "offset=-1", "studentId=bad", "userId=forged", "limit=01"].map(q => "?centerId=" + center + "&" + q)]) assert.equal((await handleBoOperationalReadRequest(request(query), env, path)).status, 400, query);
  assert.equal((await handleBoOperationalReadRequest(request("?centerId=" + center, false), env, path)).status, 401);
  assert.equal((await handleBoOperationalReadRequest(request("?centerId=" + center), env, path + "/" + id + "/cancel")).status, 404);
  assert.equal(forwarded.length, 1);
});

test("PAP-1210: actual authenticated adapter fails closed on missing permission and wrong Center", async () => {
  let permitted = true, wrongCenter = false;
  const fetcher: typeof fetch = async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/context")) return Response.json({ data: { surface: "BO", entitled: true, userId: other, permissionKeys: ["team.bo.access", ...(permitted ? ["student.mission_assignment.view"] : [])] } });
    if (url.pathname.endsWith("/centers")) return Response.json({ data: [{ id: center }] });
    return Response.json({ data: [{ ...row, centerId: wrongCenter ? other : center }] });
  };
  const options = { registry: new TddRegistry(), definition: assignmentDefinition, provider: assignmentProvider, centerId: center, origin: "https://bo.staging.pinohouse.art", fetcher };
  const adapter = await createBoTddAdapter(options, signal());
  assert.equal((await adapter.list(assignmentQuery, signal())).rows.length, 1);
  assert.equal(adapter.capabilities.edit, false);
  wrongCenter = true;
  await assert.rejects(adapter.list(assignmentQuery, signal()));
  wrongCenter = false; permitted = false;
  await assert.rejects(adapter.list(assignmentQuery, signal()), e => e instanceof BoApiError && e.status === 403);
  adapter.dispose();
});

test("PAP-1210: shared Table renders honest empty, denied and error states", () => {
  const registry = new TddRegistry();
  const schema = registry.register(assignmentSchema);
  for (const status of ["ready", "denied", "error"] as const) {
    const html = renderToStaticMarkup(h(TddTable<typeof assignmentFields>, { registry, schema, context: { surface: "BO", centerId: center, authorize: () => true }, rows: [], query: assignmentQuery, total: 0, status, onQueryChange: () => {}, onOpen: () => {} }));
    assert.match(html, status === "ready" ? /Không có/ : status === "denied" ? /quyền/ : /tải/);
    assert.doesNotMatch(html, /Source test assignment|COMPLETED/);
  }
});
