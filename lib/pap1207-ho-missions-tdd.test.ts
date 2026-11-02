import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { composeTabs, validateModule } from "./workspace-schema";
import { BoApiError } from "./bo-api-error";
import { decideHostBoundary } from "./host-boundary";
import { missionDefinition, missionProvider, missionQuery, missionSchema, projectMission, missionUuid } from "../app/ho/learning/missions/schema";

const id = "01900000-0000-7000-8000-000000000002";
const row = { id, name: "Mori water", code: "MORI-1", status: "ACTIVE", level: 3,
  plsValue: 30, paperSize: "A4", path: "ART", prerequisite: null,
  description: "Color", guideline: "Observe first" };
const signal = () => new AbortController().signal;
test("PAP-1207: registered HO TDD module with truthful read-only lifecycle", () => {
  validateModule(missionSchema);
  assert.equal(missionSchema.key, "missions");
  assert.equal(missionDefinition.surface, "HO");
  assert.equal(missionDefinition.capabilities.read, "catalog.learning.view");
  assert.equal(missionProvider.mutation, undefined);
  assert.equal(missionDefinition.drawer.density, "one-column");
  assert.deepEqual(composeTabs(missionSchema).map(t => t.id), ["overview", "history"]);
  assert.equal(missionDefinition.detail.history.kind, "unavailable");
  assert.match(readFileSync("app/ho/learning/missions/HoMissionsTdd.tsx", "utf8"), /chưa khả dụng/);
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
  assert.deepEqual(projectMission({ ...row, secret: "NEVER" }), row);
  for (const patch of [{ id: "bad" }, { status: "COMPLETED" }, { name: "" }, { code: "" },
    { level: 6 }, { level: 0 }, { level: null }, { plsValue: -1 }, { paperSize: "A1" }]) {
    assert.throws(() => projectMission({ ...row, ...patch }), BoApiError);
  }
});
test("PAP-1207: paginated real HO catalog and exact scoped GET detail with fail-closed errors", async () => {
  const paths: string[] = [];
  const f: typeof fetch = async input => {
    const url = String(input); paths.push(url);
    if (url.includes("/" + id)) return Response.json({ data: row });
    return Response.json({ data: paths.length === 1 ? [row] : [] });
  };
  const list = await missionProvider.list(missionQuery, { surface: "HO" }, f, signal());
  assert.equal(list.total, 1);
  assert.equal(list.records[0]?.row.name, row.name);
  assert.match(paths[0]!, /\/api\/bo\/learning\/missions\?limit=50&offset=0/);
  assert.equal((await missionProvider.detail(id, { surface: "HO" }, f, signal()))?.row.id, id);
  assert.equal(paths[1], "/api/bo/learning/missions/" + id);
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
