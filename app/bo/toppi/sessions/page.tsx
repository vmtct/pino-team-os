import { PageHeading, PrototypeBanner } from "../components";
import styles from "../toppi-bo.module.css";

const sessions = [
  { id: "ses-01", when: "Thu 03 Sep · 18:00", slot: "Thu · 18:00–19:30", weeklyUnit: "Tell Me More", learners: 7, cc: 4, lf: 3 },
  { id: "ses-02", when: "Thu 03 Sep · 19:30", slot: "Thu · 19:30–21:00", weeklyUnit: "Tell Me More", learners: 6, cc: 4, lf: 2 },
  { id: "ses-03", when: "T7 05 Sep · 18:00", slot: "T7 · 18:00–19:30", weeklyUnit: "Tell Me More", learners: 8, cc: 3, lf: 5 },
  { id: "ses-04", when: "T7 05 Sep · 19:30", slot: "T7 · 19:30–21:00", weeklyUnit: "Tell Me More", learners: 5, cc: 2, lf: 3 },
];

export default function ToppiSessionsPage() {
  return (
    <div className={styles.page}>
      <PrototypeBanner />
      <PageHeading
        title="Sessions"
        subtitle="One physical Toppi Session per slot occurrence, even when multiple Programs and Levels are delivered together."
      />
      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>Upcoming physical sessions</h2><p>Same WeeklyUnit may be delivered across multiple sessions in the operating week.</p></div></div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Occurrence</th><th>Delivery slot</th><th>Weekly Unit</th><th>Learners</th><th>Program mix</th></tr></thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td><strong>{session.when}</strong></td>
                  <td>{session.slot}</td>
                  <td><span className={styles.badge}>{session.weeklyUnit}</span></td>
                  <td>{session.learners}</td>
                  <td><div className={styles.actionRow}><span className={styles.tag}>CC {session.cc}</span><span className={styles.tag}>LF {session.lf}</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
