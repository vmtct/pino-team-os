"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Progress, StatusPill } from "../components";
import {
  toppiStagingApi,
  type CoreProgram,
  type ToppiDeliverySlot,
  type ToppiEnrollment,
  type ToppiLearner,
} from "@/lib/toppi-staging-api";
import styles from "../toppi-bo.module.css";

export default function EnrollmentPrototype() {
  const [enrollments, setEnrollments] = useState<ToppiEnrollment[]>([]);
  const [students, setStudents] = useState<ToppiLearner[]>([]);
  const [slots, setSlots] = useState<ToppiDeliverySlot[]>([]);
  const [renewals, setRenewals] = useState<ToppiEnrollment[]>([]);
  const [programFilter, setProgramFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [renewalFilter, setRenewalFilter] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const dialogRef = useRef<HTMLDialogElement>(null);

  async function refresh() {
    setLoading(true); setError("");
    try {
      const [nextStudents, nextSlots, nextEnrollments, nextRenewals] = await Promise.all([
        toppiStagingApi.students(), toppiStagingApi.slots(), toppiStagingApi.enrollments(), toppiStagingApi.renewals(),
      ]);
      setStudents(nextStudents); setSlots(nextSlots); setEnrollments(nextEnrollments); setRenewals(nextRenewals);
      setSelectedId((current) => current || nextEnrollments[0]?.id || "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Canonical Toppi staging could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  const renewalIds = useMemo(() => new Set(renewals.map((item) => item.id)), [renewals]);
  const filtered = useMemo(() => enrollments.filter((item) =>
    (!programFilter || item.program === programFilter)
    && (!statusFilter || item.package.status === statusFilter)
    && (!renewalFilter || item.renewalState === renewalFilter)
  ), [enrollments, programFilter, renewalFilter, statusFilter]);
  const selected = enrollments.find((item) => item.id === selectedId) ?? filtered[0] ?? enrollments[0];

  return (
    <>
      {message ? <div className={styles.success}>{message}</div> : null}
      {error ? <div className={styles.empty}>{error}</div> : null}
      <div className={styles.filterBar}>
        <label className={styles.filter}>Program
          <select value={programFilter} onChange={(event) => setProgramFilter(event.target.value)}>
            <option value="">All programs</option>
            <option value="CONFIDENT_COMMUNICATION">Confident Communication</option>
            <option value="LANGUAGE_FOUNDATION">Language Foundation</option>
          </select>
        </label>
        <label className={styles.filter}>Package
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option><option value="ACTIVE">Active</option><option value="DRAFT">Draft</option><option value="COMPLETED">Completed</option>
          </select>
        </label>
        <label className={styles.filter}>Renewal
          <select value={renewalFilter} onChange={(event) => setRenewalFilter(event.target.value)}>
            <option value="">All renewal states</option><option value="ELIGIBLE">Eligible</option><option value="DRAFT_PREPARED">Draft prepared</option><option value="PROGRAM_COMPLETE">Program complete</option>
          </select>
        </label>
        <button className={styles.primaryButton} disabled={loading || !students.length || !slots.length} onClick={() => dialogRef.current?.showModal()}>+ New Enrollment</button>
      </div>

      {loading ? <div className={styles.empty}>Loading canonical Core staging…</div> : null}
      <div className={styles.split}>
        <section className={styles.panel}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Student</th><th>Program</th><th>Level</th><th>Progress</th><th>Schedule</th><th>Package</th><th>Renewal</th></tr></thead>
              <tbody>
                {filtered.map((enrollment) => {
                  const slot = enrollment.currentPlacement?.slot;
                  return (
                    <tr key={enrollment.id} data-clickable="true" onClick={() => setSelectedId(enrollment.id)}>
                      <td><div className={styles.person}><strong>{enrollment.student.displayName}</strong><small>{enrollment.student.guardianSummary.primaryDisplayName ?? "Guardian linked"}</small></div></td>
                      <td><div className={styles.program}><strong>{programName(enrollment.program)}</strong><small>{titleCase(enrollment.stage)}</small></div></td>
                      <td><span className={styles.badge}>Lv {enrollment.level}</span></td>
                      <td><Progress unit={enrollment.package.unitProgress} /></td>
                      <td>{slot ? slotLabel(slot) : <span className={styles.muted}>Unplaced</span>}</td>
                      <td><StatusPill value={enrollment.package.status} /></td>
                      <td>{renewalIds.has(enrollment.id) ? <StatusPill value={enrollment.renewalState} /> : <span className={styles.muted}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && !filtered.length ? <div className={styles.empty}>No canonical enrollments match these filters.</div> : null}
        </section>
        {selected ? <EnrollmentDetail enrollment={selected} /> : null}
      </div>

      <NewEnrollmentDialog
        dialogRef={dialogRef}
        students={students}
        slots={slots}
        onCreate={async (input) => {
          setMessage(""); setError("");
          try {
            const created = await toppiStagingApi.createEnrollment(input);
            setSelectedId(created.id);
            setMessage("Canonical DRAFT Enrollment created in isolated Core staging with a 12-unit package.");
            await refresh();
          } catch (cause) { setError(cause instanceof Error ? cause.message : "Enrollment could not be created."); throw cause; }
        }}
      />
    </>
  );
}

function EnrollmentDetail({ enrollment }: { enrollment: ToppiEnrollment }) {
  const slot = enrollment.currentPlacement?.slot;
  return (
    <aside className={styles.detailCard}>
      <div className={styles.detailHead}>
        <div><span className={styles.eyebrow}>CANONICAL ENROLLMENT</span><h2>{enrollment.student.displayName}</h2><p>{programName(enrollment.program)} · {titleCase(enrollment.stage)}</p></div>
        <span className={styles.badge}>Level {enrollment.level}</span>
      </div>
      <Progress unit={enrollment.package.unitProgress} />
      <section className={styles.detailSection}>
        <span>Current package</span>
        <div className={styles.detailRows}>
          <div className={styles.detailRow}><span>Status</span><StatusPill value={enrollment.package.status} /></div>
          <div className={styles.detailRow}><span>Started</span><strong>{enrollment.serviceStartsOnLocalDate ?? "Pending activation"}</strong></div>
          <div className={styles.detailRow}><span>Projected completion</span><strong>{enrollment.projectedCompletionLocalDate ?? "Pending Core progression"}</strong></div>
          <div className={styles.detailRow}><span>Units</span><strong>{enrollment.package.consumedUnits}/12 consumed</strong></div>
        </div>
      </section>
      <section className={styles.detailSection}>
        <span>Schedule placement</span>
        <div className={styles.detailRows}>
          <div className={styles.detailRow}><span>Current slot</span><strong>{slot ? slotLabel(slot) : "Unplaced"}</strong></div>
          <div className={styles.detailRow}><span>Capacity</span><strong>{slot ? `${slot.occupied}/${slot.capacity}` : "—"}</strong></div>
        </div>
      </section>
      <section className={styles.detailSection}>
        <span>Next</span>
        <div className={styles.detailRows}>
          <div className={styles.detailRow}><span>Eligible next level</span><strong>{nextJourneyLabel(enrollment)}</strong></div>
          <div className={styles.detailRow}><span>Renewal</span><strong>{titleCase(enrollment.renewalState)}</strong></div>
        </div>
      </section>
      <div className={styles.actionRow}>
        <button className={styles.secondaryButton} disabled title="Deferred from this staging slice">Change schedule</button>
        <button className={styles.secondaryButton} disabled title="Pause lifecycle is deferred">Pause</button>
        <button className={styles.primaryButton} disabled title="Renewal mutation UI is deferred">Renew</button>
      </div>
    </aside>
  );
}

function NewEnrollmentDialog({ dialogRef, students, slots, onCreate }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  students: ToppiLearner[];
  slots: ToppiDeliverySlot[];
  onCreate: (input: { studentProfileId: string; program: CoreProgram; level: number; deliverySlotId: string; effectiveFromLocalDate: string }) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [studentId, setStudentId] = useState("");
  const [program, setProgram] = useState<CoreProgram>("CONFIDENT_COMMUNICATION");
  const [level, setLevel] = useState(1);
  const [slotId, setSlotId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!studentId && students[0]) setStudentId(students[0].student.id);
    if (!slotId && slots[0]) setSlotId(slots[0].id);
  }, [slotId, slots, studentId, students]);

  function close() { dialogRef.current?.close(); setStep(1); }
  async function create() {
    if (!studentId || !slotId) return;
    setSaving(true);
    try {
      await onCreate({
        studentProfileId: studentId,
        program,
        level,
        deliverySlotId: slotId,
        effectiveFromLocalDate: localToday(),
      });
      close();
    } finally { setSaving(false); }
  }

  const selectedStudent = students.find((item) => item.student.id === studentId) ?? students[0];
  const selectedSlot = slots.find((item) => item.id === slotId) ?? slots[0];

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={close}>
      <div className={styles.dialogHead}>
        <div><h2>New Toppi Enrollment</h2><p>Canonical Core staging · synthetic learner data</p></div>
        <button onClick={close} aria-label="Close">×</button>
      </div>
      <div className={styles.dialogBody}>
        <div className={styles.steps} aria-label={`Step ${step} of 5`}>
          {[1, 2, 3, 4, 5].map((item) => <span key={item} className={`${styles.step} ${item <= step ? styles.stepActive : ""}`} />)}
        </div>
        {step === 1 ? (
          <div>
            <div className={styles.panelHeader}><div><h2>1. Student</h2><p>Shared StudentProfile + active Guardian from isolated Core staging.</p></div></div>
            <div className={styles.choiceGrid}>
              {students.map((student) => (
                <button key={student.student.id} className={`${styles.choice} ${studentId === student.student.id ? styles.choiceActive : ""}`} onClick={() => setStudentId(student.student.id)}>
                  <strong>{student.student.displayName}</strong>
                  <span>{student.primaryGuardianDisplayName ?? "Guardian linked"} · {student.eligible ? "Eligible" : "Ineligible"}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <div className={styles.panelHeader}><div><h2>2. Program</h2><p>Buyer-facing Programs stay independent canonical journeys.</p></div></div>
            <div className={styles.choiceGrid}>
              {(["CONFIDENT_COMMUNICATION", "LANGUAGE_FOUNDATION"] as CoreProgram[]).map((code) => (
                <button key={code} className={`${styles.choice} ${program === code ? styles.choiceActive : ""}`} onClick={() => setProgram(code)}>
                  <strong>{programName(code)}</strong>
                  <span>{code === "CONFIDENT_COMMUNICATION" ? "Spark → Connect → Present" : "Core → Expand → Master"}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <div className={styles.panelHeader}><div><h2>3. Placement</h2><p>Initial Level selection only; normal progression later advances deterministically.</p></div></div>
            <div className={styles.formGrid}>
              <label className={styles.field}>Recommended Level
                <select value={level} onChange={(event) => setLevel(Number(event.target.value))}>
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option value={value} key={value}>Level {value} · {stageFor(program, value)}</option>)}
                </select>
              </label>
              <label className={styles.field}>Placement reason<select defaultValue="INITIAL_PLACEMENT" disabled><option>INITIAL_PLACEMENT</option></select></label>
            </div>
          </div>
        ) : null}
        {step === 4 ? (
          <div>
            <div className={styles.panelHeader}><div><h2>4. Schedule</h2><p>Delivery Slot owns physical capacity in Core.</p></div></div>
            <div className={styles.choiceGrid}>
              {slots.map((slot) => (
                <button key={slot.id} className={`${styles.choice} ${slotId === slot.id ? styles.choiceActive : ""}`} onClick={() => setSlotId(slot.id)}>
                  <strong>{slotLabel(slot)}</strong>
                  <span>{slot.available} seats available · {slot.occupied}/{slot.capacity} occupied</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div>
            <div className={styles.panelHeader}><div><h2>5. Review</h2><p>Core will create one DRAFT Enrollment, one DRAFT Level Package, and exactly 12 purchased units.</p></div></div>
            <div className={styles.wizardSummary}>
              <div><span>Student</span><strong>{selectedStudent?.student.displayName ?? "—"}</strong></div>
              <div><span>Guardian</span><strong>{selectedStudent?.primaryGuardianDisplayName ?? "—"}</strong></div>
              <div><span>Program</span><strong>{programName(program)}</strong></div>
              <div><span>Placement</span><strong>Level {level} · {stageFor(program, level)}</strong></div>
              <div><span>Schedule</span><strong>{selectedSlot ? slotLabel(selectedSlot) : "—"}</strong></div>
              <div><span>Package</span><strong>12 Service Units · DRAFT</strong></div>
            </div>
          </div>
        ) : null}

        <div className={styles.wizardFooter}>
          <button className={styles.secondaryButton} disabled={step === 1 || saving} onClick={() => setStep((current) => Math.max(1, current - 1))}>Back</button>
          {step < 5 ? (
            <button className={styles.primaryButton} disabled={!studentId || !slotId || saving} onClick={() => setStep((current) => Math.min(5, current + 1))}>Continue</button>
          ) : (
            <button className={styles.primaryButton} disabled={saving || !selectedStudent?.eligible || !selectedSlot} onClick={() => void create()}>{saving ? "Creating…" : "Create canonical enrollment"}</button>
          )}
        </div>
      </div>
    </dialog>
  );
}

function nextJourneyLabel(enrollment: ToppiEnrollment) {
  if (enrollment.nextEligibleLevel) return `Level ${enrollment.nextEligibleLevel}`;
  if (enrollment.level === 10 && enrollment.lifecycle === "COMPLETED") return "Program complete";
  if (enrollment.lifecycle === "DRAFT") return "Available after activation";
  return "Pending progression";
}

function programName(program: CoreProgram) {
  return program === "CONFIDENT_COMMUNICATION" ? "Confident Communication" : "Language Foundation";
}

function stageFor(program: CoreProgram, level: number) {
  if (program === "CONFIDENT_COMMUNICATION") return level <= 3 ? "Spark" : level <= 6 ? "Connect" : "Present";
  return level <= 3 ? "Core" : level <= 6 ? "Expand" : "Master";
}

function titleCase(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slotLabel(slot: ToppiDeliverySlot) {
  const weekday = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"][slot.weekdayIso] ?? `D${slot.weekdayIso}`;
  return `${weekday} · ${slot.startsLocal}–${slot.endsLocal}`;
}

function localToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
