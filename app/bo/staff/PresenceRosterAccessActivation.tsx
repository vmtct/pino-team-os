"use client";

import { useEffect, useMemo, useState } from "react";
import { boApi } from "@/lib/bo-api";
import type { BoAccessRole, BoAccessUser, BoCenter, BoStaffRecord } from "@/lib/bo-model";
import {
  ensurePresenceRosterAccess,
  removePresenceRosterAccess,
  PRESENCE_ROSTER_PERMISSION_KEYS,
  PRESENCE_ROSTER_ROLE_KEY,
} from "@/lib/presence-roster-access";
import styles from "../bo.module.css";

type State = {
  staff: BoStaffRecord[];
  users: BoAccessUser[];
  roles: BoAccessRole[];
  centers: BoCenter[];
};

const empty: State = { staff: [], users: [], roles: [], centers: [] };

export function PresenceRosterAccessActivation() {
  const [data, setData] = useState<State>(empty);
  const [staffId, setStaffId] = useState("");
  const [centerId, setCenterId] = useState("");
  const [busy, setBusy] = useState<"enable" | "remove" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const eligible = useMemo(() => data.staff.filter((staff) => {
    if (staff.status !== "active") return false;
    const candidate = data.users.find((item) => item.staffMemberId === staff.id);
    return candidate?.status === "active";
  }), [data.staff, data.users]);
  const user = useMemo(() => data.users.find((item) => item.staffMemberId === staffId) ?? null, [data.users, staffId]);
  const role = useMemo(() => data.roles.find((item) => item.roleKey === PRESENCE_ROSTER_ROLE_KEY) ?? null, [data.roles]);
  const assignment = useMemo(() => user?.assignments.find((item) =>
    item.roleId === role?.id && item.scopeType === "CENTER" && item.scopeId === centerId,
  ) ?? null, [user, role, centerId]);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    try {
      setError("");
      const [staff, users, roles, catalog] = await Promise.all([
        boApi.staffRecords(),
        boApi.accessUsers(),
        boApi.accessRoles(),
        boApi.scopeCatalog(),
      ]);
      const centers = catalog.centers.filter((center) => center.status.toLowerCase() === "active");
      setData({ staff, users, roles, centers });
      setStaffId((current) => current && staff.some((item) => item.id === current)
        ? current
        : staff.find((item) => item.status === "active" && users.some((candidate) => candidate.staffMemberId === item.id && candidate.status === "active"))?.id ?? "");
      setCenterId((current) => current && centers.some((item) => item.id === current) ? current : centers[0]?.id ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được Presence / roster access.");
    }
  }

  function accessApi() {
    return {
      listRoles: boApi.accessRoles,
      getRole: boApi.accessRole,
      listUsers: boApi.accessUsers,
      createRole: (input: { roleKey: string; displayName: string; description: string; permissionKeys: string[] }) => boApi.createAccessRole(input),
      assignRole: (input: { userId: string; roleId: string; scopeType: "CENTER"; scopeId: string }) => boApi.assignAccessRole(input),
      removeAssignment: (assignmentId: string) => boApi.removeAccessAssignment(assignmentId),
    };
  }

  async function enable() {
    if (!user || !centerId || busy) return;
    setBusy("enable"); setError(""); setMessage("");
    try {
      const result = await ensurePresenceRosterAccess(accessApi(), { userId: user.id, centerId });
      setMessage(result.assignmentCreated
        ? "Đã cấp Presence + roster tại Center đã chọn" + (result.roleCreated ? " và tạo role canonical tối thiểu." : ".")
        : "Quyền Presence + roster tại Center này đã sẵn sàng; không cần write.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cấp Presence / roster access.");
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!user || !centerId || busy || !assignment) return;
    if (!confirm("Gỡ Presence + roster assignment tại Center này? Staff sẽ mất quyền roster và learner arrival từ role này.")) return;
    setBusy("remove"); setError(""); setMessage("");
    try {
      const result = await removePresenceRosterAccess(accessApi(), { userId: user.id, centerId });
      setMessage(result.removedAssignmentId ? "Đã gỡ CENTER assignment. Role canonical tối thiểu được giữ lại để tái sử dụng." : "Không có assignment cần gỡ.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể gỡ Presence / roster access.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <h2>Presence & roster access</h2>
            <p>Cấp quyền Reception tối thiểu cho một Staff tại đúng Center. House Check-in vẫn là StudentVisit; roster chỉ là bounded Session discovery.</p>
          </div>
          <span className={styles.writePill}>{assignment ? "CENTER active" : role ? "Role ready" : "Role not created"}</span>
        </div>

        <div className={styles.assignmentList}>
          {PRESENCE_ROSTER_PERMISSION_KEYS.map((permission) => <code key={permission}>{permission}</code>)}
        </div>

        <div className={styles.formGrid}>
          <label className={styles.field}>Staff
            <select value={staffId} onChange={(event) => setStaffId(event.target.value)}>
              <option value="">Chọn Staff…</option>
              {eligible.map((staff) => <option key={staff.id} value={staff.id}>{staff.displayLabel}{staff.roleLabel ? " · " + staff.roleLabel : ""}</option>)}
            </select>
          </label>
          <label className={styles.field}>Center
            <select value={centerId} onChange={(event) => setCenterId(event.target.value)}>
              <option value="">Chọn Center…</option>
              {data.centers.map((center) => <option key={center.id} value={center.id}>{center.displayName}</option>)}
            </select>
          </label>
        </div>

        {!eligible.length ? <p className={styles.staffWarning}>Không có Staff active nào đang liên kết với Access user active.</p> : null}
        {error ? <p className={styles.ownerError}>{error}</p> : null}
        {message ? <div className={styles.successCard}><strong>{message}</strong></div> : null}

        <div className={styles.staffActions}>
          <button type="button" className={styles.primaryButton} disabled={!user || !centerId || Boolean(busy) || Boolean(assignment)} onClick={() => void enable()}>
            {busy === "enable" ? "Đang cấp…" : assignment ? "Đã cấp tại Center này" : "Enable Presence + roster"}
          </button>
          {assignment ? <button type="button" className={styles.secondaryButton} disabled={Boolean(busy)} onClick={() => void remove()}>
            {busy === "remove" ? "Đang gỡ…" : "Remove CENTER assignment"}
          </button> : null}
          <a className={styles.secondaryButton} href="/bo/system/roles">Review role lifecycle</a>
        </div>

        <p className={styles.staffWarning}>Role này là Product configuration tái sử dụng, không phải fixture. Golden Journey chỉ cần neutralize assignment tạm và Check-out learner sau proof; không seed DB hoặc dùng privileged bypass.</p>
      </div>
    </section>
  );
}
