import type { ReactNode } from "react";
import styles from "./BoProperties.module.css";

export type BoProperty = { key: string; label: string; value: ReactNode };

/** Presentation only: adapters own canonical values and authorized edit controls. */
export function BoProperties({ items, compact = false }: { items: readonly BoProperty[]; compact?: boolean }) {
  return <dl className={`${styles.grid}${compact ? ` ${styles.compact}` : ""}`}>
    {items.map(item => <div className={styles.item} key={item.key}><dt>{item.label}</dt><dd>{item.value ?? "—"}</dd></div>)}
  </dl>;
}
