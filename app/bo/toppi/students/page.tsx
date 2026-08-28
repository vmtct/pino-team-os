"use client";

import { PageHeading, PrototypeBanner, StatusPill } from "../components";
import { useCanonicalToppi } from "../use-canonical-toppi";
import type { CoreProgram } from "@/lib/toppi-staging-api";
import styles from "../toppi-bo.module.css";

export default function ToppiStudentsPage() {
  const { students, enrollments, loading, error } = useCanonicalToppi();
  return (
    <div className={styles.page}>
      <PrototypeBanner />
      <PageHeading
        title="Students"
        subtitle="Shared child identity viewed through a Toppi lens. Guardian identity remains shared platform truth."
      />
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>Shared student directory</h2><p>Canonical StudentProfile + Guardian projection from isolated Core staging.</p></div>
        </div>
        {error ? <div className={styles.empty}>{error}</div> : null}
        {loading ? <div className={styles.empty}>Loading canonical students…</div> : null}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Student</th><th>Guardian</th><th>Toppi</th><th>Eligibility</th></tr></thead>
            <tbody>              {students.map((student) => {
                const enrollment = enrollments.find((item) => item.student.id === student.student.id && item.lifecycle !== "CANCELLED");
                return (
                  <tr key={student.student.id}>
                    <td><div className={styles.person}><strong>{student.student.displayName}</strong><small>{student.student.birthYear ?? "Birth year unknown"}</small></div></td>
                    <td><div className={styles.person}><strong>{student.primaryGuardianDisplayName ?? "Guardian linked"}</strong><small>{student.activeGuardianCount} active guardian</small></div></td>
                    <td>
                      {enrollment ? (
                        <div className={styles.program}>
                          <strong>{programName(enrollment.program)}</strong>
                          <small>Level {enrollment.level} · {enrollment.package.unitProgress}/12 · {enrollment.lifecycle}</small>
                        </div>
                      ) : <span className={styles.muted}>Not enrolled</span>}
                    </td>
                    <td><StatusPill value={student.eligible ? "ELIGIBLE" : "INELIGIBLE"} /></td>
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

function programName(program: CoreProgram) {
  return program === "CONFIDENT_COMMUNICATION" ? "Confident Communication" : "Language Foundation";
}
