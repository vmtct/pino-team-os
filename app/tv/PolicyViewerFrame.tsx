import type { ReactNode } from "react";
import {
  policyViewerBlockedCopy,
  type PolicyViewerBlockedReason,
} from "@/lib/pinoria-tv-viewer-admission";
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

/** Explicitly blocked until the owning server verifies a published Policy. */
export function PolicyViewerUnavailable({
  reason = "unavailable",
}: Readonly<{ reason?: PolicyViewerBlockedReason }>) {
  const { heading, description } = policyViewerBlockedCopy(reason);
  return (
    <main
      className={styles.stage}
      data-pnr-tv-viewer="unavailable"
      data-pnr-tv-blocked-reason={reason}
    >
      <div className={styles.unavailable} role="status" aria-live="polite">
        <strong>{heading}</strong>
        <span>{description}</span>
      </div>
    </main>
  );
}
