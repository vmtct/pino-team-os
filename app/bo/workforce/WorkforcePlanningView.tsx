"use client";

import { useEffect, useMemo, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoWorkforceAssignment, BoWorkforcePlanningBootstrap, BoWorkforceShiftTemplate, BoWorkforceWeeklyPlanning } from "@/lib/bo-model";
import { correctWorkforceAssignment } from "@/lib/workforce-planning-correction";
import styles from "../bo.module.css";

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: BoWorkforceWeeklyPlanning };
type Selection = { staffMemberId: string; workDate: string } | null;
type CenterWeek = BoWorkforcePlanningBootstrap["termWeeks"][number] & { centerId: string; termDisplayName: string };

export function WorkforcePlanningView() {
  const [bootstrap, setBootstrap] = useState<BoWorkforcePlanningBootstrap | null>(null);
  const [centerId, setCenterId] = useState("");
  const [termWeekId, setTermWeekId] = useState("");
  const [planning, setPlanning] = useState<Load>({ state: "loading" });
  const [selection, setSelection] = useState<Selection>(null);
  const [templateId, setTemplateId] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [availabilityVoidReason, setAvailabilityVoidReason] = useState("");
  const [shiftTemplates, setShiftTemplates] = useState<BoWorkforceShiftTemplate[]>([]);
  const [templateDraft, setTemplateDraft] = useState({ code: "", displayLabel: "", startLocalTime: "", endLocalTime: "" });

  const weeks = useMemo<CenterWeek[]>(() => {
    if (!bootstrap) return [];
    const termById = new Map(bootstrap.terms.map((term) => [term.id, term]));
    return bootstrap.termWeeks.flatMap((week) => {
      const term = termById.get(week.termId);
      return term ? [{ ...week, centerId: term.centerId, termDisplayName: term.displayName }] : [];
    });
  }, [bootstrap]);
  const centerWeeks = weeks.filter((week) => week.centerId === centerId);
  const selectedCenter = bootstrap?.centers.find((center) => center.id === centerId) ?? null;

  useEffect(() => {
    let active = true;
    void boApi.workforcePlanningBootstrap().then((state) => {
      if (!active) return;
      setBootstrap(state);
      const center = state.centers.find((item) => item.status === "active") ?? state.centers[0];
      if (!center) { setPlanning({ state: "error", message: "Chưa có Center canonical để lập lịch." }); return; }
      setCenterId(center.id);
      const termById = new Map(state.terms.map((term) => [term.id, term]));
      const candidates = state.termWeeks.filter((week) => termById.get(week.termId)?.centerId === center.id);
      const chosen = chooseWeek(candidates);
      setTermWeekId(chosen?.id ?? "");
      if (!chosen) setPlanning({ state: "error", message: "Center chưa có TermWeek để lập lịch." });
    }).catch((error: unknown) => { if (active) setPlanning({ state: "error", message: message(error) }); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!centerId || !termWeekId) return;
    void refresh(centerId, termWeekId);
    // Selection belongs to one exact Center/week projection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, termWeekId]);

  useEffect(() => {
    if (!centerId || !selectedCenter?.canManageShiftTemplates) { setShiftTemplates([]); return; }
    void loadShiftTemplates(centerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, selectedCenter?.canManageShiftTemplates]);

  async function loadShiftTemplates(nextCenter = centerId) {
    if (!nextCenter) return;
    try { setShiftTemplates(await boApi.workforceShiftTemplates(nextCenter)); }
    catch (error) { setNotice(message(error)); }
  }

  async function refresh(nextCenter = centerId, nextWeek = termWeekId) {
    if (!nextCenter || !nextWeek) return;
    setPlanning({ state: "loading" });
    try {
      const data = await boApi.workforcePlanning(nextCenter, nextWeek);
      setPlanning({ state: "ready", data });
      setSelection((current) => current && data.staff.some((staff) => staff.id === current.staffMemberId) && dateRange(data).includes(current.workDate) ? current : null);
    } catch (error) {
      setPlanning({ state: "error", message: message(error) });
    }
  }

  function changeCenter(nextCenter: string) {
    setCenterId(nextCenter);
    setSelection(null); setNotice(""); setReason(""); setAvailabilityVoidReason("");
    const candidates = weeks.filter((week) => week.centerId === nextCenter);
    setTermWeekId(chooseWeek(candidates)?.id ?? "");
  }

  const data = planning.state === "ready" ? planning.data : null;
  const selectedStaff = data?.staff.find((staff) => staff.id === selection?.staffMemberId) ?? null;
  const activeAssignments = data && selection ? data.assignments.filter((item) => item.staffMemberId === selection.staffMemberId && item.workDate === selection.workDate && item.status === "ACTIVE") : [];
  const historyAssignments = data && selection ? data.assignments.filter((item) => item.staffMemberId === selection.staffMemberId && item.workDate === selection.workDate) : [];
  const availableTemplateIds = data && selection ? new Set(data.availability.filter((item) => item.staffMemberId === selection.staffMemberId).flatMap((item) => item.items.filter((entry) => entry.workDate === selection.workDate).map((entry) => entry.shiftTemplateId))) : new Set<string>();
  const selectedAvailabilityHistory = data && selection ? data.availabilityHistory.filter((item) => item.staffMemberId === selection.staffMemberId) : [];

  async function voidAvailability(submissionId: string) {
    const normalizedReason = availabilityVoidReason.trim();
    if (!normalizedReason) return;
    setBusy(`availability:void:${submissionId}`); setNotice("");
    try {
      await boApi.voidWorkforceAvailability(submissionId, normalizedReason, crypto.randomUUID());
      setAvailabilityVoidReason("");
      setNotice("Availability đã được void; history được giữ nguyên và không còn dùng làm planning input.");
      await refresh();
    } catch (error) { setNotice(message(error)); } finally { setBusy(""); }
  }

  async function createShiftTemplate() {
    if (!centerId || !templateDraft.code.trim() || !templateDraft.displayLabel.trim() || !templateDraft.startLocalTime || !templateDraft.endLocalTime) return;
    setBusy("template:create"); setNotice("");
    try {
      await boApi.createWorkforceShiftTemplate({ centerId, ...templateDraft }, crypto.randomUUID());
      setTemplateDraft({ code: "", displayLabel: "", startLocalTime: "", endLocalTime: "" });
      setNotice("Shift Template đã được tạo và có thể dùng để xếp ca.");
      await Promise.all([loadShiftTemplates(centerId), termWeekId ? refresh(centerId, termWeekId) : Promise.resolve()]);
    } catch (error) { setNotice(message(error)); } finally { setBusy(""); }
  }

  async function setShiftTemplateStatus(template: BoWorkforceShiftTemplate, status: "ACTIVE" | "INACTIVE") {
    setBusy(`template:${template.id}`); setNotice("");
    try {
      await boApi.setWorkforceShiftTemplateStatus(template.id, centerId, status, crypto.randomUUID());
      setNotice(status === "ACTIVE" ? "Shift Template đã được kích hoạt." : "Shift Template đã ngưng dùng cho assignment mới.");
      await Promise.all([loadShiftTemplates(centerId), termWeekId ? refresh(centerId, termWeekId) : Promise.resolve()]);
    } catch (error) { setNotice(message(error)); } finally { setBusy(""); }
  }

  async function assign() {
    if (!data || !selection || !templateId) return;
    setBusy("assign"); setNotice("");
    try {
      await boApi.assignWorkforceShift({
        staffMemberId: selection.staffMemberId, centerId: data.centerId, workDate: selection.workDate,
        shiftTemplateId: templateId, termWeekId: data.termWeekId,
      }, crypto.randomUUID());
      setNotice("Ca đã được xếp và trở thành lịch operational final.");
      await refresh();
    } catch (error) { setNotice(message(error)); } finally { setBusy(""); }
  }

  async function cancel(assignment: BoWorkforceAssignment) {
    const cancellationReason = reason.trim();
    if (!cancellationReason) return;
    setBusy(`cancel:${assignment.id}`); setNotice("");
    try {
      await boApi.cancelWorkforceAssignment(assignment.id, cancellationReason, crypto.randomUUID());
      setNotice("Ca đã huỷ; lịch sử assignment được giữ nguyên."); setReason("");
      await refresh();
    } catch (error) { setNotice(message(error)); } finally { setBusy(""); }
  }

  async function correct(assignment: BoWorkforceAssignment) {
    if (!data || !templateId) return;
    const correctionReason = reason.trim();
    if (!correctionReason) return;
    setBusy(`correct:${assignment.id}`); setNotice("");
    try {
      const result = await correctWorkforceAssignment(
        () => boApi.cancelWorkforceAssignment(assignment.id, correctionReason, crypto.randomUUID()),
        () => boApi.assignWorkforceShift({
          staffMemberId: assignment.staffMemberId, centerId: assignment.centerId, workDate: assignment.workDate,
          shiftTemplateId: templateId, termWeekId: data.termWeekId, replacesAssignmentId: assignment.id,
        }, crypto.randomUUID()),
      );
      if (result.state === "CANCELLED_ONLY") setNotice("Ca cũ đã huỷ; ca thay thế chưa được tạo.");
      else setNotice("Điều chỉnh hoàn tất: ca cũ đã huỷ và ca thay thế đã được tạo.");
      setReason("");
      await refresh();
    } catch (error) { setNotice(message(error)); } finally { setBusy(""); }
  }

  return <main className={`${styles.page} ${styles.plannerPage}`}>
    <header className={styles.heading}>
      <span>Back Office · Workforce</span>
      <h1>Lịch ca tuần</h1>
      <p>Availability là input của Staff; assignment là quyết định final của Manager. Không có Publish Week trong v1.</p>
    </header>

    <section className={styles.panel}>
      <div className={styles.plannerFilters}>
        <label className={styles.field}>Center
          <select value={centerId} onChange={(event) => changeCenter(event.target.value)}>
            {bootstrap?.centers.filter((center) => center.status === "active").map((center) => <option key={center.id} value={center.id}>{center.displayName}</option>)}
          </select>
        </label>
        <label className={styles.field}>TermWeek
          <select value={termWeekId} onChange={(event) => { setTermWeekId(event.target.value); setSelection(null); setNotice(""); setReason(""); }}>
            {centerWeeks.map((week) => <option key={week.id} value={week.id}>{week.code} · {week.startDate} → {week.endDate}</option>)}
          </select>
        </label>
      </div>
    </section>

    {selectedCenter?.canManageShiftTemplates ? <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>Shift Templates</h2><p>Tạo loại ca theo Center. Template đã dùng không sửa giờ trực tiếp; hãy tạo template mới rồi ngưng template cũ.</p></div><span className={styles.writePill}>workforce.shift_template.manage</span></div>
      <div className={styles.plannerFilters}>
        <label className={styles.field}>Code<input value={templateDraft.code} onChange={(event) => setTemplateDraft((current) => ({ ...current, code: event.target.value }))} placeholder="EVENING" /></label>
        <label className={styles.field}>Tên ca<input value={templateDraft.displayLabel} onChange={(event) => setTemplateDraft((current) => ({ ...current, displayLabel: event.target.value }))} placeholder="Ca tối" /></label>
        <label className={styles.field}>Bắt đầu<input type="time" value={templateDraft.startLocalTime} onChange={(event) => setTemplateDraft((current) => ({ ...current, startLocalTime: event.target.value }))} /></label>
        <label className={styles.field}>Kết thúc<input type="time" value={templateDraft.endLocalTime} onChange={(event) => setTemplateDraft((current) => ({ ...current, endLocalTime: event.target.value }))} /></label>
      </div>
      <div className={styles.subscriptionActions}><button className={styles.primaryButton} disabled={!!busy || !templateDraft.code.trim() || !templateDraft.displayLabel.trim() || !templateDraft.startLocalTime || !templateDraft.endLocalTime} onClick={() => void createShiftTemplate()}>{busy === "template:create" ? "Đang tạo…" : "+ Tạo ca"}</button></div>
      <div className={styles.plannerHistory}>{shiftTemplates.map((template) => <span key={template.id}><strong>{template.displayLabel}</strong> · {template.code} · {template.startLocalTime}–{template.endLocalTime} · {template.status} <button className={styles.secondaryButton} disabled={!!busy} onClick={() => void setShiftTemplateStatus(template, template.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>{template.status === "ACTIVE" ? "Ngưng" : "Kích hoạt"}</button></span>)}</div>
    </section> : selectedCenter ? <section className={styles.panel}><div className={styles.panelHeading}><div><h2>Shift Templates</h2><p>Bạn có thể xếp ca bằng các template đang active; quản lý template cần quyền workforce.shift_template.manage.</p></div><span className={styles.readOnly}>Read only</span></div></section> : null}

    {notice ? <div className={styles.successCard}><span>Workforce planner</span><strong>{notice}</strong></div> : null}
    {planning.state === "loading" ? <State text="Đang tải weekly planning projection từ Core…" /> : null}
    {planning.state === "error" ? <State text={planning.message} error /> : null}

    {data ? <div className={styles.plannerLayout}>
      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div><h2>{data.startDate} → {data.endDate}</h2><p>Click một ô Staff/ngày để assign, cancel hoặc correct.</p></div>
          <span className={styles.readOnly}>{data.staff.length} staff</span>
        </div>
        <div className={styles.plannerTableWrap}>
          <table>
            <thead><tr><th>Staff</th>{dateRange(data).map((date) => <th key={date}>{dateLabel(date)}</th>)}</tr></thead>
            <tbody>{data.staff.map((staff) => <tr key={staff.id}>
              <th>{staff.displayLabel}</th>
              {dateRange(data).map((date) => {
                const assigned = data.assignments.filter((item) => item.staffMemberId === staff.id && item.workDate === date && item.status === "ACTIVE");
                const available = data.availability.some((item) => item.staffMemberId === staff.id && item.items.some((entry) => entry.workDate === date));
                const selected = selection?.staffMemberId === staff.id && selection.workDate === date;
                return <td key={date}>
                  <button className={`${styles.plannerCell} ${selected ? styles.plannerCellActive : ""}`} onClick={() => { setSelection({ staffMemberId: staff.id, workDate: date }); setTemplateId(assigned[0]?.shiftTemplateId ?? ""); setReason(""); }}>
                    {assigned.length ? <><strong>Đã xếp</strong>{assigned.map((item) => <span key={item.id}>{templateLabel(data, item.shiftTemplateId)}</span>)}</> : available ? <><strong>Có thể</strong><span>{availableCount(data, staff.id, date)} ca đăng ký</span></> : <span>—</span>}
                  </button>
                </td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <aside className={styles.plannerSide}>
        {!selection || !selectedStaff ? <div className={styles.empty}>Chọn một Staff/ngày trong grid để thao tác.</div> : <>
          <div className={styles.panelHeading}><div><h2>{selectedStaff.displayLabel}</h2><p>{selection.workDate}</p></div><span className={styles.writePill}>Operational decision</span></div>
          <div className={styles.plannerLegend}>
            <span>Availability: {availableTemplateIds.size ? `${availableTemplateIds.size} ca` : "không đăng ký"}</span>
            <span>Active assignment: {activeAssignments.length}</span>
          </div>
          {selectedAvailabilityHistory.length ? <div className={styles.plannerHistory}>
            <strong>Availability history</strong>
            {selectedAvailabilityHistory.map((item) => <span key={item.id}>
              {item.status} · submitted {item.submittedAt ? new Date(item.submittedAt).toLocaleString("vi-VN") : "—"}
              {item.status === "VOIDED" ? ` · ${item.voidReason ?? "Voided"}` : ""}
              {item.status === "SUBMITTED" && selectedCenter?.canEditPlanning ? <>
                <label className={styles.field}>Lý do void availability
                  <input value={availabilityVoidReason} onChange={(event) => setAvailabilityVoidReason(event.target.value)} placeholder="Bắt buộc; lưu vào audit history" />
                </label>
                <button className={styles.secondaryButton} disabled={!availabilityVoidReason.trim() || !!busy} onClick={() => void voidAvailability(item.id)}>{busy === `availability:void:${item.id}` ? "…" : "Void availability"}</button>
              </> : null}
            </span>)}
          </div> : null}

          <label className={styles.field}>Shift Template
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
              <option value="">Chọn ca…</option>
              {data.templates.map((template) => <option key={template.id} value={template.id}>{availableTemplateIds.has(template.id) ? "✓ " : ""}{template.displayLabel} · {template.startLocalTime}–{template.endLocalTime}</option>)}
            </select>
            <small>✓ = Staff đã submit availability. Manager vẫn là authority xếp ca final.</small>
          </label>
          {!activeAssignments.length ? <button className={styles.primaryButton} disabled={!templateId || !!busy} onClick={() => void assign()}>{busy === "assign" ? "Đang xếp…" : "Xác nhận & xếp ca"}</button> : null}

          {activeAssignments.length ? <label className={styles.field}>Lý do thay đổi
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Bắt buộc khi huỷ hoặc điều chỉnh" />
            <small>Lý do được gửi vào canonical assignment audit; không dùng ghi chú cục bộ ở BO.</small>
          </label> : null}

          {activeAssignments.map((assignment) => <article className={styles.plannerAssignmentCard} key={assignment.id}>
            <div><strong>{templateLabel(data, assignment.shiftTemplateId)}</strong><span>{assignment.status} · {assignment.id.slice(0, 8)}</span></div>
            <div className={styles.subscriptionActions}>
              <button className={styles.secondaryButton} disabled={!reason.trim() || !!busy} onClick={() => void cancel(assignment)}>{busy === `cancel:${assignment.id}` ? "…" : "Huỷ ca"}</button>
              <button className={styles.primaryButton} disabled={!reason.trim() || !templateId || templateId === assignment.shiftTemplateId || !!busy} onClick={() => void correct(assignment)}>{busy === `correct:${assignment.id}` ? "…" : "Đổi sang ca đã chọn"}</button>
            </div>
          </article>)}

          {historyAssignments.some((item) => item.status === "CANCELLED") ? <div className={styles.plannerHistory}><strong>History</strong>{historyAssignments.filter((item) => item.status === "CANCELLED").map((item) => <span key={item.id}>{templateLabel(data, item.shiftTemplateId)} · CANCELLED{item.cancellationReason ? ` · ${item.cancellationReason}` : ""}</span>)}</div> : null}
        </>}
      </aside>
    </div> : null}
  </main>;
}

function chooseWeek(weeks: BoWorkforcePlanningBootstrap["termWeeks"]) {
  const sorted = [...weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const date = todayLocal();
  return sorted.find((week) => date >= week.startDate && date <= week.endDate)
    ?? sorted.find((week) => week.startDate > date)
    ?? sorted.at(-1);
}
function todayLocal() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()); }
function dateRange(data: Pick<BoWorkforceWeeklyPlanning, "startDate" | "endDate">) {
  const rows: string[] = [], current = new Date(`${data.startDate}T00:00:00Z`), end = new Date(`${data.endDate}T00:00:00Z`);
  while (current <= end) { rows.push(current.toISOString().slice(0, 10)); current.setUTCDate(current.getUTCDate() + 1); }
  return rows;
}
function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(date);
}
function templateLabel(data: BoWorkforceWeeklyPlanning, id: string) {
  const item = data.templates.find((template) => template.id === id);
  return item ? `${item.displayLabel} ${item.startLocalTime}–${item.endLocalTime}` : `Shift ${id.slice(0, 8)}`;
}
function availableCount(data: BoWorkforceWeeklyPlanning, staffId: string, date: string) {
  return new Set(data.availability.filter((item) => item.staffMemberId === staffId).flatMap((item) => item.items.filter((entry) => entry.workDate === date).map((entry) => entry.shiftTemplateId))).size;
}
function State({ text, error = false }: { text: string; error?: boolean }) {
  return <div className={`${styles.state} ${error ? styles.errorState : ""}`}><strong>{error ? "Không thể tải" : "PINO BO"}</strong><span>{text}</span></div>;
}
function message(error: unknown) {
  if (error instanceof BoApiError) return `${error.message}${error.requestId ? ` · ${error.requestId}` : ""}`;
  return error instanceof Error ? error.message : "Workforce planning command failed.";
}
