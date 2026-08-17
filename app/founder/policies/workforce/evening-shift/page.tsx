import Link from "next/link";
import { PolicyShell, PolicyStatusBadge } from "../../policy-shell";
import styles from "../../policies.module.css";
import { workforcePolicies } from "@/lib/policy-center-prototype";

export default function EveningShiftPolicyPage(){
  const current = workforcePolicies.find(policy => policy.id === "pa-evening-shift-v3")!;
  const upcoming = workforcePolicies.find(policy => policy.id === "pa-evening-shift-v4")!;
  const history = workforcePolicies.find(policy => policy.id === "pa-evening-shift-v2")!;
  return <PolicyShell title="Evening Assistant Shift" subtitle="Một policy stream xuyên thời gian: historical v2 → active v3 → scheduled v4. Active state không bị edit in place; thay đổi tiếp theo phải trở thành version mới.">
    <Link className={styles.back} href="/founder/policies/workforce">← Workforce Policies</Link>

    <section className={styles.panel}>
      <div className={styles.detailHead}>
        <div><PolicyStatusBadge status={current.status}/><h2 style={{marginTop:8}}>17:30 → 21:00</h2><p>Split shift: No · {current.target}</p></div>
        <Link className={styles.button} href="/founder/policies/workforce/evening-shift/new">Create next version</Link>
      </div>
      <div className={styles.facts}>
        <div className={styles.fact}><span>Current version</span><strong>v{current.version}</strong></div>
        <div className={styles.fact}><span>Effective since</span><strong>{current.effectiveFrom}</strong></div>
        <div className={styles.fact}><span>Decision class</span><strong>POLICY</strong></div>
      </div>
      <div className={styles.sectionGap}>
        <span className={styles.eyebrow}>Used by</span>
        <div className={`${styles.usedBy} ${styles.sectionGap}`}>{current.usedBy.map(item=><span key={item}>{item}</span>)}</div>
      </div>
    </section>

    <section className={`${styles.panel} ${styles.sectionGap}`}>
      <div className={styles.panelHeader}><div><h2>Policy stream</h2><p>Founder sees one logical policy across versions instead of treating each version as a separate setting.</p></div></div>
      <div className={styles.versionFlow}>
        <div className={styles.versionNode}>
          <PolicyStatusBadge status={history.status}/>
          <strong>v{history.version} · {history.summary}</strong>
          <span>{history.effectiveFrom} → {history.effectiveUntil}</span>
        </div>
        <span className={styles.versionArrow}>→</span>
        <div className={`${styles.versionNode} ${styles.versionNodeCurrent}`}>
          <PolicyStatusBadge status={current.status}/>
          <strong>v{current.version} · {current.summary}</strong>
          <span>Effective since {current.effectiveFrom}</span>
        </div>
        <span className={styles.versionArrow}>→</span>
        <div className={styles.versionNode}>
          <PolicyStatusBadge status={upcoming.status}/>
          <strong>v{upcoming.version} · {upcoming.summary}</strong>
          <span>Scheduled for {upcoming.effectiveFrom}</span>
        </div>
      </div>
    </section>

    <section className={`${styles.workspace} ${styles.sectionGap}`}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>Upcoming change</h2><p>Future-effective change is visible before activation and never silently rewrites the current version.</p></div></div>
        <div className={styles.policyRow}>
          <div><h3>{upcoming.summary}</h3><p>Reason: {upcoming.changeReason}</p><div className={styles.meta}><span className={styles.tag}>{upcoming.target}</span></div></div>
          <div className={styles.policyRight}><PolicyStatusBadge status={upcoming.status}/><strong>v{upcoming.version}</strong><span>{upcoming.effectiveFrom}</span></div>
        </div>
      </div>
      <aside className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>Historical provenance</h2><p>Version đã govern operation vẫn giữ lại.</p></div></div>
        <div className={styles.policyRow}>
          <div><h3>{history.summary}</h3><p>{history.effectiveFrom} → {history.effectiveUntil}</p></div>
          <div className={styles.policyRight}><PolicyStatusBadge status={history.status}/><strong>v{history.version}</strong></div>
        </div>
      </aside>
    </section>

    <section className={`${styles.panel} ${styles.sectionGap}`}>
      <div className={styles.panelHeader}><div><h2>Why this is Policy, not invariant</h2><p>Thời gian shift có thể thay đổi theo operating model mà không redesign Workforce domain.</p></div></div>
      <div className={styles.notice}><strong>Invariant:</strong> PA weekly planning remains distinct from TE monthly planning. <strong>Policy:</strong> active evening window is currently 17:30–21:00, splitAllowed=false.</div>
    </section>
  </PolicyShell>;
}
