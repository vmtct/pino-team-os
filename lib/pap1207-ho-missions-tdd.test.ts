import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { composeTabs, validateModule } from "./workspace-schema";
import { BoApiError } from "./bo-api-error";
import { surfaceSession } from "./workspace-adapters/session";
import { decideHostBoundary } from "./host-boundary";
import { missionDefinition, missionProvider, missionQuery, missionSchema, projectMission, missionUuid, missionTableColumnKeys, formatMissionAuditTime, missionVerifiedActorName } from "../app/ho/learning/missions/schema";

const id = "01900000-0000-7000-8000-000000000002";
const row = { id, name: "Mori water", code: "MORI-1", status: "ACTIVE", level: 3,
  plsValue: 30, paperSize: "A4", path: "ART", prerequisite: null,
  description: "Color", guideline: "Observe first" };
const signal = () => new AbortController().signal;
test("PAP-1207: registered HO TDD module exposes explicit source-backed Archive, not hard delete", () => {
  validateModule(missionSchema);
  assert.equal(missionSchema.key, "missions");
  assert.equal(missionDefinition.surface, "HO");
  assert.equal(missionDefinition.capabilities.read, "catalog.learning.view");
  assert.equal(missionProvider.mutation, undefined);
  assert.equal(missionDefinition.drawer.density, "one-column");
  assert.deepEqual(composeTabs(missionSchema).map(t => t.id), ["overview", "history"]);
  assert.equal(missionDefinition.detail.history.kind, "unavailable");
  const archive = missionDefinition.actions.find(action => action.id === "mission-archive");
  assert.deepEqual(archive, { id: "mission-archive", label: "Lưu trữ", slot: "detail.header",
    variant: "danger", capability: "edit", handler: "archiveMission" });
  const uiSource = readFileSync("app/ho/learning/missions/HoMissionsTdd.tsx", "utf8");
  assert.match(uiSource, /archiveMission:\s*\{ kind: "mutation"/);
  assert.match(uiSource, /kind: "archive"/);
  assert.match(uiSource, /window\.confirm/);
  assert.match(uiSource, /Assignment và Nhật Ký hiện có vẫn được giữ nguyên/);
  assert.doesNotMatch(uiSource, /missionLifecycleNote|Xóa vật lý không khả dụng|<p role="note">/);
  assert.doesNotMatch(uiSource, /method:\s*"DELETE"/);
  const hoTheme = readFileSync("app/ho/ho-theme.css", "utf8");
  assert.match(hoTheme, /\[data-surface="ho"\] \.tdd-action-host \.pds-bo-action-button-primary/);
  assert.match(hoTheme, /--bo-color-accent:var\(--ds-primary\)/);
  assert.match(hoTheme, /--bo-color-accent-strong:var\(--ds-primary-hover\)/);
  assert.match(hoTheme, /--bo-color-focus:var\(--ds-primary-border\)/);
  assert.equal(missionUuid.test(id), true);
  const page = readFileSync("app/ho/learning/missions/page.tsx", "utf8");
  const ui = readFileSync("app/ho/learning/missions/HoMissionsTdd.tsx", "utf8");
  assert.match(page, /HoMissionsTdd/);
  assert.match(ui, /SurfaceWorkspace/);
  assert.match(ui, /createHoTddAdapter/);
  assert.doesNotMatch(ui, /localStorage|<table\b|MissionCatalogView/);
  assert.equal(decideHostBoundary("ho.staging.pinohouse.art", "/ho/learning/missions").action, "next");
  assert.equal(decideHostBoundary("bo.staging.pinohouse.art", "/ho/learning/missions").action, "not_found");
});
test("PAP-1207: only valid source MissionDefinition projected, never arbitrary metadata", () => {
  const projected = projectMission({ ...row, secret: "NEVER" });
  assert.equal(projected.path, "—");
  assert.equal(projected.createdAt, "—");
  assert.equal(projected.createdBy, "—");
  assert.equal(projected.updatedAt, "—");
  assert.equal(projected.updatedBy, "—");
  assert.equal(Object.hasOwn(projected, "secret"), false);
  assert.equal(projected.name, row.name);
  for (const patch of [{ id: "bad" }, { status: "COMPLETED" }, { name: "" }, { code: "" },
    { level: 6 }, { level: 0 }, { level: null }, { plsValue: -1 }, { paperSize: "A1" }]) {
    assert.throws(() => projectMission({ ...row, ...patch }), BoApiError);
  }
});
test("PAP-1207: paginated real HO catalog and exact scoped GET detail with fail-closed errors", async () => {
  const paths: string[] = [];
  const f: typeof fetch = async input => {
    const url = String(input); paths.push(url);
    if (url === "/api/ho/learning/paths") return Response.json({ data: [
      { id: "01900000-0000-7000-8000-000000000011", code: "artchitect", displayName: "Artchitect", status: "ACTIVE" },
      { id: "01900000-0000-7000-8000-000000000012", code: "pianohouse", displayName: "PianoHouse", status: "ACTIVE" },
      { id: "01900000-0000-7000-8000-000000000013", code: "little-piner-art", displayName: "Little Piner Art", status: "ACTIVE" },
      { id: "01900000-0000-7000-8000-000000000014", code: "little-piner-piano", displayName: "Little Piner Piano", status: "ACTIVE" },
    ] });
    if (url.includes("/" + id)) return Response.json({ data: row });
    return Response.json({ data: [row] });
  };
  const list = await missionProvider.list(missionQuery, { surface: "HO" }, f, signal());
  assert.equal(list.total, 1);
  assert.equal(list.records[0]?.row.name, row.name);
  assert.match(paths[0]!, /\/api\/bo\/learning\/missions\?limit=50&offset=0/);
  assert.equal((await missionProvider.detail(id, { surface: "HO" }, f, signal()))?.row.id, id);
  assert.equal(paths[1], "/api/ho/learning/paths");
  assert.equal(paths[2], "/api/bo/learning/missions/" + id);
  assert.equal(paths[3], "/api/ho/learning/paths");
  await assert.rejects(missionProvider.list(missionQuery, { surface: "BO", centerId: id }, f, signal()), BoApiError);
  await assert.rejects(missionProvider.detail(id, { surface: "BO", centerId: id }, f, signal()), BoApiError);
  await assert.rejects(missionProvider.detail("bad", { surface: "HO" }, f, signal()), BoApiError);
  assert.equal(await missionProvider.detail(id, { surface: "HO" }, async () => Response.json({ error: {} }, { status: 404 }), signal()), null);
  await assert.rejects(missionProvider.detail(id, { surface: "HO" }, async () => Response.json({ data: { ...row, id: "01900000-0000-7000-8000-000000000005" } }), signal()), BoApiError);
  await assert.rejects(missionProvider.list(missionQuery, { surface: "HO" }, async () => Response.json({ data: [{ ...row, id: "bad" }] }), signal()), BoApiError);
  await assert.rejects(missionProvider.list(missionQuery, { surface: "HO" }, async () => Response.json({ data: [{ ...row, plsValue: undefined }] }), signal()), BoApiError);
  await assert.rejects(missionProvider.detail(id, { surface: "HO" }, async () => Response.json({ data: { ...row, paperSize: undefined } }), signal()), BoApiError);
  await assert.rejects(missionProvider.list(missionQuery, { surface: "HO" }, async () => Response.json({ data: [row, row] }), signal()), BoApiError);
  await assert.rejects(missionProvider.list(missionQuery, { surface: "HO" }, async () => Response.json({ error: "denied" }, { status: 403 }), signal()));
});

test("PAP-1207 S3 Founder G0 primary Table is exactly ten ordered fields, with no technical or paper-size column", () => {
  const keys = ["name","code","level","status","plsValue","path","createdAt","createdBy","updatedAt","updatedBy"];
  assert.deepEqual(missionTableColumnKeys, keys);
  assert.deepEqual(missionQuery.visible, keys);
  assert.deepEqual(missionQuery.order, keys);
  assert.deepEqual(missionDefinition.table.columns.map(x => x.field), keys);
  assert.ok(missionDefinition.table.columns.every(x => x.visible));
  for (const x of ["paperSize", "prerequisite", "description", "guideline", "id"])
    assert.ok(!missionDefinition.table.columns.some(c => c.field === x), x);
  assert.deepEqual(missionDefinition.table.search.fields, ["name", "code", "path"]);
  assert.deepEqual(missionDefinition.table.filters.fields, ["status", "level", "path"]);
  assert.equal(missionDefinition.capabilities.read, "catalog.learning.view");
});
test("PAP-1207 S3 reads authentic Vietnam-local Core timestamps and no guessed actor identities", () => {
  assert.equal(formatMissionAuditTime("2026-08-25T17:00:00.000Z"), "26/08/2026 · 00:00");
  assert.equal(formatMissionAuditTime("2026-08-26T00:00:00+07:00"), "26/08/2026 · 00:00");
  assert.equal(formatMissionAuditTime(""), "—");
  assert.equal(formatMissionAuditTime("unverified"), "—");
  assert.equal(formatMissionAuditTime(null), "—");
  assert.equal(missionVerifiedActorName(null), "—");
  assert.equal(missionVerifiedActorName("somebody@pinohouse.art"), "—");
  assert.equal(missionVerifiedActorName("01900000-0000-7000-8000-000000000011"), "—");
  assert.equal(missionVerifiedActorName("  Nguyễn Văn An  "), "Nguyễn Văn An");
  const value = projectMission({ ...row, createdAt:"2026-08-25T17:00:00Z", updatedAt:"2026-08-26T00:00:00Z",
    createdBy: "email.user@pinohouse.art", updatedBy: "01900000-0000-7000-8000-000000000011",
    createdByVerifiedLegalName: null, updatedByVerifiedLegalName: null });
  assert.equal(value.createdAt, "26/08/2026 · 00:00");
  assert.equal(value.updatedAt, "26/08/2026 · 07:00");
  assert.equal(value.createdBy, "—");
  assert.equal(value.updatedBy, "—");
});
test("PAP-1207 S3 Path labels require matching authorized Core Path ID and snapshot", () => {
  const options = [{id:"01900000-0000-7000-8000-000000000011",code:"artchitect",label:"Artchitect"}] as const;
  const full = projectMission({...row, pathProgramId:options[0].id,pathKeySnapshot:options[0].code},options);
  assert.equal(full.path,"Artchitect");
  assert.equal(projectMission({...row,pathProgramId:options[0].id,pathKeySnapshot:"pianohouse"},options).path,"—");
  assert.equal(projectMission({...row,pathProgramId:"01900000-0000-7000-8000-000000000012",pathKeySnapshot:options[0].code},options).path,"—");
});
test("PAP-1221/PAP-1207 MISSION S3 HO TDD session admits ONLY canonical Path GET", async () => {
  const origin = "https://ho.staging.pinohouse.art";
  const calls: string[] = [];
  const fetcher: typeof fetch = async input => {
    calls.push(String(input));
    return Response.json({ data: { paths: [] } });
  };
  const session = surfaceSession("HO", origin, fetcher);
  assert.equal((await session.transport("/api/ho/learning/paths")).status, 200);
  assert.deepEqual(calls, [origin + "/api/ho/learning/paths"]);
  for (const route of [
    "/api/ho/learning/paths?limit=1",
    "/api/ho/learning/paths/",
    "/api/ho/learning/paths/other",
    "/api/ho/learning/mission-paths",
    "https://bo.staging.pinohouse.art/api/ho/learning/paths",
  ]) await assert.rejects(session.transport(route), { status: 404 });
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    await assert.rejects(session.transport("/api/ho/learning/paths", { method }), { status: 404 });
  }
  assert.deepEqual(calls, [origin + "/api/ho/learning/paths"]);
  session.dispose();
});