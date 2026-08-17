import Link from "next/link";
import { PolicyShell } from "./policy-shell";
import styles from "./policies.module.css";
import { policyDomains } from "@/lib/policy-center-prototype";

export default function PolicyCenterPage(){
  const active = policyDomains.reduce((sum,domain)=>sum+domain.active,0);
  const upcoming = policyDomains.reduce((sum,domain)=>sum+domain.upcoming,0);
  return <PolicyShell
    title="Policies"
    subtitle="Một nơi để Founder hiểu PINO đang chọn vận hành theo rule nào, rule nào sắp đổi, và trước đây rule là gì. Policy Center quản trị version/effective history; semantics vẫn thuộc domain sở hữu policy."
  >
    <section className={styles.summary}>
      <div className={styles.metric}><span>Active policies</span><strong>{active}</strong></div>
      <div className={styles.metric}><span>Upcoming changes</span><strong>{upcoming}</strong></div>
      <div className={styles.metric}><span>Domains materialized</span><strong>1</strong></div>
      <div className={styles.metric}><span>Policy model</span><strong>Versioned</strong></div>
    </section>

    <section className={styles.attention}>
      <div>
        <span className={styles.attentionKicker}>Review path</span>
        <strong>Workforce is the first materialized policy domain.</strong>
        <p>Review Current → Upcoming → History, then open Evening Assistant Shift and create the next mock version to inspect change review + Impact Preview.</p>
      </div>
      <Link className={styles.button} href="/founder/policies/workforce">Start Workforce review</Link>
    </section>

    <section className={`${styles.grid} ${styles.sectionGap}`}>
      {policyDomains.map(domain => <article className={styles.domainCard} key={domain.id}>
        <div>
          <h2>{domain.name}</h2>
          <p>{domain.description}</p>
          <div className={styles.domainStats}>
            <span><strong>{domain.active}</strong>active</span>
            <span><strong>{domain.upcoming}</strong>upcoming</span>
          </div>
        </div>
        {domain.id === "WORKFORCE"
          ? <Link className={styles.buttonGhost} href="/founder/policies/workforce">Open</Link>
          : <span className={styles.buttonDisabled}>Not materialized</span>}
      </article>)}
    </section>

    <section className={`${styles.workspace} ${styles.sectionGap}`}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>What belongs here?</h2><p>Chỉ business-operating choices cần version/effective history mới trở thành Policy.</p></div></div>
        <div className={styles.legend}>
          <div className={styles.legendRow}><span>INVARIANT</span><span>Luật domain ổn định. Đổi invariant là architecture/domain change, không phải sửa setting.</span></div>
          <div className={styles.legendRow}><span>POLICY</span><span>Founder-configurable business rule. Đây là loại duy nhất surface trong Policy Center.</span></div>
          <div className={styles.legendRow}><span>OPERATIONAL_DECISION</span><span>Manager/staff quyết định theo ngày/tuần/tình huống; nằm trong workflow domain.</span></div>
          <div className={styles.legendRow}><span>DEPLOYMENT_CONFIG</span><span>D1 binding, secrets, endpoints và environment config; không phải business policy.</span></div>
        </div>
      </div>
      <aside className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>Architecture guardrail</h2><p>Policy Center là control plane, không phải generic rules engine.</p></div></div>
        <div className={styles.notice}><strong>Domain owns semantics.</strong> Workforce tự validate/resolve policy Workforce; Membership tự hiểu policy Membership. Không có JSON rule builder hay generic GLOBAL → CENTER → PATH inheritance.</div>
      </aside>
    </section>
  </PolicyShell>;
}
