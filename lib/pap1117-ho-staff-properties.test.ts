import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { staffRoleEditorModel, replaceStaffRole } from "./ho-staff-role-editor";
import type { BoAccessSystemUser } from "./bo-access-model";
import type { BoAccessRole } from "./bo-model";
import { StaffRoleAccess } from "../app/ho/staff/StaffRoleAccess";
import { staffFields, staffSchema } from "../app/ho/staff/schema";
const assignment = { assignmentId: "old-assignment", roleId: "old-role", roleName: "Reception", roleKey: "reception", scopeType: "CENTER", scopeId: "center-a" } as BoAccessSystemUser["assignments"][number];
const user = { id: "other-user", status: "active", assignments: [assignment] } as BoAccessSystemUser;
const roles = [{ id: "next-role", roleKey: "teacher", displayName: "Teacher", status: "active" }, { id: "founder", roleKey: "founder", status: "active" }, { id: "archived", roleKey: "reception", status: "archived" }] as BoAccessRole[];
test("PAP-1117 role editor keeps self, Founder, inactive, ambiguous and multiple assignments read-only", () => {
  const model = (u = user, active = true, principal = "actor", ambiguous = false) => staffRoleEditorModel(u, roles, active, principal, ambiguous);
  assert.equal(model().editable, true);
  assert.deepEqual(model().roles.map(role => role.id), ["next-role"]);
  for (const denied of [model(user, false), model(user, true, user.id), model(user, true, "actor", true), model({ ...user, status: "suspended" }), model({ ...user, assignments: [] }), model({ ...user, assignments: [assignment, assignment] }), model({ ...user, assignments: [{ ...assignment, roleKey: "founder" }] })]) assert.equal(denied.editable, false);
  assert.equal(staffRoleEditorModel(null, roles, true, "actor", false).editable, false);
});
test("PAP-1117 replacement preserves scope, command order and distinct idempotency keys", async () => {
  const requests: RequestInit[] = [];
  await replaceStaffRole("staff-a", assignment, "next-role", (async (url, options) => {
    assert.equal(url, "/api/ho/staff/staff-a/role"); requests.push(options!); return new Response("{}", { status: 200 });
  }) as typeof fetch);
  assert.deepEqual(requests.map(request => JSON.parse(String(request.body))), [{ action: "assign", roleId: "next-role", scopeType: "CENTER", scopeId: "center-a" }, { action: "remove", assignmentId: "old-assignment" }]);
  assert.notEqual((requests[0].headers as Record<string, string>)["idempotency-key"], (requests[1].headers as Record<string, string>)["idempotency-key"]);
});
test("PAP-1117 denied assignment stops before removal; failed removal reports partial success", async () => {
  let calls = 0;
  await assert.rejects(replaceStaffRole("staff", assignment, "next", (async () => { calls++; return new Response(null, { status: 403 }); }) as typeof fetch), /Không có quyền/);
  assert.equal(calls, 1); calls = 0;
  await assert.rejects(replaceStaffRole("staff", assignment, "next", (async () => new Response(null, { status: ++calls === 1 ? 200 : 500 })) as typeof fetch), /Đã gán vai trò mới nhưng chưa gỡ/);
  assert.equal(calls, 2);
});
test("PAP-1117 Staff overview renders one shared section with name/status/role and no always-visible select", () => {
  const properties = { fields: staffFields.map(field => ({ ...field, w: field.width })), record: { id: "staff", name: "An", status: "Đang làm", role: "Reception" }, sections: staffSchema.detail.overview.sections };
  const markup = renderToStaticMarkup(h(StaffRoleAccess, { staffId: "staff", active: true, principalId: "actor", properties }));
  assert.equal((markup.match(/class="pds-property-section"/g) ?? []).length, 1);
  assert.deepEqual([...markup.matchAll(/data-pds-field="([^"]+)"/g)].map(match => match[1]), ["name", "status", "role"]);
  assert.doesNotMatch(markup, /<select|v24-prop-row|Sửa Vai trò/);
  assert.match(markup, /Đang tải…/);
});
