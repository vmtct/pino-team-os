"use client";

import Link from "next/link";
import { Metric, PageHeading, Progress, PrototypeBanner, StatusPill } from "./components";
import { mockRegistrations } from "./mock-data";
import { useCanonicalToppi } from "./use-canonical-toppi";
import type { CoreProgram, ToppiDeliverySlot } from "@/lib/toppi-staging-api";
import styles from "./toppi-bo.module.css";

export default function ToppiHomePage() {
  const { enrollments, renewals, slots, loading, error } = useCanonicalToppi();
  const active = enrollments.filter((item) => item.lifecycle === "ACTIVE");
  const seats = slots.reduce((sum, slot) => sum + slot.available, 0);

  return (
    <div className={styles.page}>
      <PrototypeBanner />
      <PageHeading
        title="Toppi"
        subtitle="Operational snapshot for learner enrollment, 12-unit progression, scheduling and renewal continuity."
      />
      {error ? <div className={styles.empty}>{error}</div> : null}
      {loading ? <div className={styles.empty}>Loading canonical Toppi snapshot…</div> : null}
      <section className={styles.metrics}>
        <Metric label="Active enrollments" value={active.length} note="Canonical CC + LF" />
        <Metric label="Renewal attention" value={renewals.length} note="Core-derived eligibility" />
        <Metric label="Trial / placement" value={mockRegistrations.length} note="Reference prototype only" />
        <Metric label="Open seats" value={seats} note="Canonical delivery slots" />
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
                {active.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <td><div className={styles.person}><strong>{enrollment.student.displayName}</strong><small>{enrollment.student.guardianSummary.primaryDisplayName ?? "Guardian linked"}</small></div></td>
                    <td>{programName(enrollment.program)}</td>
                    <td><span className={styles.badge}>Lv {enrollment.level}</span></td>
                    <td><Progress unit={enrollment.package.unitProgress} /></td>
                    <td>{enrollment.currentPlacement ? slotLabel(enrollment.currentPlacement.slot) : "Unplaced"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.panel}>          <div className={styles.panelHeader}>
            <div><h2>Renewal attention</h2><p>Successor package and seat continuity queue.</p></div>
            <Link href="/bo/toppi/renewals">Open queue</Link>
          </div>
          <div className={styles.queue}>
            {renewals.map((enrollment) => (
              <article className={styles.queueItem} key={enrollment.id}>
                <div>
                  <strong>{enrollment.student.displayName} · {programShort(enrollment.program)} Lv{enrollment.level}</strong>
                  <span>{enrollment.package.unitProgress}/12 · {enrollment.projectedCompletionLocalDate ? `projected ${enrollment.projectedCompletionLocalDate}` : "projection pending"}</span>
                </div>
                <StatusPill value={enrollment.renewalState} />
              </article>
            ))}
            {!loading && !renewals.length ? <div className={styles.empty}>No renewal attention.</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function programName(program: CoreProgram) {
  return program === "CONFIDENT_COMMUNICATION" ? "Confident Communication" : "Language Foundation";
}

function programShort(program: CoreProgram) {
  return program === "CONFIDENT_COMMUNICATION" ? "CC" : "LF";
}

function slotLabel(slot: ToppiDeliverySlot) {
  const weekday = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"][slot.weekdayIso] ?? `D${slot.weekdayIso}`;
  return `${weekday} · ${slot.startsLocal}–${slot.endsLocal}`;
}
