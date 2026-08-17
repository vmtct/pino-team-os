import Link from "next/link";
import { PolicyShell } from "../../../policy-shell";
import styles from "../../../policies.module.css";
import { NewEveningShiftVersionForm } from "./new-version-form";

export default function NewEveningShiftVersionPage(){return <PolicyShell
  title="Create next policy version"
  subtitle="Interactive prototype: start from the latest scheduled version, edit a new draft, inspect the difference and domain-owned impact preview. No write action exists here."
>
  <Link className={styles.back} href="/founder/policies/workforce/evening-shift">← Evening Assistant Shift</Link>

  <NewEveningShiftVersionForm/>

  <section className={`${styles.panel} ${styles.sectionGap}`}>
    <div className={styles.panelHeader}><div><h2>Security & audit preview</h2><p>Runtime implementation will require canonical Access Control and audit before any Schedule/Activate action exists.</p></div></div>
    <div className={styles.legend}>
      <div className={styles.legendRow}><span>Permission</span><span>workforce.policy.manage @ GLOBAL</span></div>
      <div className={styles.legendRow}><span>Audit</span><span>Draft/version creation + schedule/activation must emit privileged policy audit events.</span></div>
      <div className={styles.legendRow}><span>Concurrency</span><span>Runtime must reject stale/conflicting activation that would create contradictory effective versions.</span></div>
    </div>
  </section>
</PolicyShell>}
