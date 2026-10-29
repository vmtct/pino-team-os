"use client";
import { useEffect, useState } from "react";
import { boApi } from "@/lib/bo-api";
import type { BoAccessSystemUser } from "@/lib/bo-access-model";
import type { BoAccessRole } from "@/lib/bo-model";

type ScopeType = "GLOBAL" | "CENTER" | "PATH" | "RUNNING_CLASS";
type State = { kind: "loading" } | { kind: "error"; message: string } |
  { kind: "ready"; user: BoAccessSystemUser | null; roles: BoAccessRole[]; ambiguous: boolean };
export function resolveStaffRoleAccount(rows: BoAccessSystemUser[], staffId: string) {
  const matches = rows.filter(user => user.staffMemberId === staffId);
  return { user: matches.length === 1 ? matches[0]! : null, ambiguous: matches.length > 1 };
}
export function StaffRoleAccess({ staffId, active, principalId }: {
  staffId: string; active: boolean; principalId: string;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [roleId, setRoleId] = useState("");
  const [scopeType, setScopeType] = useState<ScopeType>("GLOBAL");
  const [scopeId, setScopeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let current = true;
    setState({ kind: "loading" }); setRoleId(""); setScopeType("GLOBAL"); setScopeId("");
    setError(""); setNotice("");
    if (!active) return () => { current = false; };
    void Promise.all([boApi.accessUsers(), boApi.accessRoles()]).then(([users, roles]) => {
      if (!current) return;
      const link = resolveStaffRoleAccount(users, staffId);
      setState({ kind: "ready", ...link, roles });
    }).catch(() => { if (current) setState({ kind: "error", message: "Không tải được Access và Role." }); });
    return () => { current = false; };
  }, [staffId, active]);
  async function refresh() {
    const [users, roles] = await Promise.all([boApi.accessUsers(), boApi.accessRoles()]);
    setState({ kind: "ready", ...resolveStaffRoleAccount(users, staffId), roles });
  }
  async function write(command: { action: "assign"; roleId: string; scopeType: ScopeType; scopeId: string | null } |
      { action: "remove"; assignmentId: string }) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await fetch(`/api/ho/staff/${encodeURIComponent(staffId)}/role`, {
        method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify(command),
      });
      if (!result.ok) throw Error(result.status === 403 ? "Không được phép thay đổi role này." :
        result.status === 409 ? "Role/Access đã thay đổi. Tải lại rồi thử." :
        "Core chưa xác nhận cập nhật ACL. Kiểm tra trước khi thử lại.");
      await refresh();
      setRoleId(""); setNotice("Đã cập nhật Role trong Access.");
    } catch (e) { setError(e instanceof Error ? e.message : "Không cập nhật được ACL."); }
    finally { setBusy(false); }
  }
  const user = state.kind === "ready" ? state.user : null;
  const assignable = state.kind === "ready" ? state.roles.filter(r => r.status === "active" && r.roleKey !== "founder") : [];
  const self = Boolean(user && user.id === principalId);
  const selected = assignable.find(role => role.id === roleId);
  const duplicate = Boolean(user?.assignments.some(a =>
    a.roleId === roleId && a.scopeType === scopeType && a.scopeId === (scopeType === "GLOBAL" ? null : scopeId.trim())));
  const scopedId = scopeType === "GLOBAL" ? null : scopeId.trim();
  const canAssign = Boolean(user && !self && user.status === "active" && selected && !duplicate &&
    (scopeType === "GLOBAL" || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scopedId || "")));
  return <section className="v24-prop-section" aria-label="Phân quyền Access" data-testid="ho-staff-role-acl">
    <h3>Phân quyền · ACL</h3>
    <p>Role được gán cho tài khoản Access liên kết Staff. Quyền và scope do Core kiểm soát.</p>
    {!active ? <p role="status">Staff chưa hoạt động.</p> :
      state.kind === "loading" ? <p role="status">Đang tải quyền Access…</p> :
      state.kind === "error" ? <p role="alert">{state.message}</p> :
      state.ambiguous ? <p role="alert">Liên kết Access bị trùng. Không thể chỉnh role.</p> :
      !user ? <p role="status">Staff chưa có tài khoản Access được liên kết.</p> :
      <><p>{user.email ?? "Access không có email"} · {user.status === "active" ? "Đang hoạt động" : "Đã tạm khóa"}</p>
        <div data-testid="ho-staff-role-current">
          {user.assignments.length ? user.assignments.map(a => <div key={a.assignmentId} className="v24-prop-row">
            <span>{a.roleName} · {a.scopeType}{a.scopeId ? ` · ${a.scopeId}` : ""}</span>
            {a.roleKey !== "founder" && !self && user.status === "active" ?
              <button type="button" className="secondary-btn" disabled={busy}
                onClick={() => { if (window.confirm(`Gỡ role ${a.roleName} khỏi Access này?`))
                  void write({ action: "remove", assignmentId: a.assignmentId }); }}>Gỡ</button> : null}
          </div>) : <p>Chưa có role assignment.</p>}
        </div>
        {self ? <p role="status">Không thể tự thay đổi quyền của tài khoản đang đăng nhập.</p> :
          user.status !== "active" ? <p role="status">Tài khoản Access chưa hoạt động.</p> :
          <div className="v24-prop-row">
            <label>Role<select data-testid="ho-staff-role-select" value={roleId} disabled={busy}
              onChange={e => setRoleId(e.target.value)}>
              <option value="">Chọn role…</option>{assignable.map(r => <option value={r.id} key={r.id}>{r.displayName}</option>)}
            </select></label>
            <label>Scope<select value={scopeType} disabled={busy} onChange={e => { setScopeType(e.target.value as ScopeType); setScopeId(""); }}>
              <option value="GLOBAL">GLOBAL</option><option value="CENTER">CENTER</option>
              <option value="PATH">PATH</option><option value="RUNNING_CLASS">RUNNING_CLASS</option>
            </select></label>
            {scopeType !== "GLOBAL" ? <label>Scope ID<input value={scopeId} disabled={busy}
              onChange={e => setScopeId(e.target.value)} placeholder="UUID của scope" /></label> : null}
            <button type="button" className="secondary-btn" disabled={busy || !canAssign}
              onClick={() => void write({ action: "assign", roleId, scopeType, scopeId: scopedId })}>
              {busy ? "Đang lưu…" : "Gán role"}
            </button>
            {duplicate ? <p role="status">Role này đã được gán cho scope đã chọn.</p> : null}
          </div>}
      </>}
    {notice ? <p role="status">{notice}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
