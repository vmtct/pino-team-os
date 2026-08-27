"use client";

import type { PinoriaWorldStateSnapshot } from "./shop-types";
import styles from "./world-state-ambient.module.css";

const motes = ["12%", "28%", "44%", "61%", "76%", "88%"] as const;

export function WorldStateAmbientOverlay({ state }: { state: PinoriaWorldStateSnapshot }) {
  return (
    <div
      className={styles.overlay}
      data-pinoria-world-state={state.id}
      data-pinoria-world-theme={state.ambientTheme}
      aria-hidden="true"
    >
      <div className={styles.tint} />
      <div className={styles.glow} />
      <div className={styles.motes}>
        {motes.map((left, index) => <i key={left} style={{ left, animationDelay: `${index * 410}ms` }} />)}
      </div>
    </div>
  );
}
