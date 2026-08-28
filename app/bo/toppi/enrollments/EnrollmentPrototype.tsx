"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
import { Progress, StatusPill } from "../components";
import {
  mockEnrollments,
  mockSlots,
  mockStudents,
  programName,
  slotFor,
  stageName,
  studentFor,
  type MockEnrollment,
  type ToppiProgramCode,
} from "../mock-data";
import styles from "../toppi-bo.module.css";

export default function EnrollmentPrototype() {
  const [enrollments, setEnrollments] = useState<MockEnrollment[]>(mockEnrollments);
  const [programFilter, setProgramFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [renewalFilter, setRenewalFilter] = useState("");
  const [selectedId, setSelectedId] = useState(mockEnrollments[0]?.id ?? "");
  const [success, setSuccess] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  const filtered = useMemo(() => enrollments.filter((item) =>
    (!programFilter || item.program === programFilter)
    && (!statusFilter || item.packageStatus === statusFilter)
    && (!renewalFilter || item.renewalStatus === renewalFilter)
  ), [enrollments, programFilter, renewalFilter, statusFilter]);

  const selected = enrollments.find((item) => item.id === selectedId) ?? filtered[0] ?? enrollments[0];

  return (
    <>
      {success ? <div className={styles.success}>{success}</div> : null}
      <div className={styles.filterBar}>
        <label className={styles.filter}>Program
          <select value={programFilter} onChange={(event) => setProgramFilter(event.target.value)}>
            <option value="">All programs</option>
            <option value="CC">Confident Communication</option>
            <option value="LF">Language Foundation</option>
          </select>
        </label>
        <label className={styles.filter}>Package
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </label>
        <label className={styles.filter}>Renewal
          <select value={renewalFilter} onChange={(event) => setRenewalFilter(event.target.value)}>
            <option value="">All renewal states</option>
            <option value="DUE_SOON">Due soon</option>
            <option value="AWAITING_RENEWAL">Awaiting renewal</option>
            <option value="CONTINUITY_EXPIRING">Continuity expiring</option>
          </select>
        </label>
        <button className={styles.primaryButton} onClick={() => dialogRef.current?.showModal()}>+ New Enrollment</button>
      </div>

      <div className={styles.split}>
        <section className={styles.panel}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Student</th><th>Program</th><th>Level</th><th>Progress</th><th>Schedule</th><th>Package</th><th>Renewal</th></tr></thead>
              <tbody>
                {filtered.map((enrollment) => {
                  const student = studentFor(enrollment.studentId)!;
                  const slot = slotFor(enrollment.slotId)!;
                  return (
                    <tr key={enrollment.id} data-clickable="true" onClick={() => setSelectedId(enrollment.id)}>
                      <td><div className={styles.person}><strong>{student.displayName}</strong><small>{student.guardianName}</small></div></td>
                      <td><div className={styles.program}><strong>{programName(enrollment.program)}</strong><small>{stageName(enrollment.program, enrollment.level)}</small></div></td>
                      <td><span className={styles.badge}>Lv {enrollment.level}</span></td>
                      <td><Progress unit={enrollment.unit} /></td>
                      <td>{slot.label}</td>
                      <td><StatusPill value={enrollment.packageStatus} /></td>
                      <td>{enrollment.renewalStatus === "NONE" ? <span className={styles.muted}>—</span> : <StatusPill value={enrollment.renewalStatus} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!filtered.length ? <div className={styles.empty}>No enrollments match these filters.</div> : null}
        </section>

        {selected ? <EnrollmentDetail enrollment={selected} /> : null}
      </div>

      <NewEnrollmentDialog
        dialogRef={dialogRef}
        onCreate={(created) => {
          setEnrollments((current) => [created, ...current]);
          setSelectedId(created.id);
          setSuccess("Mock enrollment created in this browser session only. No Core write was made.");
        }}
      />
    </>
  );
}

function EnrollmentDetail({ enrollment }: { enrollment: MockEnrollment }) {
  const student = studentFor(enrollment.studentId)!;
  const slot = slotFor(enrollment.slotId)!;
  const nextLevel = enrollment.level < 10 ? enrollment.level + 1 : null;

  return (
    <aside className={styles.detailCard}>
      <div className={styles.detailHead}>
        <div>
          <span className={styles.eyebrow}>ENROLLMENT</span>
          <h2>{student.displayName}</h2>
          <p>{programName(enrollment.program)} · {stageName(enrollment.program, enrollment.level)}</p>
        </div>
        <span className={styles.badge}>Level {enrollment.level}</span>
      </div>
      <Progress unit={enrollment.unit} />
      <section className={styles.detailSection}>
        <span>Current package</span>
        <div className={styles.detailRows}>
          <div className={styles.detailRow}><span>Status</span><StatusPill value={enrollment.packageStatus} /></div>
          <div className={styles.detailRow}><span>Started</span><strong>{enrollment.startedOn}</strong></div>
          <div className={styles.detailRow}><span>Projected completion</span><strong>{enrollment.projectedCompletion}</strong></div>
        </div>
      </section>
      <section className={styles.detailSection}>
        <span>Schedule placement</span>
        <div className={styles.detailRows}>
          <div className={styles.detailRow}><span>Current slot</span><strong>{slot.label}</strong></div>
          <div className={styles.detailRow}><span>Capacity</span><strong>{slot.occupied}/{slot.capacity}</strong></div>
        </div>
      </section>
      <section className={styles.detailSection}>
        <span>Next</span>
        <div className={styles.detailRows}>
          <div className={styles.detailRow}><span>Eligible next level</span><strong>{nextLevel ? `Level ${nextLevel}` : "Program complete"}</strong></div>
          <div className={styles.detailRow}><span>Renewal</span><strong>{enrollment.renewalStatus.replaceAll("_", " ")}</strong></div>
        </div>
      </section>
      <div className={styles.actionRow}>
        <button className={styles.secondaryButton}>Change schedule</button>
        <button className={styles.secondaryButton}>Pause</button>
        <button className={styles.primaryButton}>Renew</button>
      </div>
    </aside>
  );
}

function NewEnrollmentDialog({
  dialogRef,
  onCreate,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  onCreate: (enrollment: MockEnrollment) => void;
}) {
  const [step, setStep] = useState(1);
  const [studentId, setStudentId] = useState("stu-ti");
  const [program, setProgram] = useState<ToppiProgramCode>("CC");
  const [level, setLevel] = useState(1);
  const [slotId, setSlotId] = useState(mockSlots[0].id);

  function close() {
    dialogRef.current?.close();
    setStep(1);
  }

  function create() {
    const created: MockEnrollment = {
      id: `mock-${Date.now()}`,
      studentId,
      program,
      level,
      unit: 0,
      slotId,
      packageStatus: "DRAFT",
      renewalStatus: "NONE",
      projectedCompletion: "Core projection pending",
      startedOn: "Pending activation",
    };
    onCreate(created);
    close();
  }

  const selectedStudent = mockStudents.find((item) => item.id === studentId)!;
  const selectedSlot = mockSlots.find((item) => item.id === slotId)!;

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={close}>
      <div className={styles.dialogHead}>
        <div><h2>New Toppi Enrollment</h2><p>Prototype wizard · creates browser-only mock state</p></div>
        <button onClick={close} aria-label="Close">×</button>
      </div>
      <div className={styles.dialogBody}>
        <div className={styles.steps} aria-label={`Step ${step} of 5`}>
          {[1, 2, 3, 4, 5].map((item) => <span key={item} className={`${styles.step} ${item <= step ? styles.stepActive : ""}`} />)}
        </div>

        {step === 1 ? (
          <div>
            <div className={styles.panelHeader}><div><h2>1. Student</h2><p>Use the shared StudentProfile; Toppi does not create a duplicate learner identity.</p></div></div>
            <div className={styles.choiceGrid}>
              {mockStudents.map((student) => (
                <button key={student.id} className={`${styles.choice} ${studentId === student.id ? styles.choiceActive : ""}`} onClick={() => setStudentId(student.id)}>
                  <strong>{student.displayName}</strong>
                  <span>{student.guardianName} · {student.pinoHouse ?? "No PINO House enrollment"}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <div className={styles.panelHeader}><div><h2>2. Program</h2><p>Buyer-facing Toppi programs remain separate learning journeys.</p></div></div>
            <div className={styles.choiceGrid}>
              {(["CC", "LF"] as ToppiProgramCode[]).map((code) => (
                <button key={code} className={`${styles.choice} ${program === code ? styles.choiceActive : ""}`} onClick={() => setProgram(code)}>
                  <strong>{programName(code)}</strong>
                  <span>{code === "CC" ? "Spark → Connect → Present" : "Core → Expand → Master"}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <div className={styles.panelHeader}><div><h2>3. Placement</h2><p>Initial Level selection is placement context; later progression advances deterministically.</p></div></div>
            <div className={styles.formGrid}>
              <label className={styles.field}>Recommended Level
                <select value={level} onChange={(event) => setLevel(Number(event.target.value))}>
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option value={value} key={value}>Level {value} · {stageName(program, value)}</option>)}
                </select>
              </label>
              <label className={styles.field}>Placement reason
                <select defaultValue="INITIAL_PLACEMENT"><option>INITIAL_PLACEMENT</option><option>PROGRAM_SWITCH</option><option>REENTRY</option></select>
              </label>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div>
            <div className={styles.panelHeader}><div><h2>4. Schedule</h2><p>Delivery Slot owns physical capacity; learner block routing is resolved elsewhere.</p></div></div>
            <div className={styles.choiceGrid}>
              {mockSlots.map((slot) => (
                <button key={slot.id} className={`${styles.choice} ${slotId === slot.id ? styles.choiceActive : ""}`} onClick={() => setSlotId(slot.id)}>
                  <strong>{slot.label}</strong>
                  <span>{slot.capacity - slot.occupied} seats available · {slot.occupied}/{slot.capacity} occupied</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div>
            <div className={styles.panelHeader}><div><h2>5. Review</h2><p>Creates a DRAFT 12-unit package in mock state; Core activation is intentionally not simulated.</p></div></div>
            <div className={styles.wizardSummary}>
              <div><span>Student</span><strong>{selectedStudent.displayName}</strong></div>
              <div><span>Guardian</span><strong>{selectedStudent.guardianName}</strong></div>
              <div><span>Program</span><strong>{programName(program)}</strong></div>
              <div><span>Placement</span><strong>Level {level} · {stageName(program, level)}</strong></div>
              <div><span>Schedule</span><strong>{selectedSlot.label}</strong></div>
              <div><span>Package</span><strong>12 Service Units · DRAFT</strong></div>
            </div>
          </div>
        ) : null}

        <div className={styles.wizardFooter}>
          <button className={styles.secondaryButton} disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}>Back</button>
          {step < 5 ? (
            <button className={styles.primaryButton} onClick={() => setStep((current) => Math.min(5, current + 1))}>Continue</button>
          ) : (
            <button className={styles.primaryButton} onClick={create}>Create mock enrollment</button>
          )}
        </div>
      </div>
    </dialog>
  );
}
