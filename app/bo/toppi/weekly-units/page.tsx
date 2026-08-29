import { PageHeading, PrototypeBanner } from "../components";
import styles from "../toppi-bo.module.css";

export default function ToppiWeeklyUnitsPage() {
  return (
    <div className={styles.page}>
      <PrototypeBanner />
      <PageHeading
        title="Weekly Units"
        subtitle="Whole-Toppi operating-week teaching container. This prototype shows authoring shape only; no curriculum write contract is implemented."
      />
      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>2026-W36 · Tell Me More</h2><p>One canonical WeeklyUnit with independent CC and LF branches.</p></div><span className={styles.badge}>Published mock</span></div>
        <div className={styles.grid2}>
          <article className={styles.detailCard}>
            <div className={styles.detailHead}><div><span className={styles.eyebrow}>CONFIDENT COMMUNICATION</span><h2>CC branch</h2><p>Spark · Connect · Present</p></div></div>
            <section className={styles.detailSection}><span>Block topology</span><div className={styles.actionRow}><span className={styles.tag}>A</span><span className={styles.tag}>B</span><span className={styles.tag}>C</span></div></section>
            <section className={styles.detailSection}><span>Shared context</span><p className={styles.muted}>Prompt learners to extend a short exchange using follow-up questions.</p></section>
          </article>
          <article className={styles.detailCard}>
            <div className={styles.detailHead}><div><span className={styles.eyebrow}>LANGUAGE FOUNDATION</span><h2>LF branch</h2><p>Core · Expand · Master</p></div></div>
            <section className={styles.detailSection}><span>Block topology</span><div className={styles.actionRow}><span className={styles.tag}>A</span><span className={styles.tag}>B</span><span className={styles.tag}>C</span></div></section>
            <section className={styles.detailSection}><span>Shared context</span><p className={styles.muted}>Use the same theme while measuring language-form objectives independently.</p></section>
          </article>
        </div>
      </section>
    </div>
  );
}
