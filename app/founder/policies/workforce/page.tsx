import Link from "next/link";
import { PolicyShell } from "../policy-shell";
import styles from "../policies.module.css";
import { currentWorkforcePolicies, historicalWorkforcePolicies, upcomingWorkforcePolicies } from "@/lib/policy-center-prototype";
import { WorkforcePolicyBrowser } from "./workforce-policy-browser";

export default function WorkforcePoliciesPage(){return <PolicyShell
  title="Workforce Policies"
  subtitle="Founder policy định nghĩa staffing rules; Manager vẫn assign người thật trong Monthly Teachers / Weekly Assistants. Prototype này ưu tiên việc hiểu current rule, future change và historical provenance trước khi có runtime Policy Center."
>
  <section className={styles.summary}>
    <div className={styles.metric}><span>Current</span><strong>{currentWorkforcePolicies.length}</strong></div>
    <div className={styles.metric}><span>Upcoming</span><strong>{upcomingWorkforcePolicies.length}</strong></div>
    <div className={styles.metric}><span>Historical</span><strong>{historicalWorkforcePolicies.length}</strong></div>
    <div className={styles.metric}><span>Policy owner</span><strong>Workforce</strong></div>
  </section>

  <section className={styles.attention}>
    <div>
      <span className={styles.attentionKicker}>Needs awareness</span>
      <strong>1 Workforce policy version is already scheduled.</strong>
      <p>Evening Assistant Shift v4 becomes effective 01 Sep 2026. Founder can inspect the full policy stream before creating any later version.</p>
    </div>
    <Link className={styles.buttonGhost} href="/founder/policies/workforce/evening-shift">Review scheduled change</Link>
  </section>

  <section className={`${styles.workspace} ${styles.sectionGap}`}>
    <WorkforcePolicyBrowser/>
    <aside className={styles.panel}>
      <div className={styles.panelHeader}><div><h2>Decision ownership</h2><p>Để Founder không vô tình biến planning thành settings.</p></div></div>
      <div className={styles.legend}>
        <div className={styles.legendRow}><span>Founder</span><span>Staffing policy, Shift Template, service expectation, fallback rules.</span></div>
        <div className={styles.legendRow}><span>Manager</span><span>Assign real TE/PA, resolve absence/support, publish schedule.</span></div>
        <div className={styles.legendRow}><span>Domain</span><span>Validate and resolve policy semantics; Policy Center không tự hiểu payload.</span></div>
      </div>
      <div className={`${styles.notice} ${styles.sectionGap}`}><strong>Review focus:</strong> Current / Upcoming / History có đủ rõ để bạn biết “PINO đang chạy rule nào”, “rule nào sắp đổi” và “trước đây rule là gì” mà không cần nhìn database hay code hay không?</div>
    </aside>
  </section>
</PolicyShell>}
