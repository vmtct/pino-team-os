import { BoContextCard } from "./BoContextCard";
import styles from "./bo.module.css";

export default function BoPage() {
  return (
    <section className={styles.page}>
      <div className={styles.heading}>
        <span>PINO TEAM · BACK OFFICE</span>
        <h1>Back Office</h1>
        <p>The canonical management surface is ready for explicitly authorized BO capabilities.</p>
      </div>
      <BoContextCard />
    </section>
  );
}
