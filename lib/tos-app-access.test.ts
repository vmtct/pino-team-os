import assert from "node:assert/strict";
import test from "node:test";
import { resolveTosAppAccess } from "./tos-app-access";
import type { Assignment } from "./workforce-api";

const base: Assignment = {
  id: "a", centerId: "c1", workDate: "2026-10-18", shiftTemplateId: "s",
  timeBasis: "SHIFT_TEMPLATE", coverageMode: "FULL_SHIFT", effectiveStartLocal: null,
  effectiveEndLocal: null, termWeekId: null, status: "ACTIVE", shift: null,
};
const resolve = (assignments: Assignment[], opts: Partial<Parameters<typeof resolveTosAppAccess>[0]> = {}) =>
  resolveTosAppAccess({ assignments, centerId: "c1", today: "2026-10-18", desktop: false, scheduleReady: true, ...opts });
test("PAP-702 defaults fail closed when role evidence absent or schedule fails", () => {
  for (const a of [[], [{...base}], [{...base, roleAssignments: []}]]) {
    assert.deepEqual(resolve(a), {shift:true,reception:false,station:false,"shift-lead":false,classroom:false});
  }
  assert.equal(resolve([{...base,roleAssignments:[{roleType:"FRONT_DESK",targetType:"CENTER",targetId:"c1"}]}],{scheduleReady:false}).reception,false);
});
test("PAP-702 requires center/day ACTIVE assignment and matching role target", () => {
  const role = {roleType:"FRONT_DESK" as const,targetType:"CENTER" as const,targetId:"c1"};
  for (const patch of [{centerId:"c2"},{workDate:"2026-10-19"},{status:"CANCELLED"},{roleAssignments:[{...role,targetId:"c2"}]}]) {
    assert.equal(resolve([{...base,roleAssignments:[role],...patch}]).reception,false);
  }
});
test("PAP-702 derives independent role facts across multiple assignments", () => {
  const rows = [
    {...base,roleAssignments:[{roleType:"FRONT_DESK" as const,targetType:"CENTER" as const,targetId:"c1"}]},
    {...base,id:"b",roleAssignments:[{roleType:"TEACHER" as const,targetType:"SESSION" as const,targetId:"session-1"},{roleType:"SHIFT_LEADER" as const,targetType:"CENTER" as const,targetId:"c1"}]},
  ];
  assert.deepEqual(resolve(rows,{desktop:true}),{shift:true,reception:true,station:true,"shift-lead":true,classroom:true});
});
test("PAP-702 rejects wrong target scope and ignores profile roles", () => {
  const roles = [{roleType:"TEACHER" as const,targetType:"CENTER" as const,targetId:"c1"},
    {roleType:"SHIFT_LEADER" as const,targetType:"SESSION" as const,targetId:"session-1"}];
  assert.equal(resolve([{...base,roleAssignments:roles}]).classroom,false);
  assert.equal(resolve([{...base,roleAssignments:roles}])["shift-lead"],false);
});
