"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BoDataGrid, BoDataGridBadge, BoDataGridCanonicalId, BoDataGridSidePeek, BoDataGridStatus, type BoDataGridColumn } from "@/app/bo/components/data-grid";
import { useBoDataGridUrlState } from "@/app/bo/components/data-grid/useBoDataGridUrlState";
import { boApi } from "@/lib/bo-api";
import { canManageFounderTarget, hasEffectiveFounderAssignment } from "@/lib/bo-access-founder-ui";
import { boDataGridRange } from "@/lib/bo-data-grid-state";
import type { BoAccessRole, BoContext } from "@/lib/bo-model";
import type { BoAccessSystemUser } from "@/lib/bo-access-model";
import styles from "../../bo.module.css";

type ScopeType = "GLOBAL" | "CENTER" | "PATH" | "RUNNING_CLASS";
const ACCESS_USER_GRID_OPTIONS = { defaultPageSize: 25, allowedPageSizes: [10, 25, 50, 100] as const };

export function AccessUsersView() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const grid = useBoDataGridUrlState(ACCESS_USER_GRID_OPTIONS);
  const selectedUserId = searchParams.get("accessUser") ?? "";
  const [users, setUsers] = useState<BoAccessSystemUser[]>([]);
  const [roles, setRoles] = useState<BoAccessRole[]>([]);
  const [actorUserId, setActorUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [scopeType, setScopeType] = useState<ScopeType>("GLOBAL");
  const [scopeId, setScopeId] = useState("");
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const actor = useMemo(() => users.find((user) => user.id === actorUserId) ?? null, [users, actorUserId]);
  const selectedUser = useMemo(() => users.find((user) => user.id === selectedUserId) ?? null, [users, selectedUserId]);
  const actorIsFounder = useMemo(() => Boolean(actor && hasEffectiveFounderAssignment(actor.assignments)), [actor]);
  const assignableRoles = useMemo(() => roles.filter((role) => role.status === "active" && (role.roleKey !== "founder" || actorIsFounder)), [roles, actorIsFounder]);
  const selectedRole = useMemo(() => roles.find((role) => role.id === roleId) ?? null, [roles, roleId]);
  const founderSelected = selectedRole?.roleKey === "founder";
  const canAssignSelected = Boolean(selectedUserId && roleId && selectedUserId !== actorUserId)
    && (!founderSelected || canManageFounderTarget(actorUserId, selectedUserId, actorIsFounder))
    && (founderSelected || scopeType === "GLOBAL" || Boolean(scopeId.trim()));

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    setRoleId(""); setScopeType("GLOBAL"); setScopeId(""); setEffectiveUntil("");
  }, [selectedUserId]);

  const statusFilter = ["active", "suspended"].includes(grid.state.filters.status ?? "") ? grid.state.filters.status! : "all";
  const filteredUsers = useMemo(() => {
    const term = grid.state.search.trim().toLocaleLowerCase("vi");
    return users.filter((user) => {
      if (statusFilter !== "all" && user.status !== statusFilter) return false;
      if (!term) return true;
      const roleText = user.assignments.map((assignment) => `${assignment.roleName} ${assignment.roleKey} ${assignment.scopeType} ${assignment.scopeId ?? ""}`).join(" ");
      return `${user.email ?? ""} ${user.id} ${user.staffMemberId ?? ""} ${user.status} ${roleText}`.toLocaleLowerCase("vi").includes(term);
    });
  }, [grid.state.search, statusFilter, users]);
  const sortedUsers = useMemo(() => {
    const key = grid.state.sortKey ?? "account";
    const direction = grid.state.sortDirection === "desc" ? -1 : 1;
    return [...filteredUsers].sort((left, right) => direction * compareAccessUsers(left, right, key));
  }, [filteredUsers, grid.state.sortDirection, grid.state.sortKey]);
  const range = boDataGridRange(grid.state.page, grid.state.pageSize, sortedUsers.length);
  const visibleUsers = sortedUsers.slice((range.page - 1) * grid.state.pageSize, range.page * grid.state.pageSize);

  const columns = useMemo<BoDataGridColumn<BoAccessSystemUser>[]>(() => [
    { key: "account", header: "Account", sortable: true, sticky: true, minWidth: 240, render: (user) => <div className={styles.accessGridIdentity}><strong>{user.email ?? "No email"}{user.id === actorUserId ? " · you" : ""}</strong><BoDataGridCanonicalId value={user.id} label="Copy Access User ID" /></div> },
    { key: "staff", header: "Staff link", sortable: true, minWidth: 190, render: (user) => user.staffMemberId ? <BoDataGridCanonicalId value={user.staffMemberId} label="Copy Staff ID" /> : <span className={styles.accessGridMuted}>Not linked</span> },
    { key: "status", header: "Account state", sortable: true, minWidth: 130, render: (user) => <BoDataGridStatus value={user.status} tone={user.status === "active" ? "success" : "warning"} /> },
    { key: "roles", header: "Roles / scopes", sortable: true, minWidth: 260, render: (user) => user.assignments.length ? <div className={styles.accessGridBadges}>{user.assignments.slice(0, 3).map((assignment) => <BoDataGridBadge key={assignment.assignmentId}>{assignment.roleName} · {assignment.scopeType}</BoDataGridBadge>)}{user.assignments.length > 3 ? <BoDataGridBadge>+{user.assignments.length - 3}</BoDataGridBadge> : null}</div> : <span className={styles.accessGridMuted}>No assignments</span> },
    { key: "authority", header: "Authority", sortable: true, minWidth: 150, render: (user) => user.id === actorUserId ? <BoDataGridStatus value="Current actor" tone="info" /> : hasEffectiveFounderAssignment(user.assignments) ? <BoDataGridStatus value="Founder" tone="warning" /> : <BoDataGridStatus value="Standard" tone="neutral" /> },
  ], [actorUserId]);

  async function refresh() {
    try {
      setLoading(true); setError("");
      const [nextUsers, nextRoles, context] = await Promise.all([boApi.accessUsers(), boApi.accessRoles(), readActorContext()]);
      setUsers(nextUsers); setRoles(nextRoles); setActorUserId(context.userId);
      if (selectedUserId && !nextUsers.some((user) => user.id === selectedUserId)) selectUser("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải Access users."); }
    finally { setLoading(false); }
  }

  function selectUser(nextId: string, history: "push" | "replace" = "replace") {
    const params = new URLSearchParams(searchParams.toString());
    if (nextId) params.set("accessUser", nextId);
    else params.delete("accessUser");
    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    if (history === "push") router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
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

    <BoDataGrid
      rows={visibleUsers}
      columns={columns}
      rowKey={(user) => user.id}
      caption="Access Users directory"
      state={error ? "error" : loading ? "loading" : "ready"}
      stateMessage={error || undefined}
      search={grid.state.search}
      onSearchChange={grid.setSearch}
      searchPlaceholder="Tìm email, User ID, Staff ID, role hoặc scope…"
      sortKey={grid.state.sortKey ?? "account"}
      sortDirection={grid.state.sortDirection}
      onSortChange={grid.setSort}
      filterChips={statusFilter === "all" ? [] : [{ key: "status", label: "Status", value: statusFilter, onClear: () => grid.setFilter("status", "all") }]}
      resultLabel={`${sortedUsers.length} / ${users.length} users`}
      onRefresh={() => void refresh()}
      selectedRowKey={selectedUserId || null}
      onRowOpen={busy ? undefined : (user) => selectUser(user.id, "push")}
      emptyTitle="Không có Access User phù hợp"
      emptyMessage="Thử đổi search hoặc status filter; canonical authorization state không bị thay đổi."
      pagination={{ page: range.page, pageSize: grid.state.pageSize, total: sortedUsers.length, pageSizeOptions: ACCESS_USER_GRID_OPTIONS.allowedPageSizes, onPageChange: grid.setPage, onPageSizeChange: grid.setPageSize }}
      toolbarActions={<label className={styles.gridToolbarFilter}>Status<select aria-label="Filter Access Users by status" value={statusFilter} onChange={(event) => grid.setFilter("status", event.target.value)}><option value="all">All</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label>}
    />

    {selectedUserId ? <BoDataGridSidePeek title={selectedUser?.email ?? selectedUserId} eyebrow="System · Access User" onClose={() => selectUser("")}>
      {!selectedUser ? <section className={styles.panel}><p>{loading ? "Đang tải Access User…" : "Access User không còn trong canonical directory."}</p></section> : <div className={styles.accessGridPeek}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><h2>Account</h2><p>Canonical Access User · Staff link và account state.</p></div><BoDataGridStatus value={selectedUser.status} tone={selectedUser.status === "active" ? "success" : "warning"} /></div>
          <div className={styles.accessGridFacts}><div><span>User ID</span><BoDataGridCanonicalId value={selectedUser.id} label="Copy Access User ID" /></div><div><span>Staff</span>{selectedUser.staffMemberId ? <BoDataGridCanonicalId value={selectedUser.staffMemberId} label="Copy Staff ID" /> : <strong>Not linked</strong>}</div></div>
          {selectedUser.id === actorUserId ? <p className={styles.staffWarning}>Self-management is blocked. Use another authorized Founder/admin for recovery changes.</p> : null}
          <div className={styles.staffActions}><button className={styles.secondaryButton} disabled={selectedUser.id === actorUserId || (hasEffectiveFounderAssignment(selectedUser.assignments) && !canManageFounderTarget(actorUserId, selectedUser.id, actorIsFounder)) || busy === `status:${selectedUser.id}`} onClick={() => void changeStatus(selectedUser)}>{selectedUser.status === "active" ? "Suspend" : "Reactivate"}</button></div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><h2>Role assignments</h2><p>Role/scope state is canonical; Founder recovery remains actor-aware and Core-enforced.</p></div><span className={styles.readOnly}>{selectedUser.assignments.length} assignment(s)</span></div>
          <div className={styles.staffAssignmentList}>{selectedUser.assignments.map((assignment) => {
            const founderTargetAllowed = assignment.roleKey !== "founder" || canManageFounderTarget(actorUserId, selectedUser.id, actorIsFounder);
            return <div className={styles.staffAssignmentCard} key={assignment.assignmentId}><div><strong>{assignment.roleName}</strong><small>{assignment.scopeType}{assignment.scopeId ? ` · ${assignment.scopeId}` : ""} · {assignment.roleStatus ?? "active"} · TOS {assignment.tosApplicable ? "yes" : "no"} · from {new Date(assignment.effectiveFrom).toLocaleString("vi-VN")}{assignment.effectiveUntil ? ` → ${new Date(assignment.effectiveUntil).toLocaleString("vi-VN")}` : ""}</small></div><button className={styles.secondaryButton} disabled={selectedUser.id === actorUserId || !founderTargetAllowed || busy === `remove:${assignment.assignmentId}`} onClick={() => void removeAssignment(selectedUser.id, assignment.assignmentId, assignment.roleKey)}>Remove</button></div>;
          })}</div>
          {!selectedUser.assignments.length ? <p>Chưa có role assignment.</p> : null}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><h2>Assign role</h2><p>Founder chỉ có thể được Founder cấp cho User khác; Core vẫn enforce self/last-Founder invariants.</p></div></div>
          <div className={styles.staffAccessComposer}>
            <label className={styles.field}>Role<select value={roleId} onChange={(event) => { const next = event.target.value; setRoleId(next); if (roles.find((role) => role.id === next)?.roleKey === "founder") { setScopeType("GLOBAL"); setScopeId(""); setEffectiveUntil(""); } }}><option value="">Select role…</option>{assignableRoles.map((role) => <option key={role.id} value={role.id}>{role.displayName}</option>)}</select></label>
            <label className={styles.field}>Scope<select disabled={founderSelected} value={founderSelected ? "GLOBAL" : scopeType} onChange={(event) => { setScopeType(event.target.value as ScopeType); setScopeId(""); }}><option value="GLOBAL">GLOBAL</option><option value="CENTER">CENTER</option><option value="PATH">PATH</option><option value="RUNNING_CLASS">RUNNING_CLASS</option></select></label>
            <button className={styles.primaryButton} disabled={busy === "assign" || !canAssignSelected} onClick={() => void assignRole()}>Assign</button>
          </div>
          {!founderSelected && scopeType !== "GLOBAL" ? <label className={styles.field} style={{ marginTop: 10 }}>Canonical scope ID<input value={scopeId} onChange={(event) => setScopeId(event.target.value)} placeholder="UUID" /></label> : null}
          {!founderSelected ? <label className={styles.field} style={{ marginTop: 10 }}>Effective until (optional)<input type="datetime-local" value={effectiveUntil} onChange={(event) => setEffectiveUntil(event.target.value)} /></label> : null}
        </section>
      </div>}
    </BoDataGridSidePeek> : null}
  </section>;
}

function compareAccessUsers(left: BoAccessSystemUser, right: BoAccessSystemUser, key: string) {
  if (key === "staff") return (left.staffMemberId ?? "~").localeCompare(right.staffMemberId ?? "~") || accessUserLabel(left).localeCompare(accessUserLabel(right), "vi");
  if (key === "status") return left.status.localeCompare(right.status) || accessUserLabel(left).localeCompare(accessUserLabel(right), "vi");
  if (key === "roles") return left.assignments.length - right.assignments.length || accessUserLabel(left).localeCompare(accessUserLabel(right), "vi");
  if (key === "authority") return Number(hasEffectiveFounderAssignment(left.assignments)) - Number(hasEffectiveFounderAssignment(right.assignments)) || accessUserLabel(left).localeCompare(accessUserLabel(right), "vi");
  return accessUserLabel(left).localeCompare(accessUserLabel(right), "vi");
}

function accessUserLabel(user: BoAccessSystemUser) {
  return user.email ?? user.id;
}

async function readActorContext(): Promise<BoContext> {
  const response = await fetch("/api/bo/context", { cache: "no-store" });
  const body = await response.json() as { data?: BoContext; error?: { message?: string } };
  if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Không thể xác định current Access actor.");
  return body.data;
}
