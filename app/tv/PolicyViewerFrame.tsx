import type { ReactNode } from "react";
import type { TvPolicyViewerAspect } from "@/lib/pinoria-tv-viewer-layout";
import styles from "./policy-viewer-frame.module.css";

/**
 * PAP-650 / PNR-TV · PAP-1646: view-only presentational frame.
 *
 * No route, Core fetch, credentials, Policy identity, Device registration,
 * runtime cookie, heartbeat, renderer ACK, or operator command is introduced.
 * A separately authorized server-side Core read must gate future content.
 */
export function PolicyViewerFrame({
  aspect,
  children,
  label = "Pinoria TV",
}: Readonly<{
  aspect: TvPolicyViewerAspect;
  children: ReactNode;
  label?: string;
}>) {
  return (
    <main className={styles.stage} data-pnr-tv-viewer="view-only">
      <section
        className={aspect === "9:16" ? styles.portrait : styles.landscape}
        data-pnr-tv-frame={aspect}
        role="region"
        aria-label={label}
      >
        {children}
      </section>
    </main>
  );
}

/** Explicit unavailable content; never evidence of a live authorized viewer. */
export function PolicyViewerUnavailable() {
  return (
    <main className={styles.stage} data-pnr-tv-viewer="unavailable">
      <div className={styles.unavailable} role="status">
        <strong>Pinoria TV</strong>
        <span>Chưa thể mở trình chiếu. Policy đang chờ kết nối Core được cấp quyền.</span>
      </div>
    </main>
  );
}
