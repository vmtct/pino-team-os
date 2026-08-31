"use client";

import { useEffect, useState } from "react";
import { boApi } from "@/lib/bo-api";
import type { BoAccessRole } from "@/lib/bo-model";
import type { BoAccessPermission, BoAccessRoleDetail } from "@/lib/bo-access-model";
import styles from "../../bo.module.css";

type Form = { roleKey: string; displayName: string; description: string; permissionKeys: string[] };
const empty: Form = { roleKey: "", displayName: "", description: "", permissionKeys: [] };

export function AccessRolesView() {
  const [roles, setRoles] = useState<BoAccessRole[]>([]);
  const [permissions, setPermissions] = useState<BoAccessPermission[]>([]);
  const [detail, setDetail] = useState<BoAccessRoleDetail | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const creating = detail === null;

  useEffect(() => { void refresh(); }, []);

  async function refresh(selectId?: string) {
    try {
      setError("");
      const [nextRoles, nextPermissions] = await Promise.all([boApi.accessRoles(), boApi.accessPermissions()]);
      setRoles(nextRoles); setPermissions(nextPermissions);
      if (selectId) await selectRole(selectId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải roles."); }
  }

  async function selectRole(roleId: string) {
    try {
      setError("");
      const next = await boApi.accessRole(roleId);
      setDetail(next);
      setForm({ roleKey: next.roleKey, displayName: next.displayName, description: next.description ?? "", permissionKeys: next.permissionKeys });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải role."); }
  }

  function togglePermission(key: string) {
    setForm((value) => ({ ...value, permissionKeys: value.permissionKeys.includes(key) ? value.permissionKeys.filter((item) => item !== key) : [...value.permissionKeys, key].sort() }));
  }

  async function save() {
    if (!form.displayName.trim() || (creating && !form.roleKey.trim())) return;
    setBusy(true); setError("");
    try {
      if (creating) {
        const created = await boApi.createAccessRole({ roleKey: form.roleKey.trim(), displayName: form.displayName.trim(), description: form.description.trim() || null, permissionKeys: form.permissionKeys });
        await refresh(created.id);
      } else {
        await boApi.updateAccessRole(detail.id, { displayName: form.displayName.trim(), description: form.description.trim() || null, permissionKeys: form.permissionKeys, expectedUpdatedAt: detail.updatedAt });
        await refresh(detail.id);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu role."); }
    finally { setBusy(false); }
  }

  async function duplicate() {
    if (!detail || detail.roleKey === "founder" || detail.status !== "active") return;
    const roleKey = window.prompt("Machine key cho role mới", `${detail.roleKey}-copy`)?.trim();
    if (!roleKey) return;
    const displayName = window.prompt("Display name cho role mới", `${detail.displayName} Copy`)?.trim();
    if (!displayName) return;
    setBusy(true); setError("");
    try {
      const created = await boApi.duplicateAccessRole(detail.id, { roleKey, displayName, description: detail.description });
      await refresh(created.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể duplicate role."); }
    finally { setBusy(false); }
  }

  async function archive() {
    if (!detail || detail.roleType !== "custom" || !confirm(`Archive ${detail.displayName}?`)) return;
    setBusy(true); setError("");
    try { await boApi.archiveAccessRole(detail.id); setDetail(null); setForm(empty); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể archive role."); }
    finally { setBusy(false); }
  }

  const editable = creating || detail?.roleType === "custom";
  return <section className={styles.page}>
    <header className={styles.heading}><span>PINO TEAM · SYSTEM</span><h1>Roles</h1><p>Configurable permission bundles. Role names và UI visibility không tự cấp quyền.</p></header>
    {error ? <p className={styles.ownerError}>{error}</p> : null}
    <div className={styles.staffManagementGrid}>
      <aside className={styles.staffDirectory}>
        <button className={styles.primaryButton} onClick={() => { setDetail(null); setForm(empty); }}>+ New role</button>
        {roles.map((role) => <button type="button" key={role.id} className={`${styles.staffCard} ${detail?.id === role.id ? styles.staffCardActive : ""}`} onClick={() => void selectRole(role.id)}>
          <strong>{role.displayName}</strong><span>{role.roleKey}</span><small>{role.roleType} · {role.status} · {role.permissionCount} permissions · {role.assignmentCount} assignments</small>
        </button>)}
      </aside>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>{creating ? "Create role" : detail?.displayName}</h2><p>{editable ? "Permission membership is server-authorized and audited." : "System roles are protected read-only roles."}</p></div>{detail ? <span className={styles.writePill}>{detail.status}</span> : null}</div>
        <div className={styles.formGrid}>
          <label className={styles.field}>Role key<input disabled={!creating} value={form.roleKey} onChange={(event) => setForm((value) => ({ ...value, roleKey: event.target.value }))} /></label>
          <label className={styles.field}>Display name<input disabled={!editable} value={form.displayName} onChange={(event) => setForm((value) => ({ ...value, displayName: event.target.value }))} /></label>
          <label className={styles.field}>Description<input disabled={!editable} value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} /></label>
        </div>
        <div className={styles.staffAssignmentList} style={{ marginTop: 16 }}>
          {permissions.map((permission) => <label className={styles.staffAssignmentCard} key={permission.key}>
            <input type="checkbox" style={{ width: 18, height: 18 }} disabled={!editable} checked={form.permissionKeys.includes(permission.key)} onChange={() => togglePermission(permission.key)} />
            <div style={{ flex: 1 }}><strong>{permission.displayLabel}</strong><small>{permission.key} · {permission.surfaceApplicability} · {permission.allowedScopes.join("/")}</small></div>
          </label>)}
        </div>
        <div className={styles.staffActions}>
          {editable ? <button className={styles.primaryButton} disabled={busy || !form.displayName.trim() || (creating && !form.roleKey.trim())} onClick={() => void save()}>{busy ? "Saving…" : creating ? "Create role" : "Save role"}</button> : null}
          {!creating && detail?.roleKey !== "founder" && detail?.status === "active" ? <button className={styles.secondaryButton} disabled={busy} onClick={() => void duplicate()}>Duplicate role</button> : null}
          {!creating && detail?.roleType === "custom" && detail.status === "active" ? <button className={styles.secondaryButton} disabled={busy} onClick={() => void archive()}>Archive role</button> : null}
        </div>
      </section>
    </div>
  </section>;
}
