"use client";
import { useEffect, useRef, useState } from "react";
import { PropertySections, type PropertyCommitResult, type PropertyField, type PropertyValue } from "@pino/design-system/react";
import { boApi } from "@/lib/bo-api";
import type { BoAccessSystemUser } from "@/lib/bo-access-model";
import type { BoAccessRole } from "@/lib/bo-model";
import { replaceStaffRole, resolveStaffRoleAccount, staffRoleEditorModel } from "@/lib/ho-staff-role-editor";
import type { OverviewProperties } from "@/app/components/workspace-renderer/Properties";
export { resolveStaffRoleAccount } from "@/lib/ho-staff-role-editor";

type State = { kind: "loading" } | { kind: "error" } |
  { kind: "ready"; user: BoAccessSystemUser | null; roles: BoAccessRole[]; ambiguous: boolean };
export function StaffRoleAccess({ staffId, active, principalId, properties }: {
  staffId: string; active: boolean; principalId: string; properties: OverviewProperties;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busy = useRef(false);
  const alive = useRef(false);
  const hasRole = properties.sections.some(section => section.fields.includes("role"));
  async function readState(): Promise<Extract<State, { kind: "ready" }>> {
    const [users, roles] = await Promise.all([boApi.accessUsers(), boApi.accessRoles()]);
    return { kind: "ready", ...resolveStaffRoleAccount(users, staffId), roles };
  }
  useEffect(() => {
    alive.current = true;
    let current = true;
    if (active && hasRole) void Promise.all([boApi.accessUsers(), boApi.accessRoles()])
      .then(([users, roles]) => { if (current) setState({ kind: "ready", ...resolveStaffRoleAccount(users, staffId), roles }); })
      .catch(() => { if (current) setState({ kind: "error" }); });
    return () => { current = false; alive.current = false; };
  }, [staffId, active, hasRole]);
  const model = staffRoleEditorModel(state.kind === "ready" ? state.user : null, state.kind === "ready" ? state.roles : [], active, principalId, state.kind !== "ready" || state.ambiguous);
  const canEdit = hasRole && model.editable;
  const options = model.roles.map(role => ({ value: role.id, label: role.displayName }));
  if (model.assignment && !options.some(option => option.value === model.assignment!.roleId)) options.unshift({ value: model.assignment.roleId, label: model.assignment.roleName });
  const fields: PropertyField[] = properties.fields.map(field => field.key === "role"
    ? { key: field.key, label: field.label, icon: field.icon, type: "select", required: true, readOnly: !canEdit, options }
    : { key: field.key, label: field.label, icon: field.icon, type: "text", readOnly: true });
  const role = !active ? String(properties.record.role ?? "—") : state.kind === "loading" ? "Đang tải…" : state.kind === "error" ? "Không tải được vai trò." : state.ambiguous ? "Không xác định được tài khoản." : !state.user ? "—" : model.assignment?.roleId ?? "Nhiều vai trò";
  const values = Object.fromEntries(fields.map(field => [field.key, field.key === "role" ? role : properties.record[field.key] as PropertyValue]));
  async function commit(key: string, value: PropertyValue, { signal }: { signal: AbortSignal }): Promise<PropertyCommitResult> {
    if (key !== "role" || !canEdit || !model.assignment || typeof value !== "string" || !model.roles.some(role => role.id === value) || busy.current || signal.aborted) return { status: "denied" };
    if (value === model.assignment.roleId) return { status: "saved", value };
    busy.current = true;
    setError(""); setNotice("");
    try {
      // Once started, finish both commands even if the editor closes; never widen scope.
      await replaceStaffRole(staffId, model.assignment, value);
      const next = await readState();
      if (alive.current) setState(next);
      if (next.ambiguous || next.user?.assignments.length !== 1 || next.user.assignments[0]?.roleId !== value) throw Error("Vai trò đã thay đổi. Cần kiểm tra ACL.");
      return { status: "saved", value };
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : "Không lưu được vai trò.");
      try { const next = await readState(); if (alive.current) setState(next); }
      catch { if (alive.current) setState({ kind: "error" }); }
      return { status: "error" };
    } finally { busy.current = false; }
  }
  return <div data-testid="ho-staff-role-acl">
    <PropertySections recordKey={staffId} fields={fields} values={values} sections={properties.sections} variant="detail" surface="ho"
      canEdit={key => key === "role" && canEdit} onCommit={commit} onSaved={() => setNotice("Đã lưu.")} editorLabel="Sửa vai trò" />
    {notice ? <p role="status">{notice}</p> : null}
    {error || state.kind === "error" ? <p role="alert">{error || "Không tải được vai trò."}</p> : null}
  </div>;
}
