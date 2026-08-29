import type { ReactNode } from "react";
import styles from "./toppi-bo.module.css";

export function PrototypeBanner() {
  return (
    <div className={styles.prototypeBanner}>
      <strong>Toppi BO · canonical enrollment staging</strong>
      <span>Students, Enrollments, Schedule and Renewals use synthetic Core data · remaining modules are reference prototypes · production remains untouched</span>
    </div>
  );
}

export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <header className={styles.heading}>
      <div className={styles.headingCopy}>
        <span className={styles.eyebrow}>TOPPI · BACK OFFICE</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </header>
  );
}

export function Metric({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

export function Progress({ unit }: { unit: number }) {
  const bounded = Math.max(0, Math.min(unit, 12));
  return (
    <div className={styles.progress}>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${(bounded / 12) * 100}%` }} />
      </div>
      <span>{bounded} / 12 units</span>
    </div>
  );
}

export function StatusPill({ value }: { value: string }) {
  const warn = value === "DUE_SOON" || value === "AWAITING_RENEWAL" || value === "CONTINUITY_EXPIRING";
  const done = value === "COMPLETED";
  return <span className={`${styles.status} ${warn ? styles.statusWarn : ""} ${done ? styles.statusDone : ""}`}>{value.replaceAll("_", " ")}</span>;
}
