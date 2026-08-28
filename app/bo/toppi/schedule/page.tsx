import { PageHeading, PrototypeBanner } from "../components";
import { mockEnrollments, mockSlots, programName, studentFor } from "../mock-data";
import styles from "../toppi-bo.module.css";

export default function ToppiSchedulePage() {
  return (
    <div className={styles.page}>
      <PrototypeBanner />
      <PageHeading
        title="Schedule"
        subtitle="Physical Delivery Slots own recurring schedule and capacity. Programs and Levels may mix inside the same slot."
      />
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>Delivery slots</h2><p>Mock capacity view for schedule placement.</p></div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Slot</th><th>Capacity</th><th>Open seats</th><th>Placed learners</th></tr></thead>
            <tbody>
              {mockSlots.map((slot) => {
                const learners = mockEnrollments.filter((item) => item.slotId === slot.id && item.packageStatus !== "COMPLETED");
                return (
                  <tr key={slot.id}>
                    <td><strong>{slot.label}</strong></td>
                    <td>{slot.occupied}/{slot.capacity}</td>
                    <td><span className={styles.badge}>{slot.capacity - slot.occupied} open</span></td>
                    <td>
                      <div className={styles.actionRow}>
                        {learners.map((enrollment) => {
                          const student = studentFor(enrollment.studentId)!;
                          return <span className={styles.tag} key={enrollment.id}>{student.displayName} · {programName(enrollment.program)} Lv{enrollment.level}</span>;
                        })}
                        {!learners.length ? <span className={styles.muted}>No active placements</span> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
