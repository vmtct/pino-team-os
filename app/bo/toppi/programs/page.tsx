import { PageHeading, PrototypeBanner } from "../components";
import styles from "../toppi-bo.module.css";

const programs = [
  { code: "CC", name: "Confident Communication", stages: ["Spark · Lv1–3", "Connect · Lv4–6", "Present · Lv7–10"] },
  { code: "LF", name: "Language Foundation", stages: ["Core · Lv1–3", "Expand · Lv4–6", "Master · Lv7–10"] },
];

export default function ToppiProgramsPage() {
  return (
    <div className={styles.page}>
      <PrototypeBanner />
      <PageHeading
        title="Programs"
        subtitle="Toppi program and stage reference for BO. Program-specific curriculum authority will stay in Core; this page is presentation-only."
      />
      <section className={styles.grid2}>
        {programs.map((program) => (
          <article className={styles.panel} key={program.code}>
            <div className={styles.panelHeader}>
              <div><span className={styles.eyebrow}>{program.code}</span><h2>{program.name}</h2><p>10 deterministic progression Levels.</p></div>
            </div>
            <div className={styles.queue}>
              {program.stages.map((stage) => <div className={styles.queueItem} key={stage}><strong>{stage}</strong><span>12 units per Level</span></div>)}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
