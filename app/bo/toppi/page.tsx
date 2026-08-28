import Link from "next/link";
import { Metric, PageHeading, Progress, PrototypeBanner, StatusPill } from "./components";
import { mockEnrollments, mockRegistrations, mockSlots, programName, slotFor, studentFor } from "./mock-data";
import styles from "./toppi-bo.module.css";

export default function ToppiHomePage() {
  const active = mockEnrollments.filter((item) => item.packageStatus === "ACTIVE");
  const renewalQueue = mockEnrollments.filter((item) => item.renewalStatus !== "NONE");
  const seats = mockSlots.reduce((sum, slot) => sum + slot.capacity - slot.occupied, 0);

  return (
    <div className={styles.page}>
      <PrototypeBanner />
      <PageHeading
        title="Toppi"
        subtitle="Operational snapshot for learner enrollment, 12-unit progression, scheduling and renewal continuity."
      />
      <section className={styles.metrics}>
        <Metric label="Active enrollments" value={active.length} note="Across CC + LF" />
        <Metric label="Renewal attention" value={renewalQueue.length} note="Due soon / awaiting" />
        <Metric label="Trial / placement" value={mockRegistrations.length} note="Mock acquisition queue" />
        <Metric label="Open seats" value={seats} note="Across active delivery slots" />
      </section>

      <div className={styles.grid2}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div><h2>Current learner journeys</h2><p>Level is deterministic progression; competency remains separate.</p></div>
            <Link href="/bo/toppi/enrollments">Open enrollments</Link>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Learner</th><th>Program</th><th>Level</th><th>Progress</th><th>Schedule</th></tr></thead>
              <tbody>
                {active.map((enrollment) => {
                  const student = studentFor(enrollment.studentId)!;
                  const slot = slotFor(enrollment.slotId)!;
                  return (
                    <tr key={enrollment.id}>
                      <td><div className={styles.person}><strong>{student.displayName}</strong><small>{student.guardianName}</small></div></td>
                      <td>{programName(enrollment.program)}</td>
                      <td><span className={styles.badge}>Lv {enrollment.level}</span></td>
                      <td><Progress unit={enrollment.unit} /></td>
                      <td>{slot.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div><h2>Renewal attention</h2><p>Successor package and seat continuity queue.</p></div>
            <Link href="/bo/toppi/renewals">Open queue</Link>
          </div>
          <div className={styles.queue}>
            {renewalQueue.map((enrollment) => {
              const student = studentFor(enrollment.studentId)!;
              return (
                <article className={styles.queueItem} key={enrollment.id}>
                  <div>
                    <strong>{student.displayName} · {enrollment.program} Lv{enrollment.level}</strong>
                    <span>{enrollment.unit}/12 · projected {enrollment.projectedCompletion}</span>
                  </div>
                  <StatusPill value={enrollment.renewalStatus} />
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
