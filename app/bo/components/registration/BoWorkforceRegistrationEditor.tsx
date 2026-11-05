"use client";

import { useEffect, useState } from "react";
import { boApi } from "@/lib/bo-api";
import { saveCenterShiftRegistration } from "@/lib/bo-workforce-registration-command";
import { workforceRead } from "@/app/bo/architecture/workforce-read-client";
import type { BoRecord } from "@/lib/bo-registration";

type Loaded = {
  value: boolean;
  version: number;
  canManage: boolean;
};
type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; data: Loaded };

/** PAP-1199: explicit bounded command, never a generic TDD boolean property save. */
export function BoWorkforceRegistrationEditor({
  record, onSaved,
}: { record: BoRecord; onSaved: (open: boolean) => void }) {
  const centerId = typeof record.centerId === "string" ? record.centerId : "";
  const termWeekId = typeof record.termWeekId === "string" ? record.termWeekId : "";
  const [state, setState] = useState<State>({ kind: "loading" });
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ kind: "loading" });
    setError("");
    setEditing(false);
    if (!centerId || !termWeekId) {
      setState({ kind: "error", message: "Center Shift Plan thiếu Center hoặc TermWeek." });
      return () => { live = false; };
    }
    void Promise.all([workforceRead.bootstrap(), boApi.workforceWeekControl(centerId, termWeekId)])
      .then(([bootstrap, result]) => {
        if (!live) return;
        if (!result.availability.shiftPlanExists) {
          setState({ kind: "error", message: "Center Shift Plan không còn tồn tại." });
          return;
        }
        const center = bootstrap.centers.find(item => item.id === centerId);
        if (!center) {
          setState({ kind: "error", message: "Center không thuộc phạm vi được cấp quyền." });
          return;
        }
        // New Core permission flag. Old Core lacks it: fail closed until R1 is deployed.
        const canManage = (center as typeof center & { canManageRegistration?: boolean }).canManageRegistration === true;
        const data = {
          value: result.availability.availabilityRegistrationOpen,
          version: result.availability.controlVersion,
          canManage,
        };
        setOpen(data.value);
        setState({ kind: "ready", data });
      })
      .catch((cause: unknown) => {
        if (live) setState({ kind: "error", message: cause instanceof Error ? cause.message : "Không đọc được trạng thái đăng ký." });
      });
    return () => { live = false; };
  }, [centerId, termWeekId, reload]);

  async function save() {
    if (state.kind !== "ready" || !state.data.canManage || saving || !reason.trim() || open === state.data.value) return;
    setSaving(true);
    setError("");
    try {
      const confirmed = await saveCenterShiftRegistration({
        centerId, termWeekId, expectedVersion: state.data.version,
        reason: reason.trim(), open,
      });
      setState({ kind: "ready", data: {
        ...state.data, value: confirmed.open, version: confirmed.version,
      } });
      setEditing(false);
      setReason("");
      onSaved(open);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lưu trạng thái đăng ký thất bại.");
    } finally {
      setSaving(false);
    }
  }
  return <div className="v24-prop-item" data-workforce-registration-editor>
    <div className="v24-prop-key">Mở đăng ký</div>
    {state.kind === "loading" ? <span role="status">Đang tải trạng thái…</span>
      : state.kind === "error" ? <div role="alert">{state.message}<button type="button" className="secondary-btn" onClick={() => setReload(v => v + 1)}>Thử lại</button></div>
      : <div>
        {!editing ? <div className="v24-prop-value">
          <span>{state.data.value ? "Đã bật" : "Đã tắt"}</span>
          {state.data.canManage
            ? <button type="button" className="secondary-btn" onClick={() => { setOpen(state.data.value); setError(""); setEditing(true); }}>Chỉnh sửa</button>
            : <span aria-label="Chỉ đọc">Chỉ đọc</span>}
        </div> : <div>
          <label className="property-row">
            <input type="checkbox" checked={open} disabled={saving} onChange={e => setOpen(e.target.checked)} />
            Mở đăng ký Staff
          </label>
          <label className="property-row">Lý do thay đổi
            <textarea className="edit-input" value={reason} maxLength={500} disabled={saving} onChange={e => setReason(e.target.value)} />
          </label>
          {error ? <p role="alert" className="edit-error">{error}</p> : null}
          <button className="primary-btn" type="button" onClick={() => void save()} disabled={saving || !reason.trim() || open === state.data.value}>
            {saving ? "Đang lưu…" : "Lưu"}
          </button>
          <button className="secondary-btn" type="button" disabled={saving} onClick={() => { setEditing(false); setOpen(state.data.value); setError(""); setReason(""); }}>Hủy</button>
        </div>}
      </div>}
  </div>;
}
