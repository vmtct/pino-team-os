"use client";

import { PageHeading, PrototypeBanner } from "../components";
import { useCanonicalToppi } from "../use-canonical-toppi";
import type { CoreProgram, ToppiDeliverySlot } from "@/lib/toppi-staging-api";
import styles from "../toppi-bo.module.css";

export default function ToppiSchedulePage() {
  const { slots, enrollments, loading, error } = useCanonicalToppi();
  return (
    <div className={styles.page}>
      <PrototypeBanner />
      <PageHeading
        title="Schedule"
        subtitle="Physical Delivery Slots own recurring schedule and capacity. Programs and Levels may mix inside the same slot."
      />
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div><h2>Delivery slots</h2><p>Canonical capacity and placement projection from isolated Core staging.</p></div>
        </div>
        {error ? <div className={styles.empty}>{error}</div> : null}
        {loading ? <div className={styles.empty}>Loading canonical schedule…</div> : null}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Slot</th><th>Capacity</th><th>Open seats</th><th>Placed learners</th></tr></thead>
            <tbody>              {slots.map((slot) => {
                const learners = enrollments.filter((item) => item.currentPlacement?.slot.id === slot.id && item.lifecycle !== "CANCELLED");
                return (
                  <tr key={slot.id}>
                    <td><strong>{slotLabel(slot)}</strong></td>
                    <td>{slot.occupied}/{slot.capacity}</td>
                    <td><span className={styles.badge}>{slot.available} open</span></td>
                    <td>
                      <div className={styles.actionRow}>
                        {learners.map((enrollment) => (
                          <span className={styles.tag} key={enrollment.id}>
                            {enrollment.student.displayName} · {programName(enrollment.program)} Lv{enrollment.level}
                          </span>
                        ))}
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
function programName(program: CoreProgram) {
  return program === "CONFIDENT_COMMUNICATION" ? "CC" : "LF";
}

function slotLabel(slot: ToppiDeliverySlot) {
  const weekday = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"][slot.weekdayIso] ?? `D${slot.weekdayIso}`;
  return `${weekday} · ${slot.startsLocal}–${slot.endsLocal}`;
}
