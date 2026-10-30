"use client";

import { useEffect, useState } from "react";
import { BoDataGridState, BoDataGridStatus } from "@/app/bo/components/data-grid";
import { workforceRead, type GlobalWeekResult } from "@/app/bo/architecture/workforce-read-client";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoRunningClass, BoWorkforceAssignment, BoWorkforcePlanningBootstrap, BoWorkforceShiftTemplate, BoWorkforceWeeklyPlanning } from "@/lib/bo-model";
import { eligibleShiftRunningClasses, buildIndependentRoleCommands } from "@/lib/workforce-planning-class-eligibility";
import { correctWorkforceAssignment } from "@/lib/workforce-planning-correction";
import { BoWorkforceWeekPlanner } from "@/app/bo/components/workforce/BoWorkforceWeekPlanner";
import { assignmentTimeSummary, canUseTeachingSessionTime, learningOwnerBlocksShiftCancellation, type WorkforceShiftCoverageMode } from "@/lib/workforce-planning-time-basis";
import styles from "../bo.module.css";
import { workforceAssignmentNote } from "@/app/bo/architecture/workforce-shift-note";

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: BoWorkforceWeeklyPlanning };
type Selection = { staffMemberId: string; workDate: string } | null;
type CenterWeek = GlobalWeekResult["termWeeks"][number];

