import Link from "next/link";
import { PolicyShell } from "../../../policy-shell";
import styles from "../../../policies.module.css";

export default function NewEveningShiftVersionPage(){return <PolicyShell
  title="Create policy version"
  subtitle="Prototype flow cho một policy change: edit draft → review difference → inspect domain-owned impact preview → schedule. Không có write action ở prototype này."
>
  <Link className={styles.back} href="/founder/policies/workforce/evening-shift">← Evening Assistant Shift</Link>

  <section className={styles.workspace}>
    <div className={styles.panel}>
      <div className={styles.panelHeader}><div><h2>Draft v4</h2><p>Editor là domain-specific form, không phải raw JSON.</p></div></div>
      <div className={styles.form}>
        <div className={styles.field}><label>Start time</label><input defaultValue="17:00" aria-label="Start time"/></div>
        <div className={styles.field}><label>End time</label><input defaultValue="21:00" aria-label="End time"/></div>
        <div className={styles.field}><label>Split shift</label><select defaultValue="NO" aria-label="Split shift"><option value="NO">No</option><option value="YES">Yes</option></select></div>
        <div className={styles.field}><label>Effective from</label><input defaultValue="2026-09-01" aria-label="Effective from"/></div>
        <div className={styles.field}><label>Change reason</label><textarea defaultValue="Prototype upcoming change for UX review" aria-label="Change reason"/><span className={styles.hint}>Material policy changes retain a reason/change note for provenance.</span></div>
      </div>
      <div className={styles.footerActions}><Link className={styles.buttonGhost} href="/founder/policies/workforce/evening-shift">Cancel</Link><span className={styles.buttonDisabled}>Schedule version · mock</span></div>
    </div>

    <aside className={styles.panel}>
      <div className={styles.panelHeader}><div><h2>Change review</h2><p>Founder nhìn difference trước khi activate/schedule.</p></div></div>
      <div className={styles.compare}>
        <div className={styles.compareCard}><span>Current v3</span><strong>17:30 → 21:00</strong><span>No split</span></div>
        <div className={styles.arrow}>→</div>
        <div className={styles.compareCard}><span>Draft v4</span><strong>17:00 → 21:00</strong><span>No split</span></div>
      </div>
      <div className={`${styles.notice} ${styles.sectionGap}`}><strong>Historical safety:</strong> published weeks and past assignments remain unchanged. Only future unpublished operations may resolve against v4 after its effective time.</div>
    </aside>
  </section>

  <section className={`${styles.panel} ${styles.sectionGap}`}>
    <div className={styles.panelHeader}><div><h2>Impact Preview</h2><p>Mock response from Workforce.previewPolicyChange(...). Advisory only; preview does not commit effects.</p></div><span className={`${styles.badge} ${styles.prototype}`}>MOCK DOMAIN PREVIEW</span></div>
    <div className={styles.impact}>
      <div className={styles.impactRow}><strong>Future Shift Offerings</strong><span>4 upcoming weekly cycles may generate an earlier 17:00 start.</span></div>
      <div className={styles.impactRow}><strong>Coverage Demand</strong><span>Projected +0.5 hour PA coverage per affected operating day. Exact demand count depends on future operating dates.</span></div>
      <div className={styles.impactRow}><strong>Published schedules</strong><span>No automatic change. Published cycles retain the policy/version that governed their publish decision.</span></div>
      <div className={styles.impactRow}><strong>Historical records</strong><span>Unchanged. v3 remains historical truth for its effective period.</span></div>
    </div>
  </section>

  <section className={`${styles.panel} ${styles.sectionGap}`}>
    <div className={styles.panelHeader}><div><h2>Security & audit preview</h2><p>Runtime implementation will require canonical Access Control and audit.</p></div></div>
    <div className={styles.legend}>
      <div className={styles.legendRow}><span>Permission</span><span>workforce.policy.manage @ GLOBAL</span></div>
      <div className={styles.legendRow}><span>Audit</span><span>Draft/version creation + schedule/activation must emit privileged policy audit events.</span></div>
      <div className={styles.legendRow}><span>Concurrency</span><span>Runtime must reject stale/conflicting activation that would create contradictory effective versions.</span></div>
    </div>
  </section>
</PolicyShell>}
