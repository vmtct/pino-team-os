import { PageHeading, PrototypeBanner, StatusPill } from "../components";
import { mockRegistrations, programName } from "../mock-data";
import styles from "../toppi-bo.module.css";

export default function ToppiRegistrationsPage() {
  return (
    <div className={styles.page}>
      <PrototypeBanner />
      <PageHeading
        title="Registrations"
        subtitle="Pre-enrollment trial and placement intent. Registration stays separate from shared Student identity and durable Toppi Enrollment."
      />
      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>Acquisition queue</h2><p>Mock data only; no web lead or registration integration yet.</p></div></div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Learner</th><th>Guardian</th><th>Interest</th><th>Preferred slot</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {mockRegistrations.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.learner}</strong></td>
                  <td>{item.guardian}</td>
                  <td>{programName(item.program)}</td>
                  <td>{item.preferredSlot}</td>
                  <td><StatusPill value={item.status} /></td>
                  <td><button className={styles.secondaryButton}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
