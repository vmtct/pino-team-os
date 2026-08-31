"use client";

import { useEffect, useMemo, useState } from "react";
import { boApi } from "@/lib/bo-api";
import { offboardStaff } from "@/lib/bo-staff-offboarding";
import type { BoAccessRole, BoAccessUser, BoCenter, BoPathProgram, BoRunningClass, BoStaffProfile, BoStaffProfilePatch, BoStaffRecord } from "@/lib/bo-model";
import styles from "../bo.module.css";

type Data = {
  staff: BoStaffRecord[];
  users: BoAccessUser[];
  roles: BoAccessRole[];
  centers: BoCenter[];
  paths: BoPathProgram[];
  classes: BoRunningClass[];
};

type ScopeType = "GLOBAL" | "CENTER" | "PATH" | "RUNNING_CLASS";

const emptyData: Data = { staff: [], users: [], roles: [], centers: [], paths: [], classes: [] };

export function StaffManagementView() {
  const [data, setData] = useState<Data>(emptyData);
  const [selectedId, setSelectedId] = useState("");
  const [profile, setProfile] = useState<BoStaffProfile | null>(null);
  const [form, setForm] = useState<BoStaffProfilePatch>({});
  const [roleId, setRoleId] = useState("");
  const [scopeType, setScopeType] = useState<ScopeType>("GLOBAL");
  const [scopeId, setScopeId] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Initial directory load plus refresh after onboarding mutations.
  useEffect(() => {
    void refresh();
    const onStaffUpdated = () => { void refresh(); };
    window.addEventListener("bo:staff-updated", onStaffUpdated);
    return () => window.removeEventListener("bo:staff-updated", onStaffUpdated);
  }, []);
  useEffect(() => {
    if (!selectedId) { setProfile(null); return; }
    setError("");
    void boApi.staffRecord(selectedId).then((next) => { setProfile(next); setForm(profileForm(next)); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Không thể tải hồ sơ."));
  }, [selectedId]);

  const selected = data.staff.find((item) => item.id === selectedId) ?? null;
  const accessUser = useMemo(() => data.users.find((item) => item.staffMemberId === selectedId) ?? null, [data.users, selectedId]);
  const activeRoles = useMemo(() => data.roles.filter((item) => item.status === "active" && item.roleKey !== "founder"), [data.roles]);

  async function refresh(preferId = "") {
    const [staff, users, roles, catalog] = await Promise.all([boApi.staffRecords(), boApi.accessUsers(), boApi.accessRoles(), boApi.scopeCatalog()]);
    setData({ staff, users, roles, centers: catalog.centers, paths: catalog.paths, classes: catalog.classes });
    const nextId = preferId && staff.some((item) => item.id === preferId) ? preferId : staff[0]?.id ?? "";
    setSelectedId(nextId);
  }

  async function syncTosPerimeter() {
    setBusy("perimeter"); setError(""); setMessage("");
    try {
      const result = await boApi.reconcileTosAccess();
      setMessage(`Đã đồng bộ TOS Access cho ${result.emailCount} staff active.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể đồng bộ TOS Access."); }
    finally { setBusy(""); }
  }

  async function saveProfile() {
    if (!selectedId) return;
    setBusy("profile"); setError(""); setMessage("");
    try {
      const next = await boApi.updateStaff(selectedId, form);
      setProfile(next); setForm(profileForm(next)); await refresh(selectedId); setMessage("Đã lưu hồ sơ nhân viên.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu hồ sơ."); }
    finally { setBusy(""); }
  }

  async function changeStaffStatus(status: "active" | "inactive") {
    if (!selectedId || !confirm(status === "inactive" ? "Chỉ deactivate Staff? Access sẽ không tự bị suspend." : "Reactivate nhân viên này?")) return;
    setBusy("staff-status"); setError(""); setMessage("");
    try { await boApi.setStaffStatus(selectedId, status); await refresh(selectedId); setProfile((value) => value ? { ...value, status } : value); setMessage(status === "inactive" ? "Staff đã inactive." : "Staff đã active lại."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể đổi trạng thái Staff."); }
    finally { setBusy(""); }
  }

  async function assignRole() {
    if (!accessUser || !roleId || (scopeType !== "GLOBAL" && !scopeId)) return;
    setBusy("role"); setError(""); setMessage("");
    try { await boApi.assignAccessRole({ userId: accessUser.id, roleId, scopeType, scopeId: scopeType === "GLOBAL" ? null : scopeId }); await refresh(selectedId); setRoleId(""); setScopeId(""); setMessage("Đã thêm Access role."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể thêm role."); }
    finally { setBusy(""); }
  }
  async function revokeRole(assignmentId: string) {
    if (!confirm("Gỡ role assignment này?")) return;
    setBusy(`revoke:${assignmentId}`); setError(""); setMessage("");
    try { await boApi.removeAccessAssignment(assignmentId); await refresh(selectedId); setMessage("Đã gỡ role assignment."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể gỡ role."); }
    finally { setBusy(""); }
  }

  async function changeAccessStatus(status: "active" | "suspended") {
    if (!accessUser) return;
    if (status === "suspended" && !suspendReason.trim()) { setError("Cần lý do khi suspend Access."); return; }
    if (!confirm(status === "suspended" ? "Suspend quyền truy cập của nhân viên này?" : "Kích hoạt lại Access?")) return;
    setBusy("access-status"); setError(""); setMessage("");
    try { await boApi.setAccessUserStatus(accessUser.id, status, status === "suspended" ? suspendReason.trim() : undefined); await refresh(selectedId); setSuspendReason(""); setMessage(status === "suspended" ? "Access đã suspended." : "Access đã active lại."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể đổi Access status."); }
    finally { setBusy(""); }
  }

  async function runOffboarding() {
    if (!selectedId || !profile) return;
    const staffActive = profile.status === "active";
    const accessActive = accessUser?.status === "active";
    if (!staffActive && !accessActive) return;
    if (accessActive && !suspendReason.trim()) { setError("Nhập lý do offboarding để suspend Access trước."); return; }

    const plan = accessActive && staffActive
      ? "Access sẽ được suspend trước, sau đó Staff mới được deactivate. Đây là hai canonical command riêng và có thể báo partial failure."
      : accessActive
        ? "Staff đã inactive; thao tác này sẽ hoàn tất offboarding bằng cách suspend Access."
        : "Access không active; thao tác này chỉ deactivate Staff.";
    if (!confirm(`Offboard ${profile.displayLabel}?\n\n${plan}`)) return;

    setBusy("offboarding"); setError(""); setMessage("");
    try {
      const result = await offboardStaff(
        { staffActive, accessActive },
        suspendReason,
        {
          suspendAccess: async (reason) => {
            if (!accessUser) throw new Error("Staff chưa có Access user.");
            await boApi.setAccessUserStatus(accessUser.id, "suspended", reason);
          },
          deactivateStaff: async () => { await boApi.setStaffStatus(selectedId, "inactive"); },
        },
      );
      await refresh(selectedId);
      if (result.staffDeactivated) setProfile((value) => value ? { ...value, status: "inactive" } : value);
      setSuspendReason("");
      setMessage(accessActive ? "Offboarding hoàn tất: Access đã suspended và Staff đã inactive." : "Offboarding hoàn tất: Staff đã inactive.");
    } catch (cause) {
      try { await refresh(selectedId); } catch { /* keep original command error */ }
      setError(cause instanceof Error ? cause.message : "Không thể hoàn tất offboarding.");
    } finally { setBusy(""); }
  }

  return (
    <section id="staff-management" className={styles.page}>
      <header className={styles.heading}><span>PINO TEAM · BACK OFFICE</span><h1>Nhân viên & phân quyền</h1><p>Quản lý hồ sơ nhân viên, trạng thái truy cập và role/scope dùng trên TOS.</p><div className={styles.headingActions}><a className={styles.primaryButton} href="#add-staff">+ Thêm nhân viên</a><button type="button" className={styles.secondaryButton} disabled={busy === "perimeter"} onClick={() => void syncTosPerimeter()}>{busy === "perimeter" ? "Đang đồng bộ…" : "Đồng bộ TOS access"}</button></div></header>
      {error ? <p className={styles.ownerError}>{error}</p> : null}{message ? <p className={styles.ownerBulkStatus}>{message}</p> : null}
      <div className={styles.staffManagementGrid}>
        <aside className={styles.staffDirectory}>
          <div className={styles.panelHeading}><div><h2>{data.staff.length} nhân viên</h2><p>Chọn một người để quản lý.</p></div></div>
          {data.staff.map((item) => {
            const user = data.users.find((entry) => entry.staffMemberId === item.id);
            return <button type="button" key={item.id} className={`${styles.staffCard} ${selectedId === item.id ? styles.staffCardActive : ""}`} onClick={() => setSelectedId(item.id)}>
              <strong>{item.displayLabel}</strong><span>{item.roleLabel ?? item.department ?? "Chưa phân loại"}</span><small>{item.status} · Access {user?.status ?? "none"}</small>
            </button>;
          })}
        </aside>

        <div className={styles.staffDetailStack}>
          {!selected || !profile ? <section className={styles.panel}><p>Chọn nhân viên để xem chi tiết.</p></section> : <>
            <section className={styles.panel}>
              <div className={styles.panelHeading}><div><h2>{profile.displayLabel}</h2><p>Operational profile · {profile.status}</p></div><span className={styles.writePill}>{profile.status}</span></div>
              <div className={styles.formGrid}>
                <Field label="Tên hiển thị" value={form.displayLabel ?? ""} onChange={(value) => setForm((v) => ({ ...v, displayLabel: value }))} />
                <Field label="Email hồ sơ" type="email" value={form.email ?? ""} onChange={(value) => setForm((v) => ({ ...v, email: value }))} />
                <Field label="Mobile" value={form.mobile ?? ""} onChange={(value) => setForm((v) => ({ ...v, mobile: value }))} />
                <Field label="Department" value={form.department ?? ""} onChange={(value) => setForm((v) => ({ ...v, department: value }))} />
                <Field label="Role label" value={form.roleLabel ?? ""} onChange={(value) => setForm((v) => ({ ...v, roleLabel: value }))} />
                <Field label="Employment type" value={form.employmentType ?? ""} onChange={(value) => setForm((v) => ({ ...v, employmentType: value }))} />
                <Field label="Start date" type="date" value={form.startDate ?? ""} onChange={(value) => setForm((v) => ({ ...v, startDate: value }))} />
              </div>
              <div className={styles.staffActions}>
                <button type="button" className={styles.primaryButton} disabled={busy === "profile" || !(form.displayLabel ?? "").trim()} onClick={() => void saveProfile()}>{busy === "profile" ? "Đang lưu…" : "Lưu hồ sơ"}</button>
                <button type="button" className={styles.secondaryButton} disabled={busy === "staff-status" || busy === "offboarding"} onClick={() => void changeStaffStatus(profile.status === "active" ? "inactive" : "active")}>{profile.status === "active" ? "Deactivate Staff only" : "Reactivate Staff"}</button>
              </div>
              {profile.status === "inactive" && accessUser?.status === "active" ? <p className={styles.staffWarning}>Staff đã inactive nhưng Access vẫn active. Dùng “Hoàn tất offboarding” bên dưới để đóng quyền truy cập.</p> : null}
              {(profile.status === "active" || accessUser?.status === "active") ? <div className={styles.staffAccessStatus}>
                <div><strong>Offboarding</strong><p>Luôn suspend Access trước rồi mới deactivate Staff để partial failure vẫn fail-safe.</p></div>
                {accessUser?.status === "active" ? <label className={styles.field}>Lý do offboarding<input value={suspendReason} onChange={(event) => setSuspendReason(event.target.value)} placeholder="Ví dụ: kết thúc hợp tác" /></label> : null}
                <button type="button" className={styles.secondaryButton} disabled={Boolean(busy) || (accessUser?.status === "active" && !suspendReason.trim())} onClick={() => void runOffboarding()}>{busy === "offboarding" ? "Đang offboard…" : profile.status === "inactive" ? "Hoàn tất offboarding" : "Offboard an toàn"}</button>
              </div> : null}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeading}><div><h2>Access</h2><p>Role, scope và login state là canonical Access state riêng với Staff status.</p></div><span className={styles.writePill}>{accessUser?.status ?? "not provisioned"}</span></div>
              {!accessUser ? <p>Chưa có Access. Dùng “Provision existing Staff” ở phần Add staff bên dưới.</p> : <>
                <p className={styles.staffAccessMeta}>{accessUser.email ?? "No email"} · {accessUser.assignments.length} assignment(s)</p>
                <div className={styles.staffAssignmentList}>{accessUser.assignments.map((assignment) => <div className={styles.staffAssignmentCard} key={assignment.assignmentId}><div><strong>{assignment.roleName}</strong><small>{scopeLabel(assignment.scopeType, assignment.scopeId, data)}</small></div><button type="button" className={styles.secondaryButton} disabled={assignment.roleKey === "founder" || busy === `revoke:${assignment.assignmentId}`} onClick={() => void revokeRole(assignment.assignmentId)}>Gỡ</button></div>)}</div>

                <div className={styles.staffAccessComposer}>
                  <label className={styles.field}>Thêm role<select value={roleId} onChange={(event) => setRoleId(event.target.value)}><option value="">Chọn role…</option>{activeRoles.map((role) => <option value={role.id} key={role.id}>{role.displayName}</option>)}</select></label>
                  <label className={styles.field}>Scope<select value={scopeType} onChange={(event) => { setScopeType(event.target.value as ScopeType); setScopeId(""); }}><option value="GLOBAL">Global</option><option value="CENTER">Center</option><option value="PATH">Path</option><option value="RUNNING_CLASS">Running Class</option></select></label>
                  {scopeType === "GLOBAL" ? <div /> : <ScopeSelect type={scopeType} value={scopeId} data={data} onChange={setScopeId} />}
                  <button type="button" className={styles.secondaryButton} disabled={!roleId || (scopeType !== "GLOBAL" && !scopeId) || busy === "role"} onClick={() => void assignRole()}>+ Add role</button>
                </div>
                <div className={styles.staffAccessStatus}>
                  {accessUser.status === "active" ? <><label className={styles.field}>Suspend reason<input value={suspendReason} onChange={(event) => setSuspendReason(event.target.value)} placeholder="Required to suspend" /></label><button type="button" className={styles.secondaryButton} disabled={!suspendReason.trim() || busy === "access-status" || busy === "offboarding"} onClick={() => void changeAccessStatus("suspended")}>Suspend Access only</button></> : <button type="button" className={styles.secondaryButton} disabled={busy === "access-status" || busy === "offboarding"} onClick={() => void changeAccessStatus("active")}>Reactivate Access</button>}
                </div>
              </>}
            </section>
          </>}
        </div>
      </div>
    </section>
  );
}

function profileForm(profile: BoStaffProfile): BoStaffProfilePatch {
  return { displayLabel: profile.displayLabel, email: profile.email ?? "", mobile: profile.mobile ?? "", employmentType: profile.employmentType ?? "", department: profile.department ?? "", roleLabel: profile.roleLabel ?? "", startDate: profile.startDate ?? "" };
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className={styles.field}>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
function ScopeSelect({ type, value, data, onChange }: { type: Exclude<ScopeType, "GLOBAL">; value: string; data: Data; onChange: (value: string) => void }) {
  const options = type === "CENTER" ? data.centers.map((item) => [item.id, item.displayName] as const) : type === "PATH" ? data.paths.map((item) => [item.id, item.displayName] as const) : data.classes.map((item) => [item.id, item.name] as const);
  return <label className={styles.field}>Target<select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Chọn target…</option>{options.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>;
}

function scopeLabel(type: string, id: string | null, data: Data) {
  if (type === "GLOBAL") return "Global";
  if (!id) return type;
  if (type === "CENTER") return `Center · ${data.centers.find((item) => item.id === id)?.displayName ?? id}`;
  if (type === "PATH") return `Path · ${data.paths.find((item) => item.id === id)?.displayName ?? id}`;
  return `Class · ${data.classes.find((item) => item.id === id)?.name ?? id}`;
}
