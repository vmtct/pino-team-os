"use client";

import { useEffect, useMemo, useState } from "react";
import { TosShell } from "@/app/components/tos-shell";
import { boApi } from "@/lib/bo-api";
import type { BoStaffRecord } from "@/lib/bo-model";
import type { TrainingAssignmentDetail, TrainingDraftInput, TrainingModule, TrainingModuleVersion, TrainingSelfProjection } from "@/lib/training-model";
import { workforceTraining } from "@/lib/workforce-training-client";
import styles from "./training.module.css";

const trainingFooter = [
  { id: "path", label: "Lộ trình", href: "/training", icon: "◎" },
  { id: "skills", label: "Chứng nhận", href: "/training#skills", icon: "◆" },
] as const;

function progressOf(detail: TrainingAssignmentDetail) {
  const total = detail.version.lessons.length;
  return total ? Math.round(detail.completedLessonKeys.length * 100 / total) : 0;
}

function assignmentLabel(detail: TrainingAssignmentDetail) {
  if (detail.assignment.status === "COMPLETED") return "Đã đạt";
  if (detail.assignment.status === "COMPLETION_PENDING") return "Chờ sign-off";
  if (detail.latestAssessment && !detail.latestAssessment.passed) return "Cần đạt assessment";
  return detail.assignment.status === "ASSIGNED" ? "Chưa bắt đầu" : "Đang học";
}
export function TrainingStaffRuntimeView() {
  const [data, setData] = useState<TrainingSelfProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});

  async function refresh() {
    setError("");
    try { setData(await workforceTraining.self()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải training."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  async function continueAssignment(detail: TrainingAssignmentDetail) {
    const nextLesson = detail.version.lessons.find((lesson) => !detail.completedLessonKeys.includes(lesson.key));
    setBusy(detail.assignment.id); setError("");
    try {
      if (nextLesson) await workforceTraining.completeLesson(detail.assignment.id, nextLesson.key);
      else if (detail.version.assessmentThreshold !== null && detail.latestAssessment?.passed !== true) {
        await workforceTraining.submitAssessment(detail.assignment.id, scores[detail.assignment.id] ?? detail.version.assessmentThreshold);
      }
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể cập nhật training."); }
    finally { setBusy(""); }
  }
  const assignments = data?.assignments ?? [];
  const activeQualifications = (data?.qualifications ?? []).filter((item) => item.status === "ACTIVE");
  const expectedQualifications = new Set(assignments.map((item) => item.version.qualificationCode).filter(Boolean));
  const content = (
    <div className={styles.staffPage}>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div><p className={styles.eyebrow}>My learning path</p><h2>Skill Passport</h2><p>Training và qualification được đọc trực tiếp từ Core.</p></div>
          <div className={styles.score}><div><strong>{activeQualifications.length}/{Math.max(activeQualifications.length, expectedQualifications.size)}</strong><span>qualified</span></div></div>
        </div>
        <div className={styles.progressTrack}><i style={{ width: `${assignments.length ? Math.round(assignments.filter((item) => item.assignment.status === "COMPLETED").length * 100 / assignments.length) : 0}%` }} /></div>
        <div className={styles.heroMeta}><span>{assignments.length} module được giao</span><span>{assignments.filter((item) => item.assignment.status !== "COMPLETED").length} cần làm</span><span>{activeQualifications.length} qualification active</span></div>
      </section>

      {loading ? <div className={styles.notice}>Đang tải Skill Passport…</div> : null}
      {error ? <div className={styles.notice}>{error}</div> : null}
      <div className={styles.sectionHead}><div><h3>Việc cần học</h3><p>Luôn bám exact published ModuleVersion được giao.</p></div><span>{assignments.length} modules</span></div>
      <section className={styles.moduleList}>
        {assignments.map((detail) => {
          const progress = progressOf(detail);
          const needsAssessment = detail.completedLessonKeys.length === detail.version.lessons.length && detail.version.assessmentThreshold !== null && detail.latestAssessment?.passed !== true;
          return <article key={detail.assignment.id} className={styles.moduleCard}>
            <div className={styles.moduleTop}>
              <div className={styles.moduleIcon}>✦</div>
              <div className={styles.moduleCopy}><strong>{detail.version.title}</strong><small>{detail.version.summary ?? `${detail.version.track ?? "Staff"} training`}</small></div>
              <span className={`${styles.badge} ${detail.assignment.status === "COMPLETED" ? styles.badgeDone : styles.badgeRequired}`}>{assignmentLabel(detail)}</span>
            </div>
            <div className={styles.moduleProgress}><div className={styles.moduleProgressTrack}><i style={{ width: `${progress}%` }} /></div><small>{progress}%</small></div>
            {needsAssessment ? <div className={styles.field}><label>Assessment score</label><input type="number" min={0} max={100} value={scores[detail.assignment.id] ?? detail.version.assessmentThreshold ?? 80} onChange={(event) => setScores((value) => ({ ...value, [detail.assignment.id]: Number(event.target.value) }))} /></div> : null}
            {detail.assignment.status !== "COMPLETED" && detail.assignment.status !== "COMPLETION_PENDING" ? <div className={styles.actionRow}><button className={styles.primaryBtn} type="button" disabled={busy === detail.assignment.id} onClick={() => void continueAssignment(detail)}>{busy === detail.assignment.id ? "Đang lưu…" : needsAssessment ? "Nộp assessment" : "Tiếp tục học"}</button></div> : null}
          </article>;
        })}
        {!loading && assignments.length === 0 ? <div className={styles.notice}>Chưa có training nào được giao.</div> : null}
      </section>
      <div id="skills" className={styles.sectionHead}><div><h3>Chứng nhận của tôi</h3><p>Qualification truth từ Core, không suy ra từ UI.</p></div></div>
      <section className={styles.skillGrid}>
        {(data?.qualifications ?? []).map((qualification) => <article className={styles.skillCard} key={qualification.id}>
          <strong>{qualification.qualificationCode}</strong>
          <small>Nguồn: assignment {qualification.sourceAssignmentId.slice(-8)} · {new Date(qualification.grantedAt).toLocaleDateString("vi-VN")}</small>
          <span className={styles.skillStamp}>{qualification.status === "ACTIVE" ? "● VERIFIED" : qualification.status}</span>
        </article>)}
      </section>
    </div>
  );
  return <TosShell title="Học & Chứng nhận" subtitle="Skill Passport của bạn" theme="tasks" footerItems={[...trainingFooter]} activeFooterId="path">{content}</TosShell>;
}

const initialDraft: TrainingDraftInput = {
  title: "Classroom Diary & Closing",
  summary: "Staff hoàn tất closing flow, ghi Classroom Diary đúng evidence và biết khi nào cần escalation.",
  track: "MENTOR",
  lessons: [
    { key: "why-diary", title: "Vì sao Classroom Diary tồn tại", kind: "READ", estimatedMinutes: 8 },
    { key: "closing", title: "Checklist trước khi đóng Session", kind: "CHECKLIST", estimatedMinutes: 8 },
  ],
  assessmentThreshold: 80,
  requiresSignoff: true,
  qualificationCode: "CLASSROOM_OPERATOR",
  policyReference: null,
};
export function TrainingBuilderRuntimeView() {
  const [catalog, setCatalog] = useState<TrainingModule[]>([]);
  const [staff, setStaff] = useState<BoStaffRecord[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [staffAssignments, setStaffAssignments] = useState<TrainingAssignmentDetail[]>([]);
  const [moduleKey, setModuleKey] = useState("classroom-diary-closing");
  const [draft, setDraft] = useState<TrainingDraftInput>(initialDraft);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedModule = catalog.find((item) => item.id === selectedModuleId) ?? null;
  const selectedDraft = selectedModule?.versions.find((item) => item.status === "DRAFT") ?? null;
  const selectedPublished = selectedModule?.versions.find((item) => item.status === "PUBLISHED") ?? null;
  const duration = useMemo(() => draft.lessons.reduce((sum, lesson) => sum + (lesson.estimatedMinutes ?? 0), 0), [draft.lessons]);

  async function refreshCatalog(preferId = selectedModuleId) {
    const [modules, people] = await Promise.all([boApi.trainingCatalog(), boApi.staffRecords()]);
    setCatalog(modules); setStaff(people.filter((item) => item.status === "active"));
    const nextId = preferId && modules.some((item) => item.id === preferId) ? preferId : modules[0]?.id ?? "";
    setSelectedModuleId(nextId);
    if (!selectedStaffId && people[0]) setSelectedStaffId(people[0].id);
  }

  useEffect(() => {
    let current = true;
    void Promise.all([boApi.trainingCatalog(), boApi.staffRecords()]).then(([modules, people]) => {
      if (!current) return;
      setCatalog(modules); setStaff(people.filter((item) => item.status === "active"));
      setSelectedModuleId(modules[0]?.id ?? ""); setSelectedStaffId(people.find((item) => item.status === "active")?.id ?? "");
    }).catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : "Không thể tải Training."); });
    return () => { current = false; };
  }, []);
  useEffect(() => {
    const version = selectedDraft ?? selectedPublished;
    if (!version) return;
    setModuleKey(selectedModule?.moduleKey ?? "");
    setDraft({ title: version.title, summary: version.summary, track: version.track, lessons: version.lessons, assessmentThreshold: version.assessmentThreshold, requiresSignoff: version.requiresSignoff, qualificationCode: version.qualificationCode, policyReference: version.policyReference });
  }, [selectedModule?.moduleKey, selectedDraft, selectedPublished]);

  useEffect(() => {
    if (!selectedStaffId) { setStaffAssignments([]); return; }
    let current = true;
    void boApi.trainingStaffAssignments(selectedStaffId)
      .then((items) => { if (current) setStaffAssignments(items); })
      .catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : "Không thể tải Staff training."); });
    return () => { current = false; };
  }, [selectedStaffId]);

  async function run(label: string, command: () => Promise<unknown>, success: string) {
    setBusy(label); setError(""); setMessage("");
    try { await command(); await refreshCatalog(); setMessage(success); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Training command failed."); }
    finally { setBusy(""); }
  }

  function updateLesson(index: number, title: string) {
    setDraft((value) => ({ ...value, lessons: value.lessons.map((lesson, i) => i === index ? { ...lesson, title } : lesson) }));
  }
  async function createModule() {
    setBusy("create"); setError(""); setMessage("");
    try {
      const created = await boApi.createTrainingModule(moduleKey, draft);
      await refreshCatalog(created.id); setSelectedModuleId(created.id); setMessage("Đã tạo TrainingModule draft trong Core.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tạo TrainingModule."); }
    finally { setBusy(""); }
  }

  async function refreshStaffAssignments() {
    if (!selectedStaffId) return setStaffAssignments([]);
    setStaffAssignments(await boApi.trainingStaffAssignments(selectedStaffId));
  }

  async function assignSelected() {
    if (!selectedPublished || !selectedStaffId) return;
    setBusy("assign"); setError(""); setMessage("");
    try {
      await boApi.assignTraining({ staffMemberId: selectedStaffId, moduleVersionId: selectedPublished.id, reason: "Manager assignment from BO Training" });
      await refreshStaffAssignments(); setMessage("Đã giao exact published version cho Staff.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể giao training."); }
    finally { setBusy(""); }
  }

  async function signOff(assignmentId: string) {
    setBusy(assignmentId); setError("");
    try { await boApi.signOffTraining(assignmentId, "Reviewed in BO Training"); await refreshStaffAssignments(); setMessage("Đã sign-off qualification."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể sign-off."); }
    finally { setBusy(""); }
  }
  return <div className={styles.builder}>
    <header className={styles.builderHeader}>
      <div><p className={styles.eyebrow}>WFM-TRAIN · CORE AUTHORITY</p><h1>Tạo training</h1><p>Draft, publish, assignment và sign-off đều ghi qua canonical Workforce Core.</p></div>
      <div className={styles.builderActions}>
        {selectedDraft ? <button className={styles.secondaryBtn} type="button" disabled={Boolean(busy)} onClick={() => void run("save", () => boApi.saveTrainingDraft(selectedDraft.id, selectedDraft.revision, draft), "Đã lưu draft mới nhất.")}>Lưu nháp</button> : null}
        {selectedDraft ? <button className={styles.primaryBtn} type="button" disabled={Boolean(busy)} onClick={() => void run("publish", () => boApi.publishTrainingVersion(selectedDraft.id, selectedDraft.revision), "Đã publish immutable version.")}>Review & Publish</button> : null}
        {!selectedModule ? <button className={styles.primaryBtn} type="button" disabled={Boolean(busy)} onClick={() => void createModule()}>Tạo draft</button> : null}
      </div>
    </header>
    {message ? <div className={styles.notice}>{message}</div> : null}
    {error ? <div className={styles.notice}>{error}</div> : null}

    <div className={styles.builderGrid}>
      <section className={styles.panel}>
        <div className={styles.panelHead}><strong>Training catalog</strong><small>{catalog.length} modules</small></div>
        <div className={styles.formBody}>
          <div className={styles.fieldGrid}>
            <div className={`${styles.field} ${styles.fieldWide}`}><label>Module</label><select value={selectedModuleId} onChange={(event) => setSelectedModuleId(event.target.value)}><option value="">＋ New module</option>{catalog.map((item) => <option key={item.id} value={item.id}>{item.moduleKey} · {item.status}</option>)}</select></div>
            <div className={styles.field}><label>Module key</label><input value={moduleKey} disabled={Boolean(selectedModule)} onChange={(event) => setModuleKey(event.target.value)} /></div>
            <div className={styles.field}><label>Track</label><input value={draft.track ?? ""} onChange={(event) => setDraft((value) => ({ ...value, track: event.target.value }))} /></div>
            <div className={`${styles.field} ${styles.fieldWide}`}><label>Tên training</label><input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} /></div>
            <div className={`${styles.field} ${styles.fieldWide}`}><label>Mục tiêu</label><textarea value={draft.summary ?? ""} onChange={(event) => setDraft((value) => ({ ...value, summary: event.target.value }))} /></div>
          </div>
          <div className={styles.sectionHead}><div><h3>Bài học</h3><p>{selectedDraft ? `DRAFT v${selectedDraft.versionNumber} · rev ${selectedDraft.revision}` : selectedPublished ? `PUBLISHED v${selectedPublished.versionNumber}` : "New draft"}</p></div><span>{duration} phút</span></div>
          <div className={styles.lessonList}>
            {draft.lessons.map((lesson, index) => <div className={styles.lesson} key={lesson.key}>
              <span className={styles.lessonIndex}>{String(index + 1).padStart(2, "0")}</span>
              <div className={styles.lessonCopy}><input value={lesson.title} disabled={!selectedDraft && Boolean(selectedModule)} onChange={(event) => updateLesson(index, event.target.value)} /><small>{lesson.kind} · {lesson.estimatedMinutes ?? "–"} phút</small></div>
              <button type="button" disabled={!selectedDraft && Boolean(selectedModule)} onClick={() => setDraft((value) => ({ ...value, lessons: value.lessons.filter((_, i) => i !== index) }))}>×</button>
            </div>)}
            {(!selectedModule || selectedDraft) ? <button className={styles.addLesson} type="button" onClick={() => setDraft((value) => ({ ...value, lessons: [...value.lessons, { key: `lesson-${value.lessons.length + 1}`, title: `Bài học ${value.lessons.length + 1}`, kind: "READ", estimatedMinutes: 8 }] }))}>＋ Thêm bài học</button> : null}
          </div>
        </div>
      </section>
      <aside className={styles.sideStack}>
        <section className={styles.panel}><div className={styles.panelHead}><strong>Completion rule</strong><small>F0</small></div><div className={styles.summary}>
          <div className={styles.summaryRow}><span>Assessment</span><strong>{draft.assessmentThreshold === null ? "Không yêu cầu" : `≥ ${draft.assessmentThreshold ?? 80}%`}</strong></div>
          <div className={styles.summaryRow}><span>Sign-off</span><strong>{draft.requiresSignoff ? "Manager / Trainer" : "Không"}</strong></div>
          <div className={styles.qualBox}><small>Qualification outcome</small><strong>{draft.qualificationCode || "Không cấp qualification"}</strong></div>
          <div className={styles.field}><label>Qualification code</label><input value={draft.qualificationCode ?? ""} onChange={(event) => setDraft((value) => ({ ...value, qualificationCode: event.target.value.toUpperCase().replace(/\s+/g, "_") }))} /></div>
          {selectedPublished && !selectedDraft && selectedModule?.status !== "RETIRED" ? <button className={styles.secondaryBtn} type="button" onClick={() => void run("next", () => boApi.createNextTrainingDraft(selectedModule!.id), "Đã mở draft version kế tiếp.")}>Tạo version mới</button> : null}
          {selectedModule && selectedModule.status !== "RETIRED" ? <button className={styles.secondaryBtn} type="button" onClick={() => void run("retire", () => boApi.retireTrainingModule(selectedModule.id, "Retired from BO Training"), "Đã retire module; lịch sử vẫn giữ nguyên.")}>Retire module</button> : null}
        </div></section>

        <section className={styles.panel}><div className={styles.panelHead}><strong>Assignment & sign-off</strong><small>{staffAssignments.length} records</small></div><div className={styles.summary}>
          <div className={styles.field}><label>Staff</label><select value={selectedStaffId} onChange={(event) => setSelectedStaffId(event.target.value)}><option value="">Chọn Staff</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.displayLabel}</option>)}</select></div>
          <button className={styles.primaryBtn} type="button" disabled={!selectedStaffId || !selectedPublished || selectedModule?.status === "RETIRED" || Boolean(busy)} onClick={() => void assignSelected()}>Giao published version</button>
        </div>
        <table className={styles.matrix}><thead><tr><th>Training</th><th>Status</th><th /></tr></thead><tbody>
          {staffAssignments.map((item) => <tr key={item.assignment.id}>
            <td>{item.version.title}<small>v{item.version.versionNumber}</small></td>
            <td>{item.assignment.status}</td>
            <td>{item.assignment.status === "COMPLETION_PENDING" ? <button className={styles.secondaryBtn} type="button" disabled={busy === item.assignment.id} onClick={() => void signOff(item.assignment.id)}>Sign-off</button> : item.qualification?.status === "ACTIVE" ? <button className={styles.secondaryBtn} type="button" onClick={() => void run("revoke", () => boApi.revokeTrainingQualification(item.qualification!.id, "Revoked from BO Training"), "Đã revoke qualification.")}>Revoke</button> : null}</td>
          </tr>)}
        </tbody></table>
        </section>
      </aside>
    </div>
  </div>;
}
