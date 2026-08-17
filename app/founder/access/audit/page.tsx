import { AccessShell } from "../access-shell";
import styles from "../access.module.css";
import { prototypeAudit } from "@/lib/access-control-prototype";

export default function AccessAuditPage() {
  return <AccessShell
    title="Access Audit"
    subtitle="Append-only history để Founder/Manager biết ai đã đổi quyền gì, lúc nào. Prototype chỉ mô phỏng explainability; chưa có audit persistence mới."
  >
    <div className={styles.twoCol}>
      <section className={styles.panel}>
        <header className={styles.panelHeader}><div><h2>Access events</h2><p>Integrated version sẽ đọc canonical AuditEvent từ Core và không lưu secret/token trong payload.</p></div></header>
        <div className={styles.audit}>
          {prototypeAudit.map(event => <div className={styles.event} key={event.id}>
            <div className={styles.eventTime}>{event.at}</div>
            <div className={styles.eventAction}>{event.action}</div>
            <div className={styles.eventSummary}><strong>{event.target}</strong><span>Actor: {event.actor} · {event.summary}</span></div>
          </div>)}
        </div>
      </section>

      <aside className={styles.panel}>
        <header className={styles.panelHeader}><div><h2>Required event family</h2><p>Minimum event contract proposed for Access Control v1.</p></div></header>
        <div className={styles.effective}>
          {[
            "ACCESS_ROLE_CREATED",
            "ACCESS_ROLE_UPDATED",
            "ACCESS_ROLE_ARCHIVED",
            "ACCESS_ROLE_PERMISSION_CHANGED",
            "ACCESS_ROLE_ASSIGNED",
            "ACCESS_ROLE_REMOVED",
            "ACCESS_USER_SUSPENDED",
            "ACCESS_USER_REACTIVATED",
          ].map(event => <code key={event}>{event}</code>)}
        </div>
        <div className={styles.notice} style={{marginTop:14}}><strong>Doctrine:</strong> privileged mutation không có audit event tương ứng thì chưa đạt Definition of Done.</div>
      </aside>
    </div>
  </AccessShell>;
}
