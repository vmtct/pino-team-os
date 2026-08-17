import Link from "next/link";
import styles from "./policies.module.css";

export function PolicyShell({ title, subtitle, children }:{ title:string; subtitle:string; children:React.ReactNode }) {
  return <div className={styles.shell}>
    <header className={styles.top}>
      <div>
        <p className={styles.eyebrow}>Founder control plane</p>
        <h1>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
      <div className={styles.badges}>
        <span className={`${styles.badge} ${styles.prototype}`}>PROTOTYPE · MOCK</span>
        <span className={`${styles.badge} ${styles.approved}`}>ARCHITECTURE APPROVED</span>
      </div>
    </header>
    <nav className={styles.tabs} aria-label="Policy Center">
      <Link href="/founder/policies">Policy catalog</Link>
      <Link href="/founder/policies/workforce">Workforce</Link>
    </nav>
    {children}
  </div>;
}

export function PolicyStatusBadge({ status }:{ status:"ACTIVE"|"SCHEDULED"|"SUPERSEDED" }) {
  const className = status === "ACTIVE" ? styles.active : status === "SCHEDULED" ? styles.scheduled : styles.superseded;
  return <span className={`${styles.badge} ${className}`}>{status}</span>;
}
