import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defineTddModule, authorizedHostActions, type AuthorizationContext } from "./workspace-schema";
import { missionSchema } from "../app/ho/learning/missions/schema";
import { emptyMission, validateMissionCreate } from "../app/ho/learning/missions/MissionCreateFields";

test("PAP-1207: Create Mission is declared only in canonical engine slots", () => {
  defineTddModule(missionSchema);
  assert.equal(missionSchema.capabilities.create, "learning.mission.manage");
  assert.deepEqual(missionSchema.actions?.map(a => [a.id, a.slot, a.formMode]), [
    ["mission-open-create", "table.header", undefined],
    ["mission-cancel-create", "drawer.footer", "create"],
    ["mission-save-create", "drawer.footer", "create"],
  ]);
  const authorized: AuthorizationContext = { surface: "HO", authorize: () => true };
  const denied: AuthorizationContext = { surface: "HO", authorize: permission => permission !== "learning.mission.manage" };
  const handlers = { openCreate: { run: () => undefined }, cancelCreate: { run: () => undefined }, saveCreate: { kind: "mutation" as const, run: () => ({ state: "unverified" as const }) } };
  assert.deepEqual(authorizedHostActions(missionSchema, authorized, "table.header", handlers).map(a => a.id), ["mission-open-create"]);
  assert.deepEqual(authorizedHostActions(missionSchema, authorized, "drawer.footer", handlers, undefined, "create").map(a => a.id), ["mission-cancel-create", "mission-save-create"]);
  assert.deepEqual(authorizedHostActions(missionSchema, denied, "table.header", handlers), []);
  assert.deepEqual(authorizedHostActions(missionSchema, denied, "drawer.footer", handlers, undefined, "create"), []);
});
test("PAP-1207: missing, invalid and unsafe Create fields never submit", () => {
  assert.match(validateMissionCreate(emptyMission) ?? "", /Mã/);
  assert.equal(validateMissionCreate({ ...emptyMission, code: "MORI-1", name: "Mori" }), null);
  for (const patch of [{ level: 6 }, { level: 0 }, { plsValue: -1 }, { plsValue: 1.5 }, { pathProgramId: "broken" },
    { prerequisiteMissionId: "broken" }, { name: "x".repeat(161) }, { code: "!" }]) {
    assert.notEqual(validateMissionCreate({ ...emptyMission, code: "MORI-1", name: "Mori", ...patch }), null);
  }
});
test("PAP-1207: UI invokes Core readback client and uses engine-only Save/Cancel", () => {
  const source = readFileSync("app/ho/learning/missions/HoMissionsTdd.tsx", "utf8");
  assert.match(source, /submitHoMission/);
  assert.match(source, /kind: "form"/);
  assert.match(source, /actionBindings=\{actions\}/);
  assert.match(source, /result\.state === "verified"/);
  assert.match(source, /result\.state === "unverified"/);
  assert.match(source, /setUncertain\(true\)/);
  assert.doesNotMatch(source, /<TosButton|<button[^>]*Tạo|<button[^>]*Lưu/);
});