import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./access.module.css";

export function AccessShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <div className={styles.shell}>
    <header className={styles.top}>
      <div>
        <p className={styles.eyebrow}>PINO · TOS ACCESS CONTROL</p>
        <h1>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
      <div className={styles.badges}>
        <span className={`${styles.badge} ${styles.prototype}`}>PROTOTYPE / MOCK DATA</span>
        <span className={`${styles.badge} ${styles.proposed}`}>SPEC PROPOSED</span>
      </div>
    </header>
    <nav className={styles.nav} aria-label="Access Control prototype">
      <Link href="/founder/access">Overview</Link>
      <Link href="/founder/access/users">Users</Link>
      <Link href="/founder/access/roles">Roles</Link>
      <Link href="/founder/access/audit">Audit</Link>
    </nav>
    {children}
  </div>;
}

export function StatusBadge({ status }: { status: "ACTIVE" | "SUSPENDED" | "ARCHIVED" }) {
  return <span className={`${styles.badge} ${status === "ACTIVE" ? styles.active : styles.suspended}`}>{status}</span>;
}
