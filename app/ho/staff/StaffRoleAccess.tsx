"use client";
import { useEffect, useRef, useState } from "react";
import { PropertySections, TosButton, type PropertyCommitResult, type PropertyField, type PropertyValue } from "@pino/design-system/react";
import { boApi } from "@/lib/bo-api";
import type { BoAccessSystemUser } from "@/lib/bo-access-model";
import type { BoAccessRole } from "@/lib/bo-model";
import { replaceStaffRole, resolveStaffRoleAccount, staffRoleEditorModel } from "@/lib/ho-staff-role-editor";
import type { OverviewProperties } from "@/app/components/workspace-renderer/Properties";
import { planTvQaGrant, verifyTvQaReadback, writeTvQaStaffCommand, TV_QA_CENTER_ID, TV_QA_STAFF_ID, TV_QA_USER_ID, TV_QA_ROLE_KEY } from "@/lib/ho-staff-role-editor";
export { resolveStaffRoleAccount } from "@/lib/ho-staff-role-editor";

type State = { kind: "loading" } | { kind: "error" } |
  { kind: "ready"; user: BoAccessSystemUser | null; roles: BoAccessRole[]; ambiguous: boolean };
export function StaffRoleAccess({ staffId, active, principalId, properties }: {
  staffId: string; active: boolean; principalId: string; properties: OverviewProperties;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [qaHost, setQaHost] = useState(false);
  const [qaBusy, setQaBusy] = useState(false);
  useEffect(() => { setQaHost(window.location.hostname === "ho.staging.pinohouse.art"); }, []);
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
  const qaUser = state.kind === "ready" ? state.user : null;
  const qaRoleList = state.kind === "ready" ? state.roles : [];
  const qaVisible = qaHost && active && staffId === TV_QA_STAFF_ID &&
    qaUser?.id === TV_QA_USER_ID && qaUser.status === "active" && principalId !== TV_QA_USER_ID;
  const qaPlan = qaVisible ? planTvQaGrant(qaUser, qaRoleList) : null;
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
  async function grantTvQaRole() {
    if (!qaVisible || !qaPlan || qaPlan.kind !== "ready" || busy.current || qaBusy) return;
    busy.current = true; setQaBusy(true); setError(""); setNotice("");
    let removedExpired = false;
    try {
      // Role identity and permission membership must match the existing Staging QA-only role.
      const role = await boApi.accessRole(qaPlan.roleId);
      if (role.roleKey !== TV_QA_ROLE_KEY || role.status !== "active" ||
        role.permissionKeys.length !== 1 || role.permissionKeys[0] !== "tv.launch")
        throw Error("Role QA TV không còn đúng một quyền tv.launch.");
      const latest = await readState();
      const fresh = planTvQaGrant(latest.user, latest.roles);
      if (fresh.kind !== "ready" || fresh.roleId !== qaPlan.roleId ||
        fresh.expiredAssignmentId !== qaPlan.expiredAssignmentId)
        throw Error("Assignment đã thay đổi; cần đọc lại quyền trước khi tiếp tục.");
      if (fresh.expiredAssignmentId) {
        // Core's unique index counts expired-but-active assignments; retire only that exact QA row.
        await writeTvQaStaffCommand(staffId, { action: "remove", assignmentId: fresh.expiredAssignmentId });
        removedExpired = true;
        const withoutOld = await readState();
        if (withoutOld.user?.assignments.some(a => a.assignmentId === fresh.expiredAssignmentId))
          throw Error("Không xác minh được thu hồi assignment QA đã hết hạn.");
      }
      // Additive only: preserve all other Staff assignments and omit effectiveUntil by Founder decision.
      await writeTvQaStaffCommand(staffId, {
        action: "assign", roleId: fresh.roleId, scopeType: "CENTER", scopeId: TV_QA_CENTER_ID,
      });
      const verified = await readState();
      if (alive.current) setState(verified);
      if (!verifyTvQaReadback(verified.user, fresh.otherAssignmentIds, fresh.roleId))
        throw Error("Core readback không xác nhận đúng phạm vi QA hoặc các role Staff cũ.");
      if (alive.current) setNotice("Đã cấp quyền trình chiếu TV QA cho Center Cần Thơ, không tự hết hạn.");
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "Không cấp được quyền QA TV.";
      if (alive.current) setError(removedExpired
        ? "Quyền QA cũ đã được gỡ; bước cấp mới chưa được xác minh. Không tự retry. " + detail
        : detail);
      try { const refreshed = await readState(); if (alive.current) setState(refreshed); }
      catch { if (alive.current) setState({ kind: "error" }); }
    } finally { busy.current = false; setQaBusy(false); }
  }
  return <div data-testid="ho-staff-role-acl">
    <PropertySections recordKey={staffId} fields={fields} values={values} sections={properties.sections} variant="detail" surface="ho"
      canEdit={key => key === "role" && canEdit} onCommit={commit} onSaved={() => setNotice("Đã lưu.")} editorLabel="Sửa vai trò" />
    {qaVisible && qaPlan ? <section aria-label="QA TV Staging Cần Thơ" data-pap1345-qa-grant="true">
      <p>QA TV · Center Cần Thơ · Staging only. Quyền không tự hết hạn; thu hồi thủ công sau QA.</p>
      {qaPlan.kind === "already"
        ? <p role="status">Quyền TV QA đang có hiệu lực.</p>
        : qaPlan.kind === "ready"
          ? <TosButton type="button" variant="secondary" disabled={qaBusy || busy.current}
              onClick={() => void grantTvQaRole()}>{qaBusy ? "Đang xác minh quyền…" : "Bổ sung quyền TV QA"}</TosButton>
          : <p role="alert">Không thể gán quyền QA: {qaPlan.reason}</p>}
    </section> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {error || state.kind === "error" ? <p role="alert">{error || "Không tải được vai trò."}</p> : null}
  </div>;
}
