import { PageHeading, PrototypeBanner, StatusPill } from "../components";
import { mockEnrollments, mockStudents, programName } from "../mock-data";
import styles from "../toppi-bo.module.css";

export default function ToppiStudentsPage() {
  return (
    <div className={styles.page}>
      <PrototypeBanner />
      <PageHeading
        title="Students"
        subtitle="Shared child identity viewed through a Toppi lens. Guardian, Pinoria and PINO House context remain shared platform facts."
      />
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>Shared student directory</h2><p>Mock projection only — no duplicate Toppi student identity.</p></div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Student</th><th>Guardian</th><th>Toppi</th><th>PINO House</th><th>Pinoria</th></tr></thead>
            <tbody>
              {mockStudents.map((student) => {
                const enrollment = mockEnrollments.find((item) => item.studentId === student.id);
                return (
                  <tr key={student.id}>
                    <td><div className={styles.person}><strong>{student.displayName}</strong><small>{student.id}</small></div></td>
                    <td><div className={styles.person}><strong>{student.guardianName}</strong><small>{student.guardianContact}</small></div></td>
                    <td>
                      {enrollment ? (
                        <div className={styles.program}>
                          <strong>{programName(enrollment.program)}</strong>
                          <small>Level {enrollment.level} · {enrollment.unit}/12</small>
                        </div>
                      ) : <span className={styles.muted}>Not enrolled</span>}
                    </td>
                    <td>{student.pinoHouse ?? <span className={styles.muted}>—</span>}</td>
                    <td><StatusPill value={student.pinoria} /></td>
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
