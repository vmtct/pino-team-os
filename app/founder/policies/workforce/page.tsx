import Link from "next/link";
import { PolicyShell, PolicyStatusBadge } from "../policy-shell";
import styles from "../policies.module.css";
import { currentWorkforcePolicies, historicalWorkforcePolicies, upcomingWorkforcePolicies } from "@/lib/policy-center-prototype";

function PolicyRows({items}:{items:typeof currentWorkforcePolicies}){
  if(items.length===0) return <div className={styles.empty}>No policies in this state.</div>;
  return <div className={styles.policyList}>{items.map(policy => <article className={styles.policyRow} key={policy.id}>
    <div>
      <h3>{policy.name}</h3>
      <p>{policy.summary}</p>
      <div className={styles.meta}><span className={styles.tag}>{policy.target}</span><span>Used by {policy.usedBy.join(" · ")}</span></div>
    </div>
    <div className={styles.policyRight}>
      <PolicyStatusBadge status={policy.status}/>
      <strong>v{policy.version}</strong>
      <span>{policy.effectiveFrom}</span>
      {policy.name === "Evening Assistant Shift" && policy.status === "ACTIVE" ? <Link className={styles.buttonGhost} style={{marginTop:8}} href="/founder/policies/workforce/evening-shift">View</Link> : null}
    </div>
  </article>)}</div>;
}

export default function WorkforcePoliciesPage(){return <PolicyShell
  title="Workforce Policies"
  subtitle="Founder policy định nghĩa staffing rules; Manager vẫn assign người thật trong Monthly Teachers / Weekly Assistants. Đây là mock catalog để review information architecture trước khi có runtime Policy Center."
>
  <section className={styles.summary}>
    <div className={styles.metric}><span>Current</span><strong>{currentWorkforcePolicies.length}</strong></div>
    <div className={styles.metric}><span>Upcoming</span><strong>{upcomingWorkforcePolicies.length}</strong></div>
    <div className={styles.metric}><span>Historical</span><strong>{historicalWorkforcePolicies.length}</strong></div>
    <div className={styles.metric}><span>Policy owner</span><strong>Workforce</strong></div>
  </section>

  <section className={styles.workspace}>
    <div className={styles.panel}>
      <div className={styles.panelHeader}><div><h2>Current</h2><p>Những policy đang govern future operating decisions ở thời điểm hiện tại.</p></div></div>
      <PolicyRows items={currentWorkforcePolicies}/>
    </div>
    <aside className={styles.panel}>
      <div className={styles.panelHeader}><div><h2>Decision ownership</h2><p>Để Founder không vô tình biến planning thành settings.</p></div></div>
      <div className={styles.legend}>
        <div className={styles.legendRow}><span>Founder</span><span>Staffing policy, Shift Template, service expectation, fallback rules.</span></div>
        <div className={styles.legendRow}><span>Manager</span><span>Assign real TE/PA, resolve absence/support, publish schedule.</span></div>
        <div className={styles.legendRow}><span>Domain</span><span>Validate and resolve policy semantics; Policy Center không tự hiểu payload.</span></div>
      </div>
    </aside>
  </section>

  <section className={`${styles.panel} ${styles.sectionGap}`}>
    <div className={styles.panelHeader}><div><h2>Upcoming</h2><p>Future-effective versions. Prototype này cố tình có một scheduled change để review impact UX.</p></div></div>
    <PolicyRows items={upcomingWorkforcePolicies}/>
  </section>

  <section className={`${styles.panel} ${styles.sectionGap}`}>
    <div className={styles.panelHeader}><div><h2>History</h2><p>Superseded versions vẫn là historical truth và không bị overwrite.</p></div></div>
    <PolicyRows items={historicalWorkforcePolicies}/>
  </section>
</PolicyShell>}
