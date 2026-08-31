"use client";

import { useEffect, useMemo, useState } from "react";
import { boApi } from "@/lib/bo-api";
import { canManageFounderTarget, hasEffectiveFounderAssignment } from "@/lib/bo-access-founder-ui";
import type { BoAccessRole, BoContext } from "@/lib/bo-model";
import type { BoAccessSystemUser } from "@/lib/bo-access-model";
import styles from "../../bo.module.css";

type ScopeType = "GLOBAL" | "CENTER" | "PATH" | "RUNNING_CLASS";

export function AccessUsersView() {
  const [users, setUsers] = useState<BoAccessSystemUser[]>([]);
  const [roles, setRoles] = useState<BoAccessRole[]>([]);
  const [actorUserId, setActorUserId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [scopeType, setScopeType] = useState<ScopeType>("GLOBAL");
  const [scopeId, setScopeId] = useState("");
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const actor = useMemo(() => users.find((user) => user.id === actorUserId) ?? null, [users, actorUserId]);
  const actorIsFounder = useMemo(() => Boolean(actor && hasEffectiveFounderAssignment(actor.assignments)), [actor]);
  const assignableRoles = useMemo(() => roles.filter((role) => role.status === "active" && (role.roleKey !== "founder" || actorIsFounder)), [roles, actorIsFounder]);
  const selectedRole = useMemo(() => roles.find((role) => role.id === roleId) ?? null, [roles, roleId]);
  const founderSelected = selectedRole?.roleKey === "founder";
  const canAssignSelected = Boolean(selectedUserId && roleId && selectedUserId !== actorUserId)
    && (!founderSelected || canManageFounderTarget(actorUserId, selectedUserId, actorIsFounder))
    && (founderSelected || scopeType === "GLOBAL" || Boolean(scopeId.trim()));

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    try {
      setError("");
      const [nextUsers, nextRoles, context] = await Promise.all([boApi.accessUsers(), boApi.accessRoles(), readActorContext()]);
      setUsers(nextUsers); setRoles(nextRoles); setActorUserId(context.userId);
      setSelectedUserId((value) => value && nextUsers.some((user) => user.id === value) ? value : nextUsers[0]?.id ?? "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải Access users."); }
  }

  async function assignRole() {
    if (!canAssignSelected) return;
    setBusy("assign"); setError("");
    try {
      await boApi.assignAccessRole({
        userId: selectedUserId,
        roleId,
        scopeType: founderSelected ? "GLOBAL" : scopeType,
        scopeId: founderSelected || scopeType === "GLOBAL" ? null : scopeId.trim(),
        ...(!founderSelected && effectiveUntil ? { effectiveUntil: new Date(effectiveUntil).toISOString() } : {}),
      });
      setRoleId(""); setScopeType("GLOBAL"); setScopeId(""); setEffectiveUntil(""); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể assign role."); }
    finally { setBusy(""); }
  }

  async function removeAssignment(userId: string, assignmentId: string, roleKey: string) {
    if (userId === actorUserId) return;
    if (roleKey === "founder" && !canManageFounderTarget(actorUserId, userId, actorIsFounder)) return;
    if (!confirm("Remove role assignment này?")) return;
    setBusy(`remove:${assignmentId}`); setError("");
    try { await boApi.removeAccessAssignment(assignmentId); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể remove role assignment."); }
    finally { setBusy(""); }
  }

  async function changeStatus(user: BoAccessSystemUser) {
    const founder = hasEffectiveFounderAssignment(user.assignments);
    if (user.id === actorUserId || (founder && !canManageFounderTarget(actorUserId, user.id, actorIsFounder))) return;
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
      <div className={styles.panelHeading}><div><h2>Assign role</h2><p>Founder recovery chỉ có thể được Founder cấp cho một User khác; Core vẫn enforce self/last-Founder invariants.</p></div><button className={styles.secondaryButton} onClick={() => void refresh()}>Refresh</button></div>
      <div className={styles.staffAccessComposer}>
        <label className={styles.field}>User<select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>{users.map((user) => <option key={user.id} value={user.id}>{user.email ?? user.id}{user.id === actorUserId ? " · you" : ""}</option>)}</select></label>
        <label className={styles.field}>Role<select value={roleId} onChange={(event) => { const next = event.target.value; setRoleId(next); if (roles.find((role) => role.id === next)?.roleKey === "founder") { setScopeType("GLOBAL"); setScopeId(""); setEffectiveUntil(""); } }}><option value="">Select role…</option>{assignableRoles.map((role) => <option key={role.id} value={role.id}>{role.displayName}</option>)}</select></label>
        <label className={styles.field}>Scope<select disabled={founderSelected} value={founderSelected ? "GLOBAL" : scopeType} onChange={(event) => { setScopeType(event.target.value as ScopeType); setScopeId(""); }}><option value="GLOBAL">GLOBAL</option><option value="CENTER">CENTER</option><option value="PATH">PATH</option><option value="RUNNING_CLASS">RUNNING_CLASS</option></select></label>
        <button className={styles.primaryButton} disabled={busy === "assign" || !canAssignSelected} onClick={() => void assignRole()}>Assign</button>
      </div>
      {!founderSelected && scopeType !== "GLOBAL" ? <label className={styles.field} style={{ marginTop: 10 }}>Canonical scope ID<input value={scopeId} onChange={(event) => setScopeId(event.target.value)} placeholder="UUID" /></label> : null}
      {!founderSelected ? <label className={styles.field} style={{ marginTop: 10 }}>Effective until (optional)<input type="datetime-local" value={effectiveUntil} onChange={(event) => setEffectiveUntil(event.target.value)} /></label> : null}
      {selectedUserId === actorUserId ? <p className={styles.staffWarning}>Self-assignment is blocked. Use another authorized Founder/admin for recovery changes.</p> : null}
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>{users.length} Access users</h2><p>Founder management is actor-aware in UI; Core remains the final authority for self-management and last-Founder protection.</p></div></div>
      <div className={styles.ownerQueue}>
        {users.map((user) => {
          const founder = hasEffectiveFounderAssignment(user.assignments);
          const founderTargetAllowed = !founder || canManageFounderTarget(actorUserId, user.id, actorIsFounder);
          const targetIsSelf = user.id === actorUserId;
          return <article className={styles.ownerRow} key={user.id}>
            <div className={styles.ownerMeta}><strong>{user.email ?? "No email"}{targetIsSelf ? " · you" : ""}</strong><span>{user.status} · Staff {user.staffMemberId ?? "not linked"}</span><small>{user.assignments.length} assignment(s)</small></div>
            <div className={styles.staffAssignmentList}>{user.assignments.map((assignment) => <div className={styles.staffAssignmentCard} key={assignment.assignmentId}><div><strong>{assignment.roleName}</strong><small>{assignment.scopeType}{assignment.scopeId ? ` · ${assignment.scopeId}` : ""} · {assignment.roleStatus ?? "active"} · TOS {assignment.tosApplicable ? "yes" : "no"} · from {new Date(assignment.effectiveFrom).toLocaleString("vi-VN")}{assignment.effectiveUntil ? ` → ${new Date(assignment.effectiveUntil).toLocaleString("vi-VN")}` : ""}</small></div><button className={styles.secondaryButton} disabled={targetIsSelf || (assignment.roleKey === "founder" && !founderTargetAllowed) || busy === `remove:${assignment.assignmentId}`} onClick={() => void removeAssignment(user.id, assignment.assignmentId, assignment.roleKey)}>Remove</button></div>)}</div>
            <div className={styles.staffActions}><button className={styles.secondaryButton} disabled={targetIsSelf || !founderTargetAllowed || busy === `status:${user.id}`} onClick={() => void changeStatus(user)}>{user.status === "active" ? "Suspend" : "Reactivate"}</button></div>
          </article>;
        })}
      </div>
    </section>
  </section>;
}

async function readActorContext(): Promise<BoContext> {
  const response = await fetch("/api/bo/context", { cache: "no-store" });
  const body = await response.json() as { data?: BoContext; error?: { message?: string } };
  if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể xác định current Access actor.");
  return body.data;
}
