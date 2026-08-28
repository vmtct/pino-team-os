import { PageHeading, PrototypeBanner, StatusPill } from "../components";
import { mockEnrollments, programName, slotFor, studentFor } from "../mock-data";
import styles from "../toppi-bo.module.css";

export default function ToppiRenewalsPage() {
  const items = mockEnrollments.filter((item) => item.renewalStatus !== "NONE");

  return (
    <div className={styles.page}>
      <PrototypeBanner />
      <PageHeading
        title="Renewals"
        subtitle="A focused queue for successor packages and seat continuity. Renewal never rewrites completed Level history."
      />
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>Attention queue</h2><p>Sorted by operational urgency in the mock projection.</p></div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Student</th><th>Current journey</th><th>Progress</th><th>Schedule</th><th>State</th><th>Next</th></tr></thead>
            <tbody>
              {items.map((enrollment) => {
                const student = studentFor(enrollment.studentId)!;
                const slot = slotFor(enrollment.slotId)!;
                const next = enrollment.level < 10 ? `Level ${enrollment.level + 1}` : "Program complete";
                return (
                  <tr key={enrollment.id}>
                    <td><div className={styles.person}><strong>{student.displayName}</strong><small>{student.guardianName}</small></div></td>
                    <td><div className={styles.program}><strong>{programName(enrollment.program)} · Lv {enrollment.level}</strong><small>Projected {enrollment.projectedCompletion}</small></div></td>
                    <td>{enrollment.unit}/12</td>
                    <td>{slot.label}</td>
                    <td><StatusPill value={enrollment.renewalStatus} /></td>
                    <td><div className={styles.actionRow}><span className={styles.badge}>{next}</span><button className={styles.primaryButton}>Renew</button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>Prototype rule visible in UI</h2><p>Successor starts only after the mandatory one qualifying operating-week break.</p></div>
        </div>
        <div className={styles.wizardSummary}>
          <div><span>Level completion</span><strong>Unit 12 settles Level N</strong></div>
          <div><span>Break</span><strong>1 qualifying operating week</strong></div>
          <div><span>Successor</span><strong>Level N+1 when successor package starts</strong></div>
        </div>
      </section>
    </div>
  );
}
