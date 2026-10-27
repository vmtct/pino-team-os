"use client";

import { useEffect, useState } from "react";
import { BoDataGridState, BoDataGridStatus } from "@/app/bo/components/data-grid";
import { workforceRead, type GlobalWeekResult } from "@/app/bo/architecture/workforce-read-client";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoWorkforceAssignment, BoWorkforcePlanningBootstrap, BoWorkforceShiftTemplate, BoWorkforceWeeklyPlanning } from "@/lib/bo-model";
import { correctWorkforceAssignment } from "@/lib/workforce-planning-correction";
import { assignmentRoleSummary, hasOwnerTeacherLinkGap } from "@/lib/workforce-planning-role-summary";
import { assignmentTimeSummary, canUseTeachingSessionTime, learningOwnerBlocksShiftCancellation, type WorkforceShiftCoverageMode } from "@/lib/workforce-planning-time-basis";
import styles from "../bo.module.css";

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: BoWorkforceWeeklyPlanning };
type Selection = { staffMemberId: string; workDate: string } | null;
type CenterWeek = GlobalWeekResult["termWeeks"][number];

export function WorkforcePlanningView({ embedded = false, scope }: { embedded?: boolean; scope?: { centerId: string; termWeekId: string } } = {}) {
  const [bootstrap, setBootstrap] = useState<BoWorkforcePlanningBootstrap | null>(null);
  const [centerId, setCenterId] = useState("");
  const [termWeekId, setTermWeekId] = useState("");
  const [centerWeeks, setCenterWeeks] = useState<CenterWeek[]>([]);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffFilter, setStaffFilter] = useState<"ALL"|"ASSIGNED"|"AVAILABLE"|"EMPTY">("ALL");
  const [planning, setPlanning] = useState<Load>({ state: "loading" });
  const [selection, setSelection] = useState<Selection>(null);
  const [templateId, setTemplateId] = useState("");
  const [frontDesk, setFrontDesk] = useState(false);
  const [shiftLeader, setShiftLeader] = useState(false);
  const [teacherSessionIds, setTeacherSessionIds] = useState<string[]>([]);
  const [teacherRunningClassIds, setTeacherRunningClassIds] = useState<string[]>([]);
  const [assistantRunningClassIds, setAssistantRunningClassIds] = useState<string[]>([]);
  const [primarySessionIds, setPrimarySessionIds] = useState<string[]>([]);
  const [coverageMode, setCoverageMode] = useState<WorkforceShiftCoverageMode>("FULL_SHIFT");
  const [customStartLocal, setCustomStartLocal] = useState("");
  const [customEndLocal, setCustomEndLocal] = useState("");
  const [handoffReasons, setHandoffReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
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
  const activeAssignmentsAll = data?.assignments.filter(item=>item.status==="ACTIVE") ?? [];
  const assignedStaff = new Set(activeAssignmentsAll.map(item=>item.staffMemberId));
  const submittedStaff = new Set((data?.availability ?? []).filter(item=>item.status==="SUBMITTED"&&item.items.length>0).map(item=>item.staffMemberId));
  const assignedDates = new Set(activeAssignmentsAll.map(item=>item.workDate));
  const staffRows = (data?.staff ?? []).filter(staff => {
    if(!staff.displayLabel.toLocaleLowerCase("vi").includes(staffSearch.trim().toLocaleLowerCase("vi")))return false;
    const hasAssignment=assignedStaff.has(staff.id), hasSubmitted=submittedStaff.has(staff.id);
    return staffFilter==="ALL" || (staffFilter==="ASSIGNED"&&hasAssignment) || (staffFilter==="AVAILABLE"&&hasSubmitted&&!hasAssignment) || (staffFilter==="EMPTY"&&!hasAssignment&&!hasSubmitted);
  });
  const selectedStaff = data?.staff.find((staff) => staff.id === selection?.staffMemberId) ?? null;
  const activeAssignments = data && selection ? data.assignments.filter((item) => item.staffMemberId === selection.staffMemberId && item.workDate === selection.workDate && item.status === "ACTIVE") : [];
  const historyAssignments = data && selection ? data.assignments.filter((item) => item.staffMemberId === selection.staffMemberId && item.workDate === selection.workDate) : [];
  const availableTemplateIds = data && selection ? new Set(data.availability.filter((item) => item.staffMemberId === selection.staffMemberId).flatMap((item) => item.items.filter((entry) => entry.workDate === selection.workDate).map((entry) => entry.shiftTemplateId))) : new Set<string>();
  const selectedAvailabilityHistory = data && selection ? data.availabilityHistory.filter((item) => item.staffMemberId === selection.staffMemberId) : [];
  const selectedTemplate = data?.templates.find((template) => template.id === templateId) ?? null;
  const eligibleSessions = data && selection && selectedTemplate
    ? data.sessions.filter((session) =>
        session.status !== "CANCELLED"
        && session.localDate === selection.workDate
        && session.scheduledStartsLocal.slice(11, 16) >= selectedTemplate.startLocalTime
        && session.scheduledEndsLocal.slice(11, 16) <= selectedTemplate.endLocalTime
      )
    : [];
  const selectedActiveRoleAssignments = data
    ? data.roleAssignments.filter((role) => activeAssignments.some((assignment) => assignment.id === role.shiftAssignmentId) && role.status === "ACTIVE")
    : [];
  const canUseTeachingTime = canUseTeachingSessionTime({ frontDesk, teacherSessionCount: teacherSessionIds.length + teacherRunningClassIds.length + assistantRunningClassIds.length });
  const customRangeReady = coverageMode !== "CUSTOM_RANGE" || (!!customStartLocal && !!customEndLocal && customStartLocal < customEndLocal);
  const handoffReasonMissing = data && selection
    ? primarySessionIds.some((sessionId) => {
        const owner = data.sessions.find((session) => session.id === sessionId)?.learningOwner;
        return !!owner && owner.staffMemberId !== selection.staffMemberId && !handoffReasons[sessionId]?.trim();
      })
    : false;

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
    const roles = [
      ...(frontDesk ? [{ roleType: "FRONT_DESK" as const }] : []),
      ...(shiftLeader ? [{ roleType: "SHIFT_LEADER" as const }] : []),
      ...teacherRunningClassIds.map((runningClassId) => ({ roleType: "TEACHER" as const, runningClassId })),
      ...assistantRunningClassIds.map((runningClassId) => ({ roleType: "TEACHING_ASSISTANT" as const, runningClassId })),
      ...teacherSessionIds.map((sessionId) => {
        const session = data.sessions.find((item) => item.id === sessionId);
        const makeLearningOwner = primarySessionIds.includes(sessionId);
        return {
          roleType: "TEACHER" as const,
          sessionId,
          makeLearningOwner,
          ...(makeLearningOwner && session?.learningOwner ? { expectedLearningOwnerVersion: session.learningOwner.version } : {}),
          ...(makeLearningOwner && session?.learningOwner?.staffMemberId !== selection.staffMemberId
            ? { learningOwnerHandoffReason: handoffReasons[sessionId]?.trim() || null }
            : {}),
        };
      }),
    ];
    if (!roles.length) { setNotice("Chọn ít nhất Front Desk, Shift Leader, Teacher hoặc Teaching Assistant."); return; }
    if (handoffReasonMissing) { setNotice("Cần nhập lý do bàn giao cho lớp đang có Phụ trách chính khác."); return; }
    if (coverageMode === "CLASSROOM_TIME" && !canUseTeachingTime) { setNotice("Theo giờ lớp cần ít nhất một lớp Teacher hoặc Teaching Assistant."); return; }
    if (coverageMode === "CUSTOM_RANGE" && (!selectedTemplate || !customStartLocal || !customEndLocal || customEndLocal <= customStartLocal || customStartLocal < selectedTemplate.startLocalTime || customEndLocal > selectedTemplate.endLocalTime)) { setNotice("Khung giờ tuỳ chỉnh phải nằm trọn trong ca và giờ kết thúc phải sau giờ bắt đầu."); return; }
    if (coverageMode === "CUSTOM_RANGE" && eligibleSessions.filter((session)=>teacherSessionIds.includes(session.id)||(!!session.runningClassId&&(teacherRunningClassIds.includes(session.runningClassId)||assistantRunningClassIds.includes(session.runningClassId)))).some((session)=>session.scheduledStartsLocal.slice(11,16)<customStartLocal||session.scheduledEndsLocal.slice(11,16)>customEndLocal)) { setNotice("Khung giờ tuỳ chỉnh phải bao phủ toàn bộ lớp Teacher và Teaching Assistant đã phân công."); return; }
    setBusy("assign"); setNotice("");
    try {
      await boApi.planOperationalWorkforceShift({
        staffMemberId: selection.staffMemberId, centerId: data.centerId, workDate: selection.workDate,
        shiftTemplateId: templateId, coverageMode, ...(coverageMode === "CUSTOM_RANGE" ? { customStartLocal, customEndLocal } : {}), termWeekId: data.termWeekId, roles,
      }, crypto.randomUUID());
      setNotice("Ca và phân công operational đã được chốt.");
      setFrontDesk(false); setShiftLeader(false); setTeacherSessionIds([]); setTeacherRunningClassIds([]); setAssistantRunningClassIds([]); setPrimarySessionIds([]); setCoverageMode("FULL_SHIFT"); setCustomStartLocal(""); setCustomEndLocal(""); setHandoffReasons({});
      await refresh();
    } catch (error) { setNotice(message(error)); } finally { setBusy(""); }
  }

  function toggleTeacher(sessionId: string, enabled: boolean) {
    setTeacherSessionIds((current) => {
      const next = enabled ? [...new Set([...current, sessionId])] : current.filter((id) => id !== sessionId);
      if (!enabled && next.length === 0 && assistantRunningClassIds.length === 0 && teacherRunningClassIds.length === 0 && coverageMode === "CLASSROOM_TIME") setCoverageMode("FULL_SHIFT");
      return next;
    });
    if (!enabled) {
      setPrimarySessionIds((current) => current.filter((id) => id !== sessionId));
      setHandoffReasons((current) => { const next = { ...current }; delete next[sessionId]; return next; });
    }
  }

  function togglePrimary(sessionId: string, enabled: boolean) {
    if (enabled) setTeacherSessionIds((current) => [...new Set([...current, sessionId])]);
    setPrimarySessionIds((current) => enabled ? [...new Set([...current, sessionId])] : current.filter((id) => id !== sessionId));
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
    </section> : <div className={styles.plannerToolbar}>
      <span className={styles.plannerToolbarResult}>Tuần {data ? data.startDate + " → " + data.endDate : "đang tải…"}</span>
      <button type="button" className={styles.secondaryButton} aria-label="Làm mới lịch tuần" onClick={() => void refresh()}>↻ Làm mới lịch</button>
    </div>}

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

    {notice ? <div className={styles.successCard}><span>Workforce planner</span><strong>{notice}</strong></div> : null}
    {planning.state === "loading" ? <section className={styles.plannerStateSurface}><BoDataGridState kind="loading" message="Đang tải weekly planning projection từ Core…" /></section> : null}
    {planning.state === "error" ? <section className={styles.plannerStateSurface}><BoDataGridState kind="error" message={planning.message} /></section> : null}

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

    {data ? <div className={styles.plannerSummary} aria-label="Thống kê lịch tuần">
      <div><span>Nhân sự</span><strong>{data.staff.length}</strong></div>
      <div><span>Đã phân công</span><strong>{activeAssignmentsAll.length}</strong></div>
      <div><span>Đã đăng ký, chờ xếp</span><strong>{[...submittedStaff].filter(id=>!assignedStaff.has(id)).length}</strong></div>
      <div><span>Ngày cần kiểm tra</span><strong>{dateRange(data).filter(day=>!assignedDates.has(day)).length}</strong></div>
    </div> : null}
    {data ? <div className={styles.plannerSearchBar}>
      <label htmlFor="wf-staff-search">Nhân sự <input id="wf-staff-search" className="edit-input" type="search" placeholder="Tìm nhân sự…" value={staffSearch} onChange={event=>setStaffSearch(event.target.value)} /></label>
      <label htmlFor="wf-staff-filter">Tình trạng <select id="wf-staff-filter" className="edit-input" value={staffFilter} onChange={event=>setStaffFilter(event.target.value as typeof staffFilter)}>
        <option value="ALL">Tất cả nhân sự</option><option value="ASSIGNED">Đã phân công</option>
        <option value="AVAILABLE">Đã đăng ký, chờ xếp</option><option value="EMPTY">Chưa có lịch</option>
      </select></label>
      <span role="status">{staffRows.length} / {data.staff.length} nhân sự</span>
      <div className={styles.plannerStatusLegend}><span>● Đã phân công</span><span>● Đã đăng ký</span><span>● Đang chọn</span></div>
    </div> : null}
    {data ? <div className={styles.plannerLayout}>
      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div><h2>{data.startDate} → {data.endDate}</h2><p>Chọn một ô Staff/ngày để mở bounded operational detail; matrix vẫn là specialized scheduling surface.</p></div>
          <span className={styles.readOnly}>{staffRows.length} nhân sự</span>
        </div>
        <div className={styles.plannerTableWrap}>
          <table aria-label="Weekly Workforce planning matrix">
            <thead><tr><th>Staff</th>{dateRange(data).map((date) => <th key={date}>{dateLabel(date)}</th>)}</tr></thead>
            <tbody>{staffRows.map((staff) => <tr key={staff.id}>
              <th>{staff.displayLabel}</th>
              {dateRange(data).map((date) => {
                const assigned = data.assignments.filter((item) => item.staffMemberId === staff.id && item.workDate === date && item.status === "ACTIVE");
                const available = data.availability.some((item) => item.staffMemberId === staff.id && item.status === "SUBMITTED" && item.items.some((entry) => entry.workDate === date));
                const ownerGap = hasOwnerTeacherLinkGap(data, staff.id, date);
                const selected = selection?.staffMemberId === staff.id && selection.workDate === date;
                return <td key={date}>
                  <button
                    className={`${styles.plannerCell} ${selected ? styles.plannerCellActive : ""}`}
                    aria-pressed={selected}
                    aria-controls="workforce-planner-detail"
                    aria-label={`${staff.displayLabel} · ${dateLabel(date)} · ${assigned.length ? "Đã xếp" : ownerGap ? "Owner chưa link TE" : available ? "Có availability" : "Chưa xếp"}`}
                    onClick={() => {
                    setSelection({ staffMemberId: staff.id, workDate: date });
                    setTemplateId(assigned[0]?.shiftTemplateId ?? "");
                    setReason("");
                    setFrontDesk(false);
                    setShiftLeader(false);
                    setTeacherRunningClassIds([]);
                    setAssistantRunningClassIds([]);
                    setCoverageMode(assigned[0]?.coverageMode ?? (assigned[0]?.timeBasis === "TEACHING_SESSIONS" ? "CLASSROOM_TIME" : "FULL_SHIFT"));
                    setCustomStartLocal(assigned[0]?.effectiveStartLocal?.slice(11,16) ?? "");
                    setCustomEndLocal(assigned[0]?.effectiveEndLocal?.slice(11,16) ?? "");
                    setTeacherSessionIds([]);
                    setPrimarySessionIds([]);
                    setHandoffReasons({});
                  }}>
                    {assigned.length ? <><strong className={styles.plannerAssignedChip}>Đã phân công</strong>{assigned.map((item) => {
                      const summary = assignmentRoleSummary(data, item);
                      return <span key={item.id}>{templateLabel(data, item.shiftTemplateId)} · {summary} · {assignmentTimeSummary(item)}</span>;
                    })}{ownerGap ? <span>⚠ Owner chưa link TE</span> : null}</> : ownerGap ? <><strong>⚠ Owner</strong><span>Chưa có TE/ca tương ứng</span></> : available ? <><strong className={styles.plannerAvailableChip}>Đã đăng ký</strong><span>{availableCount(data, staff.id, date)} ca</span></> : <span>—</span>}
                  </button>
                </td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <aside id="workforce-planner-detail" className={styles.plannerSide} aria-label="Workforce planning detail" aria-live="polite">
        {!selection || !selectedStaff ? <BoDataGridState kind="empty" title="Chọn Staff/ngày" message="Chọn một ô trong matrix để mở thao tác assign, cancel hoặc correct." /> : <>
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
            <select value={templateId} onChange={(event) => {
              setTemplateId(event.target.value);
              setCoverageMode("FULL_SHIFT");
              setCustomStartLocal(""); setCustomEndLocal("");
              setTeacherSessionIds([]);
              setTeacherRunningClassIds([]);
              setAssistantRunningClassIds([]);
              setPrimarySessionIds([]);
              setHandoffReasons({});
            }}>
              <option value="">Chọn ca…</option>
              {data.templates.map((template) => <option key={template.id} value={template.id}>{availableTemplateIds.has(template.id) ? "✓ " : ""}{template.displayLabel} · {template.startLocalTime}–{template.endLocalTime}</option>)}
            </select>
            <small>✓ = Staff đã submit availability. Manager vẫn là authority xếp ca final.</small>
          </label>

          {!activeAssignments.length && templateId ? <div className={styles.plannerHistory}>
            <strong>Phân công operational</strong>
            <label className={styles.field}>
              <span><input type="checkbox" checked={frontDesk} onChange={(event) => { const checked=event.target.checked; setFrontDesk(checked);  }} /> Front Desk</span>
              <small>Front Desk áp dụng cho toàn ca; khoảng Session Teacher sẽ được ưu tiên tự động.</small>
            </label>
            <label className={styles.field}><span><input type="checkbox" checked={shiftLeader} onChange={(event) => setShiftLeader(event.target.checked)} /> Shift Leader</span><small>Phụ trách ca tại trung tâm; không gắn lớp học.</small></label>
            <div className={styles.plannerHistory}>
              <strong>Giờ làm Manager chốt</strong>
              <label><input type="radio" name="coverage-mode" checked={coverageMode==="FULL_SHIFT"} onChange={() => setCoverageMode("FULL_SHIFT")} /> Toàn ca · {selectedTemplate?.startLocalTime}–{selectedTemplate?.endLocalTime}</label>
              <label><input type="radio" name="coverage-mode" checked={coverageMode==="CLASSROOM_TIME"} disabled={!canUseTeachingTime} onChange={() => setCoverageMode("CLASSROOM_TIME")} /> Theo giờ lớp</label>
              <label><input type="radio" name="coverage-mode" checked={coverageMode==="CUSTOM_RANGE"} onChange={() => { setCoverageMode("CUSTOM_RANGE"); if(!customStartLocal)setCustomStartLocal(selectedTemplate?.startLocalTime??""); if(!customEndLocal)setCustomEndLocal(selectedTemplate?.endLocalTime??""); }} /> Tuỳ chỉnh khung giờ</label>
              {coverageMode === "CUSTOM_RANGE" ? <div className={styles.subscriptionActions}><label className={styles.field}>Bắt đầu<input type="time" value={customStartLocal} min={selectedTemplate?.startLocalTime} max={selectedTemplate?.endLocalTime} onChange={(event)=>setCustomStartLocal(event.target.value)} /></label><label className={styles.field}>Kết thúc<input type="time" value={customEndLocal} min={selectedTemplate?.startLocalTime} max={selectedTemplate?.endLocalTime} onChange={(event)=>setCustomEndLocal(event.target.value)} /></label></div> : null}
              <small>Staff vẫn đăng ký availability theo toàn ca. Chỉ Manager chốt coverage thực tế; custom phải bao phủ mọi lớp đã phân công.</small>
            </div>
            <div className={styles.plannerHistory}>
              <strong>Lớp phụ trách</strong>
              {eligibleSessions.length ? eligibleSessions.map((session) => {
                const teacher = teacherSessionIds.includes(session.id);
                const primary = primarySessionIds.includes(session.id);
                const owner = session.learningOwner;
                const ownerLabel = owner ? data.staff.find((staff) => staff.id === owner.staffMemberId)?.displayLabel ?? owner.staffMemberId.slice(0, 8) : null;
                const requiresHandoff = primary && !!owner && owner.staffMemberId !== selection.staffMemberId;
                return <article className={styles.plannerAssignmentCard} key={session.id}>
                  <div>
                    <strong>{session.runningClassDisplayName ?? "Session"} · {session.scheduledStartsLocal.slice(11, 16)}–{session.scheduledEndsLocal.slice(11, 16)}</strong>
                    <span>{ownerLabel ? "Phụ trách chính hiện tại: " + ownerLabel : "Chưa có Phụ trách chính"}</span>
                  </div>
                  <label><input type="checkbox" checked={teacher} onChange={(event) => toggleTeacher(session.id, event.target.checked)} /> Teacher</label>
                  {session.runningClassId ? <label><input type="checkbox" checked={teacherRunningClassIds.includes(session.runningClassId)} onChange={(event) => { const id = session.runningClassId; if (!id) return; setTeacherRunningClassIds((current) => event.target.checked ? [...new Set([...current, id])] : current.filter((item) => item !== id)); }} /> Teacher · RunningClass</label> : null}
                  {session.runningClassId ? <label><input type="checkbox" checked={assistantRunningClassIds.includes(session.runningClassId)} onChange={(event) => { const id = session.runningClassId; if (!id) return; setAssistantRunningClassIds((current) => event.target.checked ? [...new Set([...current, id])] : current.filter((item) => item !== id)); }} /> Teaching Assistant · RunningClass</label> : null}
                  <label><input type="checkbox" checked={primary} disabled={!session.canAssignLearningOwner} onChange={(event) => togglePrimary(session.id, event.target.checked)} /> Phụ trách chính</label>
                  {!session.canAssignLearningOwner ? <span>Không có quyền phân công Learning Owner cho lớp này.</span> : null}
                  {requiresHandoff ? <label className={styles.field}>Lý do bàn giao
                    <input value={handoffReasons[session.id] ?? ""} onChange={(event) => setHandoffReasons((current) => ({ ...current, [session.id]: event.target.value }))} placeholder={"Chuyển từ " + ownerLabel + " sang " + selectedStaff.displayLabel} />
                  </label> : null}
                </article>;
              }) : <span>Không có Session nào trong đúng ngày và khung giờ của ca đã chọn.</span>}
            </div>
          </div> : null}

          {!activeAssignments.length ? <button className={styles.primaryButton} disabled={!templateId || (!frontDesk && !shiftLeader && !teacherSessionIds.length && !teacherRunningClassIds.length && !assistantRunningClassIds.length) || handoffReasonMissing || !customRangeReady || !!busy || data.windows?.planning.state === "LOCKED"} onClick={() => void assign()}>{busy === "assign" ? "Đang xếp…" : "Xác nhận ca & phân công"}</button> : null}

          {activeAssignments.length ? <label className={styles.field}>Lý do thay đổi
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Bắt buộc khi huỷ hoặc điều chỉnh" />
            <small>Lý do được gửi vào canonical assignment audit; không dùng ghi chú cục bộ ở BO.</small>
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
                {[...roleSummary, ...runningClassRoleSummary].map((item, index) => <span key={`${item}:${index}`}>{item}</span>)}
                {hasOwnerRole ? <span>Chuyển Phụ trách chính ở School → Classes → Sessions trước khi huỷ/đổi ca.</span> : null}
              </div>
              <div className={styles.subscriptionActions}>
                <button className={styles.secondaryButton} disabled={!reason.trim() || hasOwnerRole || !!busy || data.windows?.planning.state === "LOCKED"} onClick={() => void cancel(assignment)}>{busy === `cancel:${assignment.id}` ? "…" : "Huỷ ca"}</button>
                <button className={styles.primaryButton} disabled={!reason.trim() || (roles.length > 0 || (data.runningClassResponsibilities ?? []).some((role) => role.shiftAssignmentId === assignment.id && role.status === "ACTIVE")) || !templateId || templateId === assignment.shiftTemplateId || !!busy || data.windows?.planning.state === "LOCKED"} onClick={() => void correct(assignment)}>{busy === `correct:${assignment.id}` ? "…" : "Đổi sang ca đã chọn"}</button>
              </div>
            </article>;
          })}

          {historyAssignments.some((item) => item.status === "CANCELLED") ? <div className={styles.plannerHistory}><strong>History</strong>{historyAssignments.filter((item) => item.status === "CANCELLED").map((item) => <span key={item.id}>{templateLabel(data, item.shiftTemplateId)} · CANCELLED{item.cancellationReason ? ` · ${item.cancellationReason}` : ""}</span>)}</div> : null}
        </>}
      </aside>
    </div> : null}
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
function availableCount(data: BoWorkforceWeeklyPlanning, staffId: string, date: string) {
  return new Set(data.availability.filter((item) => item.staffMemberId === staffId).flatMap((item) => item.items.filter((entry) => entry.workDate === date).map((entry) => entry.shiftTemplateId))).size;
}
function WindowState({label,value}:{label:string;value:NonNullable<BoWorkforceWeeklyPlanning["windows"]>["availability"]}) {
  const detail=value.reason==="CONFIGURATION_UNAVAILABLE"?"Chưa có policy hiệu lực":value.reason==="MANUAL_LOCK"?"Khóa thủ công":value.reason==="MANUAL_REOPEN"?`Mở lại đến ${value.overrideUntil?new Date(value.overrideUntil).toLocaleString("vi-VN"):"—"}`:value.cutoffAt?`Policy · ${new Date(value.cutoffAt).toLocaleString("vi-VN")}`:"Policy · không auto-lock";
  return <div className={styles.plannerWindowCard}><div><strong>{label}</strong><BoDataGridStatus value={value.state} tone={value.state==="OPEN"?"success":"warning"} /></div><span>{detail}</span></div>;
}
function message(error: unknown) {
  if (error instanceof BoApiError) return `${error.message}${error.requestId ? ` · ${error.requestId}` : ""}`;
  return error instanceof Error ? error.message : "Workforce planning command failed.";
}
