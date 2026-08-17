import Link from "next/link";
import { AccessShell, StatusBadge } from "./access-shell";
import styles from "./access.module.css";
import { effectivePermissionKeys, prototypeAudit, prototypeRoles, prototypeUsers, roleById } from "@/lib/access-control-prototype";

export default function AccessControlOverviewPage() {
  const activeUsers = prototypeUsers.filter(user => user.status === "ACTIVE").length;
  const customRoles = prototypeRoles.filter(role => role.type === "CUSTOM" && role.status === "ACTIVE").length;
  const scopedAssignments = prototypeUsers.flatMap(user => user.assignments).filter(assignment => assignment.scopeType !== "GLOBAL").length;

  return <AccessShell
    title="Access Control"
    subtitle="Khung phân quyền nền của TOS: User → Role → Permission → Scope → Context. Prototype này chỉ để review information architecture; chưa ghi Core/D1 và chưa thay đổi production access."
  >
    <section className={styles.summary}>
      <div className={styles.metric}><span>Active users</span><strong>{activeUsers}</strong></div>
      <div className={styles.metric}><span>Active custom roles</span><strong>{customRoles}</strong></div>
      <div className={styles.metric}><span>Scoped assignments</span><strong>{scopedAssignments}</strong></div>
      <div className={styles.metric}><span>Doctrine</span><strong>Default deny</strong></div>
    </section>

    <div className={styles.workspace}>
      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div><h2>Users & effective access</h2><p>Role names chỉ để quản trị. Effective access được hiểu bằng permission + scope; user suspended có effective access rỗng.</p></div>
          <Link className={styles.buttonGhost} href="/founder/access/users">View users</Link>
        </header>
        <table className={styles.table}>
          <thead><tr><th>User</th><th>Status</th><th>Assignments</th><th>Effective permissions</th></tr></thead>
          <tbody>
            {prototypeUsers.map(user => <tr key={user.id}>
              <td><div className={styles.name}>{user.name}</div><div className={styles.meta}>{user.staffLabel}</div></td>
              <td><StatusBadge status={user.status} /></td>
              <td>{user.assignments.map(assignment => {
                const role = roleById(assignment.roleId);
                return <div key={assignment.id} className={styles.meta}><strong>{role?.name ?? assignment.roleId}</strong><br/><span className={styles.scope}>{assignment.scopeType} · {assignment.scopeLabel}</span></div>;
              })}</td>
              <td><div className={styles.name}>{effectivePermissionKeys(user).length}</div><div className={styles.meta}>permission keys</div></td>
            </tr>)}
          </tbody>
        </table>
      </section>

      <aside className={styles.panel}>
        <header className={styles.panelHeader}><div><h2>Doctrine checkpoint</h2><p>Những rule này sẽ được Codex enforce khi spec được APPROVED.</p></div></header>
        <div className={styles.legend}>
          <div className={styles.legendRow}><span>Deny default</span><span>Không có explicit grant → deny.</span></div>
          <div className={styles.legendRow}><span>Permission</span><span>Authorize action, không authorize bằng tên role/job title.</span></div>
          <div className={styles.legendRow}><span>Scope</span><span>GLOBAL / CENTER / PATH / RUNNING_CLASS.</span></div>
          <div className={styles.legendRow}><span>Context</span><span>Ví dụ teacher chỉ submit Session mình được assign/cover.</span></div>
          <div className={styles.legendRow}><span>Server</span><span>Hide button không phải security boundary.</span></div>
          <div className={styles.legendRow}><span>Audit</span><span>Mọi privileged mutation phải có event.</span></div>
        </div>
        <div className={styles.notice} style={{marginTop:14}}><strong>Protected Founder:</strong> system phải ngăn remove/suspend last active Founder-equivalent user.</div>
      </aside>
    </div>

    <section className={`${styles.panel} ${styles.sectionTitle}`} style={{marginTop:16}}>
      <header className={styles.panelHeader}>
        <div><h2>Latest access events</h2><p>Mock audit stream để review mức explainability cần có trong TOS.</p></div>
        <Link className={styles.buttonGhost} href="/founder/access/audit">Full audit</Link>
      </header>
      <div className={styles.audit}>{prototypeAudit.slice(0,3).map(event => <div className={styles.event} key={event.id}><div className={styles.eventTime}>{event.at}</div><div className={styles.eventAction}>{event.action}</div><div className={styles.eventSummary}><strong>{event.target}</strong><span>{event.actor} · {event.summary}</span></div></div>)}</div>
    </section>
  </AccessShell>;
}
