"use client";
import { useEffect, useRef, useState } from "react";
import { boApi } from "@/lib/bo-api";
import { workforceRead, type GlobalWeekResult } from "@/app/bo/architecture/workforce-read-client";
import type { BoWorkforcePlanningBootstrap } from "@/lib/bo-model";
import { useBoDialog } from "./useBoDialog";

/** Bounded domain command in the canonical BO drawer; never enables generic Workforce CRUD. */
export function BoWorkforceShiftPlanCreate({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const panel = useRef<HTMLElement>(null);
  useBoDialog(true, onClose, panel);
  const [centers, setCenters] = useState<BoWorkforcePlanningBootstrap["centers"]>([]);
  const [centerId, setCenterId] = useState("");
  const [weeks, setWeeks] = useState<GlobalWeekResult["termWeeks"]>([]);
  const [termWeekId, setTermWeekId] = useState("");
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [alreadyExists, setAlreadyExists] = useState(false);
  const selectedCenter = centers.find(center => center.id === centerId);
  const canCreate = !!selectedCenter && (registrationOpen ? selectedCenter.canReopenAvailability : selectedCenter.canLockAvailability);

  useEffect(() => {
    let active = true;
    void workforceRead.bootstrap().then((data) => {
      if (!active) return;
      const eligible = data.centers.filter((center) => center.canEditPlanning && (center.canReopenAvailability || center.canLockAvailability));
      setCenters(eligible);
      setCenterId(eligible[0]?.id ?? "");
      setRegistrationOpen(eligible[0]?.canReopenAvailability ?? false);
      setLoading(false);
    }).catch((cause: unknown) => {
      if (active) { setError(cause instanceof Error ? cause.message : "Không thể tải Center."); setLoading(false); }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setWeeks([]); setTermWeekId(""); setAlreadyExists(false);
    if (!centerId) return;
    setLoading(true); setError("");
    void workforceRead.globalWeeks(centerId).then((result) => {
      if (!active) return;
      const sorted = [...result.termWeeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
      const today = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Ho_Chi_Minh"}).format(new Date());
      const recommended = sorted.find(week => week.startDate <= today && week.endDate >= today)
        ?? sorted.find(week => week.startDate > today)
        ?? sorted.at(-1);
      setWeeks(sorted); setTermWeekId(recommended?.id ?? ""); setLoading(false);
    }).catch((cause: unknown) => {
      if (active) { setError(cause instanceof Error ? cause.message : "Không thể tải TermWeek."); setLoading(false); }
    });
    return () => { active = false; };
  }, [centerId]);

  useEffect(() => {
    let active = true;
    setAlreadyExists(false);
    if (!centerId || !termWeekId) return;
    void boApi.workforceWeekControl(centerId, termWeekId).then((state) => {
      if (active) setAlreadyExists(state.availability.shiftPlanExists === true);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Không thể đọc trạng thái kế hoạch.");
    });
    return () => { active = false; };
  }, [centerId, termWeekId]);

  async function create() {
    if (busy || loading || !centerId || !termWeekId || !reason.trim() || alreadyExists || !canCreate) return;
    setBusy(true); setError("");
    try {
      const control = await boApi.workforceWeekControl(centerId, termWeekId);
      if (control.availability.shiftPlanExists) {
        setAlreadyExists(true);
        throw new Error("Center đã có Shift Plan cho TermWeek này.");
      }
      await boApi.createWorkforceShiftPlan({
        centerId, termWeekId, expectedVersion: control.availability.controlVersion,
        open: registrationOpen, reason: reason.trim(),
      }, crypto.randomUUID());
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo Shift Plan.");
    } finally { setBusy(false); }
  }

  return <>
    <div className="drawer-scrim visible" onClick={onClose} aria-hidden="true" />
    <aside ref={panel} className="drawer open" role="dialog" aria-modal="true" aria-labelledby="workforce-create-title">
      <div className="drawer-top"><div className="drawer-header-copy"><span className="drawer-path">Workforce</span>
        <h2 id="workforce-create-title" className="drawer-record-title">Tạo Center Shift Plan</h2>
      </div><button className="drawer-close" type="button" onClick={onClose} aria-label="Đóng">×</button></div>
      <div className="drawer-content"><section className="property-section">
        <p role="status">Kế hoạch được tạo cho một Center và một TermWeek. Đăng ký Staff khác với phân ca Manager.</p>
        <div className="property-row"><label className="property-label" htmlFor="plan-center">Center</label>
          <select id="plan-center" className="edit-input" value={centerId} disabled={loading || busy} onChange={event => { setCenterId(event.target.value); setRegistrationOpen(centers.find(center => center.id === event.target.value)?.canReopenAvailability ?? false); }}>
            {centers.map(center => <option key={center.id} value={center.id}>{center.displayName}</option>)}
          </select></div>
        <div className="property-row"><label className="property-label" htmlFor="plan-week">TermWeek</label>
          <select id="plan-week" className="edit-input" value={termWeekId} disabled={loading || busy} onChange={event => setTermWeekId(event.target.value)}>
            {weeks.map(week => <option key={week.id} value={week.id}>{week.code} · {week.startDate}–{week.endDate}</option>)}
          </select></div>
        <div className="property-row"><label className="property-label" htmlFor="plan-registration">Mở đăng ký Staff</label>
          <input id="plan-registration" type="checkbox" checked={registrationOpen} disabled={busy} onChange={event => setRegistrationOpen(event.target.checked)} />
        </div>
        <div className="property-row"><label className="property-label" htmlFor="plan-reason">Lý do tạo</label>
          <textarea id="plan-reason" className="edit-input" value={reason} maxLength={500} disabled={busy} onChange={event => setReason(event.target.value)} />
        </div>
        {alreadyExists ? <p role="status">Center Shift Plan đã tồn tại cho tuần này.</p> : null}
        {!canCreate && !loading && centerId ? <p role="status">Bạn không có quyền mở hoặc đóng đăng ký Staff cho Center này.</p> : null}
        {loading ? <p role="status">Đang tải dữ liệu…</p> : null}
        {!loading && !centers.length ? <p role="status">Bạn chưa có quyền quản lý Center nào.</p> : null}
        {error ? <p role="alert" className="edit-error">{error}</p> : null}
      </section></div>
      <div className="drawer-footer"><div className="lab-bottom">
        <button type="button" className="secondary-btn" onClick={onClose}>Hủy</button>
        <button id="create-save" type="button" className="primary-btn" disabled={busy || loading || !centerId || !termWeekId || !reason.trim() || alreadyExists || !canCreate} onClick={() => void create()}>{busy ? "Đang tạo…" : "Tạo Center Shift Plan"}</button>
      </div></div>
    </aside>
  </>;
}