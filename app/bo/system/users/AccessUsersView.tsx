"use client";

import { useEffect, useMemo, useState } from "react";
import { boApi } from "@/lib/bo-api";
import type { BoAccessRole } from "@/lib/bo-model";
import type { BoAccessSystemUser } from "@/lib/bo-access-model";
import styles from "../../bo.module.css";

type ScopeType = "GLOBAL" | "CENTER" | "PATH" | "RUNNING_CLASS";

export function AccessUsersView() {
  const [users, setUsers] = useState<BoAccessSystemUser[]>([]);
  const [roles, setRoles] = useState<BoAccessRole[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [scopeType, setScopeType] = useState<ScopeType>("GLOBAL");
  const [scopeId, setScopeId] = useState("");
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const assignableRoles = useMemo(() => roles.filter((role) => role.status === "active" && role.roleKey !== "founder"), [roles]);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    try {
      setError("");
      const [nextUsers, nextRoles] = await Promise.all([boApi.accessUsers(), boApi.accessRoles()]);
      setUsers(nextUsers); setRoles(nextRoles);
      setSelectedUserId((value) => value && nextUsers.some((user) => user.id === value) ? value : nextUsers[0]?.id ?? "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải Access users."); }
  }

  async function assignRole() {
    if (!selectedUserId || !roleId || (scopeType !== "GLOBAL" && !scopeId.trim())) return;
    setBusy("assign"); setError("");
    try {
      await boApi.assignAccessRole({
        userId: selectedUserId, roleId, scopeType, scopeId: scopeType === "GLOBAL" ? null : scopeId.trim(),
        ...(effectiveUntil ? { effectiveUntil: new Date(effectiveUntil).toISOString() } : {}),
      });
      setRoleId(""); setScopeId(""); setEffectiveUntil(""); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể assign role."); }
    finally { setBusy(""); }
  }

  async function removeAssignment(assignmentId: string) {
    if (!confirm("Remove role assignment này?")) return;
    setBusy(`remove:${assignmentId}`); setError("");
    try { await boApi.removeAccessAssignment(assignmentId); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể remove role assignment."); }
    finally { setBusy(""); }
  }

  async function changeStatus(user: BoAccessSystemUser) {
    const suspend = user.status === "active";
    const reason = suspend ? window.prompt("Lý do suspend Access")?.trim() : undefined;
    if (suspend && !reason) return;
    setBusy(`status:${user.id}`); setError("");
    try { await boApi.setAccessUserStatus(user.id, suspend ? "suspended" : "active", reason); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể đổi Access status."); }
    finally { setBusy(""); }
  }

  return <section className={styles.page}>
    <header className={styles.heading}><span>PINO TEAM · SYSTEM</span><h1>Users</h1><p>Canonical User, Staff link, role assignments, effective TOS source và account state. UI không thay thế Core authorization.</p></header>
    {error ? <p className={styles.ownerError}>{error}</p> : null}
    <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>Assign role</h2><p>Scope ID phải là canonical ID. GLOBAL không nhận scope ID.</p></div><button className={styles.secondaryButton} onClick={() => void refresh()}>Refresh</button></div>
      <div className={styles.staffAccessComposer}>
        <label className={styles.field}>User<select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>{users.map((user) => <option key={user.id} value={user.id}>{user.email ?? user.id}</option>)}</select></label>
        <label className={styles.field}>Role<select value={roleId} onChange={(event) => setRoleId(event.target.value)}><option value="">Select role…</option>{assignableRoles.map((role) => <option key={role.id} value={role.id}>{role.displayName}</option>)}</select></label>
        <label className={styles.field}>Scope<select value={scopeType} onChange={(event) => { setScopeType(event.target.value as ScopeType); setScopeId(""); }}><option value="GLOBAL">GLOBAL</option><option value="CENTER">CENTER</option><option value="PATH">PATH</option><option value="RUNNING_CLASS">RUNNING_CLASS</option></select></label>
        <button className={styles.primaryButton} disabled={busy === "assign" || !selectedUserId || !roleId || (scopeType !== "GLOBAL" && !scopeId.trim())} onClick={() => void assignRole()}>Assign</button>
      </div>
      {scopeType !== "GLOBAL" ? <label className={styles.field} style={{ marginTop: 10 }}>Canonical scope ID<input value={scopeId} onChange={(event) => setScopeId(event.target.value)} placeholder="UUID" /></label> : null}
      <label className={styles.field} style={{ marginTop: 10 }}>Effective until (optional)<input type="datetime-local" value={effectiveUntil} onChange={(event) => setEffectiveUntil(event.target.value)} /></label>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>{users.length} Access users</h2><p>Founder assignment/status controls are intentionally protected in UI and again in Core.</p></div></div>
      <div className={styles.ownerQueue}>
        {users.map((user) => {
          const founder = user.assignments.some((assignment) => assignment.roleKey === "founder");
          return <article className={styles.ownerRow} key={user.id}>
            <div className={styles.ownerMeta}><strong>{user.email ?? "No email"}</strong><span>{user.status} · Staff {user.staffMemberId ?? "not linked"}</span><small>{user.assignments.length} assignment(s)</small></div>
            <div className={styles.staffAssignmentList}>{user.assignments.map((assignment) => <div className={styles.staffAssignmentCard} key={assignment.assignmentId}><div><strong>{assignment.roleName}</strong><small>{assignment.scopeType}{assignment.scopeId ? ` · ${assignment.scopeId}` : ""} · {assignment.roleStatus ?? "active"} · TOS {assignment.tosApplicable ? "yes" : "no"} · from {new Date(assignment.effectiveFrom).toLocaleString("vi-VN")}{assignment.effectiveUntil ? ` → ${new Date(assignment.effectiveUntil).toLocaleString("vi-VN")}` : ""}</small></div><button className={styles.secondaryButton} disabled={assignment.roleKey === "founder" || busy === `remove:${assignment.assignmentId}`} onClick={() => void removeAssignment(assignment.assignmentId)}>Remove</button></div>)}</div>
            <div className={styles.staffActions}><button className={styles.secondaryButton} disabled={founder || busy === `status:${user.id}`} onClick={() => void changeStatus(user)}>{user.status === "active" ? "Suspend" : "Reactivate"}</button></div>
          </article>;
        })}
      </div>
    </section>
  </section>;
}
