"use client";

import { PageHeading, PrototypeBanner, StatusPill } from "../components";
import { useCanonicalToppi } from "../use-canonical-toppi";
import type { CoreProgram, ToppiDeliverySlot, ToppiEnrollment } from "@/lib/toppi-staging-api";
import styles from "../toppi-bo.module.css";

export default function ToppiRenewalsPage() {
  const { renewals, loading, error } = useCanonicalToppi();
  return (
    <div className={styles.page}>
      <PrototypeBanner />
      <PageHeading
        title="Renewals"
        subtitle="A focused queue for successor packages and seat continuity. Renewal never rewrites completed Level history."
      />
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>Canonical renewal queue</h2><p>Core determines successor eligibility; mutation UI remains deferred in this slice.</p></div>
        </div>
        {error ? <div className={styles.empty}>{error}</div> : null}
        {loading ? <div className={styles.empty}>Loading canonical renewals…</div> : null}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Student</th><th>Current journey</th><th>Progress</th><th>Schedule</th><th>State</th><th>Next</th></tr></thead>
            <tbody>              {renewals.map((enrollment) => (
                <tr key={enrollment.id}>
                  <td><div className={styles.person}><strong>{enrollment.student.displayName}</strong><small>{enrollment.student.guardianSummary.primaryDisplayName ?? "Guardian linked"}</small></div></td>
                  <td><div className={styles.program}><strong>{programName(enrollment.program)} · Lv {enrollment.level}</strong><small>{enrollment.projectedCompletionLocalDate ? `Projected ${enrollment.projectedCompletionLocalDate}` : "Projection pending"}</small></div></td>
                  <td>{enrollment.package.unitProgress}/12</td>
                  <td>{enrollment.currentPlacement ? slotLabel(enrollment.currentPlacement.slot) : "Unplaced"}</td>
                  <td><StatusPill value={enrollment.renewalState} /></td>
                  <td><div className={styles.actionRow}><span className={styles.badge}>{nextLabel(enrollment)}</span><button className={styles.primaryButton} disabled title="Renewal mutation UI is deferred">Renew</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !renewals.length ? <div className={styles.empty}>No canonical renewal attention is required.</div> : null}
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>Progression rule</h2><p>Successor activation remains fail-closed until the mandatory qualifying operating-week resolver lands.</p></div>
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
function programName(program: CoreProgram) {
  return program === "CONFIDENT_COMMUNICATION" ? "Confident Communication" : "Language Foundation";
}

function slotLabel(slot: ToppiDeliverySlot) {
  const weekday = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"][slot.weekdayIso] ?? `D${slot.weekdayIso}`;
  return `${weekday} · ${slot.startsLocal}–${slot.endsLocal}`;
}

function nextLabel(enrollment: ToppiEnrollment) {
  if (enrollment.nextEligibleLevel) return `Level ${enrollment.nextEligibleLevel}`;
  if (enrollment.level === 10 && enrollment.lifecycle === "COMPLETED") return "Program complete";
  return "Pending progression";
}
