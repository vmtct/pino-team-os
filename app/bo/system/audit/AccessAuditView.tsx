"use client";

import { useEffect, useState } from "react";
import { boApi } from "@/lib/bo-api";
import type { BoAccessAuditEvent } from "@/lib/bo-access-model";
import styles from "../../bo.module.css";

export function AccessAuditView() {
  const [events, setEvents] = useState<BoAccessAuditEvent[]>([]);
  const [error, setError] = useState("");

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    try { setError(""); setEvents(await boApi.accessAudit(100)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải Access audit."); }
  }

  return <section className={styles.page}>
    <header className={styles.heading}><span>PINO TEAM · SYSTEM</span><h1>Audit</h1><p>Privileged Access administration history, newest first. JWT, OTP, PIN và bearer credentials không thuộc audit payload.</p></header>
    {error ? <p className={styles.ownerError}>{error}</p> : null}
    <section className={styles.panel}>
      <div className={styles.panelHeading}><div><h2>Access events</h2><p>Bounded to the latest 100 canonical ACCESS_* events.</p></div><button className={styles.secondaryButton} onClick={() => void refresh()}>Refresh</button></div>
      <div className={styles.ownerQueue}>
        {events.map((event) => <article className={styles.ownerRow} key={event.id}>
          <div className={styles.ownerMeta}><strong>{event.action}</strong><span>{new Date(event.occurredAt).toLocaleString("vi-VN")} · {event.outcome}</span><small>{event.actorType}:{event.actorId ?? "system"} → {event.subjectType}:{event.subjectId ?? "n/a"}</small></div>
          <small className={styles.staffAccessMeta}>Request {event.requestId}</small>
        </article>)}
      </div>
    </section>
  </section>;
}
