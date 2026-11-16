import type { ReactNode } from "react";
import styles from "./BoProperties.module.css";

export type BoProperty = { key: string; label: string; value: ReactNode; icon?: string };

/** Presentation only: adapters own canonical values and authorized edit controls. */
export function BoProperties({ items, compact = false, authority = false }: { items: readonly BoProperty[]; compact?: boolean; authority?: boolean }) {
  if (authority) return <div role="list">{items.map(item => <div className="property-row" role="listitem" key={item.key}><div className="property-label"><small aria-hidden="true">{item.icon ?? "≡"}</small>{item.label}</div><div className="property-control" aria-label={item.label}>{item.value ?? "—"}</div></div>)}</div>;
  return <dl className={`${styles.grid}${compact ? ` ${styles.compact}` : ""}`}>
    {items.map(item => <div className={styles.item} key={item.key}><dt>{item.label}</dt><dd>{item.value ?? "—"}</dd></div>)}
  </dl>;
}
