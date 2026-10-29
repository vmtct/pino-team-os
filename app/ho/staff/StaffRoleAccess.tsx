"use client";
import { useEffect, useState } from "react";
import { boApi } from "@/lib/bo-api";
import type { BoAccessSystemUser } from "@/lib/bo-access-model";
import type { BoAccessRole } from "@/lib/bo-model";

type State = { kind: "loading" } | { kind: "error" } |
  { kind: "ready"; user: BoAccessSystemUser | null; roles: BoAccessRole[]; ambiguous: boolean };
export function resolveStaffRoleAccount(rows: BoAccessSystemUser[], staffId: string) {
  const matches = rows.filter(user => user.staffMemberId === staffId);
  return { user: matches.length === 1 ? matches[0]! : null, ambiguous: matches.length > 1 };
}
export function StaffRoleAccess({ staffId, active, principalId }: {
  staffId: string; active: boolean; principalId: string;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load(isCurrent: () => boolean) {
    const [users, roles] = await Promise.all([boApi.accessUsers(), boApi.accessRoles()]);
    if (!isCurrent()) return;
    const link = resolveStaffRoleAccount(users, staffId);
    setState({ kind: "ready", ...link, roles });
    setSelected(link.user?.assignments.length === 1 ? link.user.assignments[0]!.roleId : "");
  }
  useEffect(() => {
    let current = true;
    if (active) void Promise.all([boApi.accessUsers(), boApi.accessRoles()])
      .then(([users, roles]) => {
        if (!current) return;
        const link = resolveStaffRoleAccount(users, staffId);
        setState({ kind: "ready", ...link, roles });
        setSelected(link.user?.assignments.length === 1 ? link.user.assignments[0]!.roleId : "");
      })
      .catch(() => { if (current) setState({ kind: "error" }); });
    return () => { current = false; };
  }, [staffId, active]);
  const user = state.kind === "ready" ? state.user : null;
  const assignment = user?.assignments.length === 1 ? user.assignments[0]! : null;
  const self = Boolean(user && user.id === principalId);
  const canEdit = Boolean(active && user?.status === "active" && !self &&
    assignment && assignment.roleKey !== "founder" && state.kind === "ready" && !state.ambiguous);
  const roles = state.kind === "ready" ? state.roles.filter(role =>
    role.status === "active" && role.roleKey !== "founder") : [];
  async function mutate(action: "assign" | "remove", roleId: string, assignmentId?: string) {
    const body = action === "assign"
      ? { action, roleId, scopeType: assignment!.scopeType, scopeId: assignment!.scopeId }
      : { action, assignmentId };
    const response = await fetch(`/api/ho/staff/${encodeURIComponent(staffId)}/role`, {
      method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw Error(response.status === 403 ? "Không có quyền sửa vai trò." : "Không lưu được vai trò.");
  }
  async function save() {
    if (!canEdit || !assignment || !selected || selected === assignment.roleId || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      // Preserve existing scope; never widen privileges to GLOBAL implicitly.
      await mutate("assign", selected);
      try {
        await mutate("remove", selected, assignment.assignmentId);
      } catch {
        setError("Đã gán vai trò mới nhưng chưa gỡ được vai trò cũ. Cần kiểm tra ACL.");
        await load(() => true);
        return;
      }
      await load(() => true);
      setNotice("Đã lưu.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được.");
      await load(() => true).catch(() => setState({ kind: "error" }));
    } finally { setBusy(false); }
  }
  return <section className="v24-prop-section" aria-label="Vai trò Access" data-testid="ho-staff-role-acl">
    <div className="v24-prop-row">
      <label htmlFor="ho-staff-role-select">Vai trò</label>
      {state.kind === "loading" ? <span>Đang tải…</span> :
        state.kind === "error" ? <span role="alert">Không tải được vai trò.</span> :
        !user ? <span>—</span> :
        <><select id="ho-staff-role-select" data-testid="ho-staff-role-select"
          value={selected} disabled={!canEdit || busy} onChange={event => setSelected(event.target.value)}>
          {user.assignments.length !== 1 ? <option value="">Nhiều vai trò</option> : null}
          {assignment && !roles.some(r => r.id === assignment.roleId)
            ? <option value={assignment.roleId}>{assignment.roleName}</option> : null}
          {roles.map(role => <option key={role.id} value={role.id}>{role.displayName}</option>)}
        </select>
        {canEdit && selected !== assignment?.roleId ?
          <button type="button" className="secondary-btn" disabled={busy || !selected}
            onClick={() => void save()}>{busy ? "Đang lưu…" : "Lưu"}</button> : null}</>}
    </div>
    {notice ? <span role="status">{notice}</span> : null}
    {error ? <span role="alert">{error}</span> : null}
  </section>;
}