export function WorkforcePlanningView({ embedded = false, scope }: { embedded?: boolean; scope?: { centerId: string; termWeekId: string } } = {}) {
  const [bootstrap, setBootstrap] = useState<BoWorkforcePlanningBootstrap | null>(null);
  const [centerId, setCenterId] = useState("");
  const [termWeekId, setTermWeekId] = useState("");
  const [centerWeeks, setCenterWeeks] = useState<CenterWeek[]>([]);
  const [planning, setPlanning] = useState<Load>({ state: "loading" });
  const [selection, setSelection] = useState<Selection>(null);
  const [templateId, setTemplateId] = useState("");
  const [frontDesk, setFrontDesk] = useState(false);
  const [shiftLeader, setShiftLeader] = useState(false);
  const [teacherSelected, setTeacherSelected] = useState(false);
  const [assistantSelected, setAssistantSelected] = useState(false);
  const [runningClassCatalog, setRunningClassCatalog] = useState<{ state: "loading"|"ready"|"error"; classes: BoRunningClass[] }>({state:"loading", classes:[]});
  const [teacherRunningClassIds, setTeacherRunningClassIds] = useState<string[]>([]);
  const [assistantRunningClassIds, setAssistantRunningClassIds] = useState<string[]>([]);
  const [coverageMode, setCoverageMode] = useState<WorkforceShiftCoverageMode>("FULL_SHIFT");
  const [customStartLocal, setCustomStartLocal] = useState("");
  const [customEndLocal, setCustomEndLocal] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [shiftNote, setShiftNote] = useState("");
  const [noteEdits, setNoteEdits] = useState<Record<string, string>>({});
  const [availabilityVoidReason, setAvailabilityVoidReason] = useState("");
  const [weekControlReason, setWeekControlReason] = useState("");
  const [weekControlUntil, setWeekControlUntil] = useState("");
  const [shiftTemplates, setShiftTemplates] = useState<BoWorkforceShiftTemplate[]>([]);
  const [templateDraft, setTemplateDraft] = useState({ code: "", displayLabel: "", startLocalTime: "", endLocalTime: "" });

  const selectedCenter = bootstrap?.centers.find((center) => center.id === centerId) ?? null;

  useEffect(() => {
    let active = true;
    void boApi.workforcePlanningBootstrap().then((state) => {
      if (!active) return;
      setBootstrap(state);
      const center = scope ? state.centers.find((item) => item.id === scope.centerId) : state.centers.find((item) => item.status === "active") ?? state.centers[0];
      if (!center) { setPlanning({ state: "error", message: "Chưa có Center canonical để lập lịch." }); return; }
      setCenterId(center.id);
      // A GLOBAL TermWeek can be reused by multiple Centers: never filter it via term.centerId.
      setCenterWeeks([]);
      setTermWeekId("");
      setPlanning({state:"loading"});
    }).catch((error: unknown) => { if (active) setPlanning({ state: "error", message: message(error) }); });
    return () => { active = false; };
  }, [scope?.centerId]);

  useEffect(() => {
    if (!centerId) return;
    let active = true;
    setCenterWeeks([]); setTermWeekId(""); setPlanning({state:"loading"});
    void workforceRead.globalWeeks(centerId).then(({termWeeks}) => {
      if (!active) return;
      const eligible = [...termWeeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
      setCenterWeeks(eligible);
      const chosen = scope?.termWeekId ? eligible.find(week => week.id === scope.termWeekId) : chooseWeek(eligible);
      if (!chosen) {
        setPlanning({state:"error", message:scope?.termWeekId ? "TermWeek không thuộc Center này." : "Center chưa có tuần hợp lệ."});
      } else setTermWeekId(chosen.id);
    }).catch((error:unknown) => {if(active)setPlanning({state:"error",message:message(error)});});
    return () => {active=false;};
  }, [centerId, scope?.termWeekId]);

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

  useEffect(() => {
    if (!centerId) return;
    let active = true;
    void boApi.calendarScope().then(({ classes }) => {
      if (active) setRunningClassCatalog({state:"ready",classes:classes.filter((item) => item.centerId === centerId)});
    }).catch(() => { if (active) setRunningClassCatalog({state:"error",classes:[]}); });
    return () => { active = false; };
  }, [centerId]);

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
    setCenterWeeks([]); setTermWeekId(""); setPlanning({state:"loading"});
  }

  const data = planning.state === "ready" ? planning.data : null;
  const selectedStaff = data?.staff.find((staff) => staff.id === selection?.staffMemberId) ?? null;
  const activeAssignments = data && selection ? data.assignments.filter((item) => item.staffMemberId === selection.staffMemberId && item.workDate === selection.workDate && item.status === "ACTIVE") : [];
  const historyAssignments = data && selection ? data.assignments.filter((item) => item.staffMemberId === selection.staffMemberId && item.workDate === selection.workDate) : [];
  const availableTemplateIds = data && selection ? new Set(data.availability.filter((item) => item.staffMemberId === selection.staffMemberId).flatMap((item) => item.items.filter((entry) => entry.workDate === selection.workDate).map((entry) => entry.shiftTemplateId))) : new Set<string>();
  const selectedAvailabilityHistory = data && selection ? data.availabilityHistory.filter((item) => item.staffMemberId === selection.staffMemberId) : [];
  const selectedTemplate = data?.templates.find((template) => template.id === templateId) ?? null;
  const eligibleRunningClasses = data && selection && selectedTemplate && runningClassCatalog.state === "ready"
    ? eligibleShiftRunningClasses(runningClassCatalog.classes, {
        centerId:data.centerId, workDate:selection.workDate,
        startLocalTime:selectedTemplate.startLocalTime, endLocalTime:selectedTemplate.endLocalTime,
      })
    : [];
  const classRoleIncomplete = (teacherSelected && !teacherRunningClassIds.length) || (assistantSelected && !assistantRunningClassIds.length);
  const canUseTeachingTime = canUseTeachingSessionTime({ frontDesk, teacherSessionCount: teacherRunningClassIds.length + assistantRunningClassIds.length });
  const customRangeReady = coverageMode !== "CUSTOM_RANGE" || (!!customStartLocal && !!customEndLocal && customStartLocal < customEndLocal);
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

  async function toggleRegistration(open: boolean) {
    if (!data?.windows || !centerId || !termWeekId || !weekControlReason.trim() || !selectedCenter) return;
    if (open ? !selectedCenter.canReopenAvailability : !selectedCenter.canLockAvailability) return;
    setBusy("registration"); setNotice("");
    try {
      await boApi.setWorkforceAvailabilityRegistration({
        centerId, termWeekId, expectedVersion: data.windows.availability.controlVersion,
        reason: weekControlReason.trim(), open,
      }, crypto.randomUUID());
      setNotice(open ? "Đã mở đăng ký Staff theo Center Shift Plan." : "Đã đóng đăng ký Staff theo Center Shift Plan.");
      setWeekControlReason("");
      await refresh();
    } catch (error) { setNotice(message(error)); } finally { setBusy(""); }
  }
  async function mutateWeekControl(action: "availability-lock" | "availability-reopen" | "planning-publish" | "planning-reopen") {
    if (!data || !weekControlReason.trim()) return;
    const isReopen = action.endsWith("reopen");
    if (isReopen && !weekControlUntil) return;
    const current = action.startsWith("availability") ? data.windows?.availability : data.windows?.planning;
    if (!current) return;
    setBusy(`week:${action}`); setNotice("");
    try {
      const common = { centerId:data.centerId,termWeekId:data.termWeekId,expectedVersion:current.controlVersion,reason:weekControlReason.trim() };
      if (action === "availability-lock") await boApi.lockWorkforceAvailability(common,crypto.randomUUID());
      else if (action === "availability-reopen") await boApi.reopenWorkforceAvailability({...common,until:new Date(weekControlUntil).toISOString()},crypto.randomUUID());
      else if (action === "planning-publish") await boApi.publishWorkforcePlanning(common,crypto.randomUUID());
      else await boApi.reopenWorkforcePlanning({...common,until:new Date(weekControlUntil).toISOString()},crypto.randomUUID());
      setWeekControlReason(""); setWeekControlUntil("");
      setNotice(action.includes("reopen") ? "Cửa sổ tuần đã được mở lại có thời hạn." : "Cửa sổ tuần đã được khóa/chốt.");
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
    const roles = buildIndependentRoleCommands({
      frontDesk, shiftLeader, teacherSelected, assistantSelected,
      teacherRunningClassIds, assistantRunningClassIds,
    });
    if (classRoleIncomplete) { setNotice("Teacher/Teaching Assistant cần ít nhất một Running Class đủ điều kiện."); return; }
    const eligibleClassIds = new Set(eligibleRunningClasses.map((item) => item.id));
    if ([...teacherRunningClassIds, ...assistantRunningClassIds].some((id) => !eligibleClassIds.has(id))) { setNotice("Lớp được chọn không còn phù hợp Center/ngày/giờ ca."); return; }
    if (!roles.length) { setNotice("Chọn ít nhất Front Desk, Shift Leader, Teacher hoặc Teaching Assistant."); return; }
    if (coverageMode === "CLASSROOM_TIME" && !canUseTeachingTime) { setNotice("Theo giờ lớp cần ít nhất một lớp Teacher hoặc Teaching Assistant."); return; }
    if (coverageMode === "CUSTOM_RANGE" && (!selectedTemplate || !customStartLocal || !customEndLocal || customEndLocal <= customStartLocal || customStartLocal < selectedTemplate.startLocalTime || customEndLocal > selectedTemplate.endLocalTime)) { setNotice("Khung giờ tuỳ chỉnh phải nằm trọn trong ca và giờ kết thúc phải sau giờ bắt đầu."); return; }
    if (coverageMode === "CUSTOM_RANGE" && eligibleRunningClasses.filter((item) => teacherRunningClassIds.includes(item.id) || assistantRunningClassIds.includes(item.id)).some((item) => item.startLocalTime < customStartLocal || item.endLocalTime > customEndLocal)) { setNotice("Khung giờ tuỳ chỉnh phải bao phủ toàn bộ lớp Teacher và Teaching Assistant đã phân công."); return; }
    setBusy("assign"); setNotice("");
    try {
      const input = {
        staffMemberId: selection.staffMemberId, centerId: data.centerId, workDate: selection.workDate,
        shiftTemplateId: templateId, note: shiftNote.trim() || null, coverageMode, ...(coverageMode === "CUSTOM_RANGE" ? { customStartLocal, customEndLocal } : {}), termWeekId: data.termWeekId, roles,
      };
      await boApi.planOperationalWorkforceShift(input, crypto.randomUUID());
      setNotice("Ca và phân công operational đã được chốt.");
      setFrontDesk(false); setShiftLeader(false); setTeacherSelected(false); setAssistantSelected(false); setTeacherRunningClassIds([]); setAssistantRunningClassIds([]); setCoverageMode("FULL_SHIFT"); setCustomStartLocal(""); setCustomEndLocal(""); setShiftNote("");
      await refresh();
    } catch (error) { setNotice(message(error)); } finally { setBusy(""); }
  }

  async function saveAssignmentNote(assignment: BoWorkforceAssignment) {
    const note = (noteEdits[assignment.id] ?? workforceAssignmentNote(assignment) ?? "").trim() || null;
    if (note === workforceAssignmentNote(assignment) || !selectedCenter?.canEditPlanning || data?.windows?.planning.state === "LOCKED") return;
    setBusy("note:" + assignment.id); setNotice("");
    try {
      const response = await fetch("/api/bo/workforce/planning/assignment/note", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ assignmentId: assignment.id, expectedUpdatedAt: assignment.updatedAt, note }),
      });
      const result = await response.json() as {error?: {message?: string}};
      if (!response.ok) throw new Error(result.error?.message || "Không thể lưu Note ca làm (" + response.status + ")");
      setNoteEdits((draft) => { const next = {...draft}; delete next[assignment.id]; return next; });
      setNotice("Đã cập nhật Note ca làm và lưu audit trên Core.");
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

  return <div className={embedded ? styles.plannerPage : styles.page + " " + styles.plannerPage}>
    {!embedded ? <header className={styles.heading}>
      <span>PINO TEAM · BACK OFFICE</span>
      <h1>Lịch ca tuần</h1>
      <p>Availability là input của Staff; assignment là quyết định final của Manager. Hai cửa sổ tuần được khóa độc lập.</p>
    </header> : null}

    {!embedded ? <section className={styles.plannerToolbar} aria-label="Weekly schedule view controls">
      <label className={styles.plannerToolbarField}><span>Center</span>
        <select value={centerId} onChange={(event) => changeCenter(event.target.value)}>
          {bootstrap?.centers.filter((center) => center.status === "active").map((center) => <option key={center.id} value={center.id}>{center.displayName}</option>)}
        </select>
      </label>
      <label className={styles.plannerToolbarField}><span>TermWeek</span>
        <select value={termWeekId} onChange={(event) => { setTermWeekId(event.target.value); setSelection(null); setNotice(""); setReason(""); }}>
          {centerWeeks.map((week) => <option key={week.id} value={week.id}>{week.code} · {week.startDate} → {week.endDate}</option>)}
        </select>
      </label>
      <div className={styles.plannerToolbarSpacer} />
      <span className={styles.plannerToolbarResult}>{data ? `${data.staff.length} staff · ${data.startDate} → ${data.endDate}` : "Canonical weekly projection"}</span>
      <button type="button" className={styles.plannerToolbarRefresh} aria-label="Refresh workforce planning" disabled={!centerId || !termWeekId || planning.state === "loading"} onClick={() => void refresh()}>↻</button>
    </section> : null}

    {notice ? <div className={styles.successCard}><span>Workforce planner</span><strong>{notice}</strong></div> : null}
    {planning.state === "loading" ? <section className={styles.plannerStateSurface}><BoDataGridState kind="loading" message="Đang tải lịch tuần…" /></section> : null}
    {planning.state === "error" ? <section className={styles.plannerStateSurface}><BoDataGridState kind="error" message={planning.message} /></section> : null}

    {data ? <BoWorkforceWeekPlanner key={centerId + ":" + termWeekId} data={data} centerName={selectedCenter?.displayName ?? ""} selection={selection} onRefresh={() => void refresh()} onSelect={(staffMemberId, date) => {
                    const assigned = data.assignments.filter(item => item.staffMemberId === staffMemberId && item.workDate === date && item.status === "ACTIVE");
                    setSelection({ staffMemberId: staffMemberId, workDate: date });
                    setTemplateId(assigned[0]?.shiftTemplateId ?? "");
                     setShiftNote(workforceAssignmentNote(assigned[0]) ?? "");
                    setReason("");
                    setFrontDesk(false);
                    setShiftLeader(false);
                    setTeacherSelected(false);
                    setAssistantSelected(false);
                    setTeacherRunningClassIds([]);
                    setAssistantRunningClassIds([]);
                    setCoverageMode(assigned[0]?.coverageMode ?? (assigned[0]?.timeBasis === "TEACHING_SESSIONS" ? "CLASSROOM_TIME" : "FULL_SHIFT"));
                    setCustomStartLocal(assigned[0]?.effectiveStartLocal?.slice(11,16) ?? "");
                    setCustomEndLocal(assigned[0]?.effectiveEndLocal?.slice(11,16) ?? "");

    }}>
        {!selection || !selectedStaff ? <BoDataGridState kind="empty" title="Chưa chọn ô lịch" message="Chọn một ô để xem lịch và phân công ca." /> : <>
          <div className={styles.plannerLegend}><strong>{selectedStaff.displayLabel}</strong><span>{dateLabel(selection.workDate)}</span><span>{availableTemplateIds.size ? `${availableTemplateIds.size} ca đã đăng ký` : "Chưa ghi nhận đăng ký"}</span>{activeAssignments.length ? <span>{activeAssignments.length} ca đã phân công</span> : null}</div>
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

          <label className={styles.field}>Mẫu ca
            <select value={templateId} onChange={(event) => {
              setTemplateId(event.target.value);
              setTeacherSelected(false); setAssistantSelected(false);
              setCoverageMode("FULL_SHIFT");
              setCustomStartLocal(""); setCustomEndLocal("");
              setTeacherRunningClassIds([]);
              setAssistantRunningClassIds([]);

            }}>
              <option value="">Chọn ca…</option>
              {data.templates.map((template) => <option key={template.id} value={template.id}>{availableTemplateIds.has(template.id) ? "✓ " : ""}{template.displayLabel} · {template.startLocalTime}–{template.endLocalTime}</option>)}
            </select>
            <small>✓ Ca nhân sự đã đăng ký. Bạn có thể chọn ca khác khi phân công.</small>
          </label>

          {!activeAssignments.length && templateId ? <div className={styles.plannerHistory}>
            <strong>Vai trò trong ca</strong>
            <label className={styles.field}>
              <span><input type="checkbox" checked={frontDesk} onChange={(event) => { const checked=event.target.checked; setFrontDesk(checked);  }} /> Tiếp tân</span>
              <small>Tiếp tân áp dụng cho toàn ca; có thể kết hợp các vai trò khác.</small>
            </label>
            <label className={styles.field}><span><input type="checkbox" checked={shiftLeader} onChange={(event) => setShiftLeader(event.target.checked)} /> Trưởng ca</span><small>Phụ trách ca tại trung tâm; không gắn lớp học.</small></label>
            <label className={styles.field}><span><input type="checkbox" checked={teacherSelected} onChange={(event) => { setTeacherSelected(event.target.checked); if (!event.target.checked) setTeacherRunningClassIds([]); }} /> Giáo viên</span></label>
            <label className={styles.field}><span><input type="checkbox" checked={assistantSelected} onChange={(event) => { setAssistantSelected(event.target.checked); if (!event.target.checked) setAssistantRunningClassIds([]); }} /> Trợ giảng</span></label>
            <div className={styles.plannerHistory}>
              <strong>Giờ làm Manager chốt</strong>
              <label><input type="radio" name="coverage-mode" checked={coverageMode==="FULL_SHIFT"} onChange={() => setCoverageMode("FULL_SHIFT")} /> Toàn ca · {selectedTemplate?.startLocalTime}–{selectedTemplate?.endLocalTime}</label>
              <label><input type="radio" name="coverage-mode" checked={coverageMode==="CLASSROOM_TIME"} disabled={!canUseTeachingTime} onChange={() => setCoverageMode("CLASSROOM_TIME")} /> Theo giờ lớp</label>
              <label><input type="radio" name="coverage-mode" checked={coverageMode==="CUSTOM_RANGE"} onChange={() => { setCoverageMode("CUSTOM_RANGE"); if(!customStartLocal)setCustomStartLocal(selectedTemplate?.startLocalTime??""); if(!customEndLocal)setCustomEndLocal(selectedTemplate?.endLocalTime??""); }} /> Tuỳ chỉnh khung giờ</label>
              {coverageMode === "CUSTOM_RANGE" ? <div className={styles.subscriptionActions}><label className={styles.field}>Bắt đầu<input type="time" value={customStartLocal} min={selectedTemplate?.startLocalTime} max={selectedTemplate?.endLocalTime} onChange={(event)=>setCustomStartLocal(event.target.value)} /></label><label className={styles.field}>Kết thúc<input type="time" value={customEndLocal} min={selectedTemplate?.startLocalTime} max={selectedTemplate?.endLocalTime} onChange={(event)=>setCustomEndLocal(event.target.value)} /></label></div> : null}
              <small>Giờ làm phải bao phủ các lớp đã phân công.</small>
            </div>
            {([["TEACHER",teacherSelected,teacherRunningClassIds,setTeacherRunningClassIds],["TEACHING_ASSISTANT",assistantSelected,assistantRunningClassIds,setAssistantRunningClassIds]] as const).map(([role,selected,chosen,setChosen]) => selected ? <details key={role} className={styles.plannerHistory}>
              <summary>{role === "TEACHER" ? "Chọn lớp Giáo viên" : "Chọn lớp Trợ giảng"} · {chosen.length} lớp</summary>
              {runningClassCatalog.state === "loading" ? <small>Đang tải Running Classes…</small> : null}
              {runningClassCatalog.state === "error" ? <small>Không thể đọc Running Classes từ Core, chưa thể phân công vai trò lớp.</small> : null}
              {runningClassCatalog.state === "ready" && !eligibleRunningClasses.length ? <small>Không có Running Class phù hợp Center, thứ/ngày và giờ ca đã chọn.</small> : null}
              {eligibleRunningClasses.map((item) => <label className={styles.field} key={item.id}><span>
                <input type="checkbox" checked={chosen.includes(item.id)} onChange={(event) => setChosen((current) => event.target.checked ? [...new Set([...current,item.id])] : current.filter((id) => id!==item.id))} />
                {item.name} · {item.startLocalTime}–{item.endLocalTime}
              </span></label>)}
              {chosen.length ? <div className={styles.subscriptionActions}>{chosen.map((id) => {
                const item=eligibleRunningClasses.find((candidate)=>candidate.id===id);
                return <button type="button" key={id} className={styles.secondaryButton} onClick={() => setChosen((current)=>current.filter((itemId)=>itemId!==id))} aria-label={"Bỏ lớp "+(item?.name??id)}>{item?.name??id} ×</button>;
              })}</div> : null}
            </details> : null)}
            <label className={styles.field}>Note ca làm (không bắt buộc)
               <textarea rows={2} maxLength={500} value={shiftNote} onChange={(event) => setShiftNote(event.target.value)} placeholder="Ghi chú về ca, không thay thế lý do huỷ/điều chỉnh" />
               <small>{shiftNote.length}/500 ký tự</small>
             </label>
             {classRoleIncomplete ? <small>Vai trò Giáo viên/Trợ giảng cần chọn ít nhất một Running Class để lưu.</small> : null}
          </div> : null}

          {!activeAssignments.length ? <button className={styles.primaryButton} disabled={!templateId || (!frontDesk && !shiftLeader && !teacherSelected && !assistantSelected) || classRoleIncomplete || !customRangeReady || !!busy || data.windows?.planning.state === "LOCKED"} onClick={() => void assign()}>{busy === "assign" ? "Đang xếp…" : "Xác nhận ca & phân công"}</button> : null}

          {activeAssignments.length ? <label className={styles.field}>Lý do thay đổi
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Bắt buộc khi huỷ hoặc điều chỉnh" />
            <small>Lý do được lưu vào lịch sử thay đổi phân công.</small>
          </label> : null}

          {activeAssignments.map((assignment) => {
            const roles = data.roleAssignments.filter((role) => role.shiftAssignmentId === assignment.id && role.status === "ACTIVE");
            const hasOwnerRole = roles.some((role) => role.roleType === "TEACHER"
              && learningOwnerBlocksShiftCancellation(
                data.sessions.find((item) => item.id === role.targetId),
                assignment.staffMemberId,
              ));
            const roleSummary = roles.map((role) => {
              if (role.roleType === "FRONT_DESK") return "FD";
              if (role.roleType === "SHIFT_LEADER") return "Shift Leader";
              const session = data.sessions.find((item) => item.id === role.targetId);
              const owner = session?.learningOwner?.staffMemberId === assignment.staffMemberId;
              return "TE · " + (session?.runningClassDisplayName ?? session?.id.slice(0, 8) ?? "Session") + (owner ? " · Phụ trách chính" : "");
            });
            const runningClassRoleSummary = (data.runningClassResponsibilities ?? []).filter((role) => role.shiftAssignmentId === assignment.id && role.status === "ACTIVE").map((role) => role.roleType === "TEACHER" ? "TE · RunningClass" : "TA · RunningClass");
            return <article className={styles.plannerAssignmentCard} key={assignment.id}>
              <div>
                <strong>{templateLabel(data, assignment.shiftTemplateId)}</strong>
                <span>{assignment.status} · {assignment.id.slice(0, 8)}</span>
                <span>{assignmentTimeSummary(assignment)}</span>
                 {workforceAssignmentNote(assignment) ? <span>Note ca làm: {workforceAssignmentNote(assignment)}</span> : null}
                {[...roleSummary, ...runningClassRoleSummary].map((item, index) => <span key={`${item}:${index}`}>{item}</span>)}
                {hasOwnerRole ? <span>Chuyển Phụ trách chính ở School → Classes → Sessions trước khi huỷ/đổi ca.</span> : null}
              </div>
              <label className={styles.field}>Sửa Note ca làm
                <textarea rows={2} maxLength={500} value={noteEdits[assignment.id] ?? workforceAssignmentNote(assignment) ?? ""} onChange={(event) => setNoteEdits((draft) => ({...draft,[assignment.id]:event.target.value}))} disabled={!!busy || data.windows?.planning.state === "LOCKED" || !selectedCenter?.canEditPlanning} />
                <small>Chỉ cập nhật ghi chú; không thay đổi giờ, vai trò hoặc lý do huỷ.</small>
              </label>
              <div className={styles.subscriptionActions}>
                <button className={styles.secondaryButton} disabled={!!busy || data.windows?.planning.state === "LOCKED" || !selectedCenter?.canEditPlanning || ((noteEdits[assignment.id] ?? workforceAssignmentNote(assignment) ?? "").trim() || null) === workforceAssignmentNote(assignment)} onClick={() => void saveAssignmentNote(assignment)}>{busy === "note:" + assignment.id ? "Đang lưu…" : "Lưu Note"}</button>
                <button className={styles.secondaryButton} disabled={!reason.trim() || hasOwnerRole || !!busy || data.windows?.planning.state === "LOCKED"} onClick={() => void cancel(assignment)}>{busy === `cancel:${assignment.id}` ? "…" : "Huỷ ca"}</button>
                <button className={styles.primaryButton} disabled={!reason.trim() || (roles.length > 0 || (data.runningClassResponsibilities ?? []).some((role) => role.shiftAssignmentId === assignment.id && role.status === "ACTIVE")) || !templateId || templateId === assignment.shiftTemplateId || !!busy || data.windows?.planning.state === "LOCKED"} onClick={() => void correct(assignment)}>{busy === `correct:${assignment.id}` ? "…" : "Đổi sang ca đã chọn"}</button>
              </div>
            </article>;
          })}

          {historyAssignments.some((item) => item.status === "CANCELLED") ? <div className={styles.plannerHistory}><strong>History</strong>{historyAssignments.filter((item) => item.status === "CANCELLED").map((item) => <span key={item.id}>{templateLabel(data, item.shiftTemplateId)} · CANCELLED{workforceAssignmentNote(item) ? ` · Note: ${workforceAssignmentNote(item)}` : ""}{item.cancellationReason ? ` · Lý do huỷ: ${item.cancellationReason}` : ""}</span>)}</div> : null}
        </>}
    </BoWorkforceWeekPlanner> : null}
    {data?.windows ? <div className={styles.plannerSettings}><details><summary>Kiểm soát tuần</summary><section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>Kiểm soát tuần</h2><p>Policy quyết định auto-lock; override thủ công chỉ áp dụng cho TermWeek này.</p></div><span className={styles.writePill}>Week Control</span></div>
      <div className={styles.plannerFilters}>
        <WindowState label="Đăng ký Staff" value={data.windows.availability} />
        <WindowState label="Xếp ca Manager" value={data.windows.planning} />
        <label className={styles.field}>Lý do<input value={weekControlReason} onChange={(event)=>setWeekControlReason(event.target.value)} placeholder="Bắt buộc khi khóa/mở lại" /></label>
        <label className={styles.field}>Mở lại đến<input type="datetime-local" value={weekControlUntil} onChange={(event)=>setWeekControlUntil(event.target.value)} /></label>
      </div>
      <div className={styles.subscriptionActions}>
        {data.windows.availability.availabilityRegistrationOpen && selectedCenter?.canLockAvailability ? <button className={styles.secondaryButton} disabled={!!busy || !weekControlReason.trim()} onClick={() => void toggleRegistration(false)}>Đóng đăng ký Staff</button> : null}
        {!data.windows.availability.availabilityRegistrationOpen && selectedCenter?.canReopenAvailability ? <button className={styles.primaryButton} disabled={!!busy || !weekControlReason.trim()} onClick={() => void toggleRegistration(true)}>Mở đăng ký Staff</button> : null}
        {data.windows.availability.state === "OPEN" && selectedCenter?.canLockAvailability ? <button className={styles.secondaryButton} disabled={!!busy||!weekControlReason.trim()} onClick={()=>void mutateWeekControl("availability-lock")}>Khóa đăng ký</button> : null}
        {data.windows.availability.reason === "REGISTRATION_CLOSED" ? <span className={styles.readOnly}>Registration của Center Shift Plan đang đóng; mở tại đây trước khi sử dụng temporary reopen.</span> : null}
        {data.windows.availability.state === "LOCKED" && data.windows.availability.reason !== "REGISTRATION_CLOSED" && selectedCenter?.canReopenAvailability ? <button className={styles.secondaryButton} disabled={!!busy||!weekControlReason.trim()||!weekControlUntil} onClick={()=>void mutateWeekControl("availability-reopen")}>Mở lại đăng ký</button> : null}
        {data.windows.planning.state === "OPEN" && selectedCenter?.canPublishPlanning ? <button className={styles.primaryButton} disabled={!!busy||!weekControlReason.trim()} onClick={()=>void mutateWeekControl("planning-publish")}>Chốt xếp ca</button> : null}
        {data.windows.planning.state === "LOCKED" && selectedCenter?.canReopenPlanning ? <button className={styles.primaryButton} disabled={!!busy||!weekControlReason.trim()||!weekControlUntil} onClick={()=>void mutateWeekControl("planning-reopen")}>Mở khóa xếp ca</button> : null}
      </div>
    </section></details></div> : null}

    <div className={styles.plannerSettings}><details><summary>Quản lý mẫu ca</summary>{selectedCenter?.canManageShiftTemplates ? <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>Shift Templates</h2><p>Tạo loại ca theo Center. Template đã dùng không sửa giờ trực tiếp; hãy tạo template mới rồi ngưng template cũ.</p></div><span className={styles.writePill}>workforce.shift_template.manage</span></div>
      <div className={styles.plannerFilters}>
        <label className={styles.field}>Code<input value={templateDraft.code} onChange={(event) => setTemplateDraft((current) => ({ ...current, code: event.target.value }))} placeholder="EVENING" /></label>
        <label className={styles.field}>Tên ca<input value={templateDraft.displayLabel} onChange={(event) => setTemplateDraft((current) => ({ ...current, displayLabel: event.target.value }))} placeholder="Ca tối" /></label>
        <label className={styles.field}>Bắt đầu<input type="time" value={templateDraft.startLocalTime} onChange={(event) => setTemplateDraft((current) => ({ ...current, startLocalTime: event.target.value }))} /></label>
        <label className={styles.field}>Kết thúc<input type="time" value={templateDraft.endLocalTime} onChange={(event) => setTemplateDraft((current) => ({ ...current, endLocalTime: event.target.value }))} /></label>
      </div>
      <div className={styles.subscriptionActions}><button className={styles.primaryButton} disabled={!!busy || !templateDraft.code.trim() || !templateDraft.displayLabel.trim() || !templateDraft.startLocalTime || !templateDraft.endLocalTime} onClick={() => void createShiftTemplate()}>{busy === "template:create" ? "Đang tạo…" : "+ Tạo ca"}</button></div>
      <div className={styles.plannerHistory}>{shiftTemplates.map((template) => <span key={template.id}><strong>{template.displayLabel}</strong> · {template.code} · {template.startLocalTime}–{template.endLocalTime} · {template.status} <button className={styles.secondaryButton} disabled={!!busy} onClick={() => void setShiftTemplateStatus(template, template.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>{template.status === "ACTIVE" ? "Ngưng" : "Kích hoạt"}</button></span>)}</div>
    </section> : selectedCenter ? <section className={styles.panel}><div className={styles.panelHeading}><div><h2>Shift Templates</h2><p>Bạn có thể xếp ca bằng các template đang active; quản lý template cần quyền workforce.shift_template.manage.</p></div><span className={styles.readOnly}>Read only</span></div></section> : null}</details></div>

  </div>;
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
function WindowState({label,value}:{label:string;value:NonNullable<BoWorkforceWeeklyPlanning["windows"]>["availability"]}) {
  const detail=value.reason==="CONFIGURATION_UNAVAILABLE"?"Chưa có policy hiệu lực":value.reason==="MANUAL_LOCK"?"Khóa thủ công":value.reason==="MANUAL_REOPEN"?`Mở lại đến ${value.overrideUntil?new Date(value.overrideUntil).toLocaleString("vi-VN"):"—"}`:value.cutoffAt?`Policy · ${new Date(value.cutoffAt).toLocaleString("vi-VN")}`:"Policy · không auto-lock";
  return <div className={styles.plannerWindowCard}><div><strong>{label}</strong><BoDataGridStatus value={value.state} tone={value.state==="OPEN"?"success":"warning"} /></div><span>{detail}</span></div>;
}
function message(error: unknown) {
  if (error instanceof BoApiError) return `${error.message}${error.requestId ? ` · ${error.requestId}` : ""}`;
  return error instanceof Error ? error.message : "Workforce planning command failed.";
}
