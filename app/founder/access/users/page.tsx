import { AccessShell, StatusBadge } from "../access-shell";
import styles from "../access.module.css";
import { effectivePermissionKeys, prototypeUsers, roleById } from "@/lib/access-control-prototype";

export default function AccessUsersPage() {
  return <AccessShell
    title="Access Users"
    subtitle="User là system identity; StaffMember là employment identity. Prototype này review cách Founder nhìn role assignment, scope và effective access mà không trộn job title thành authorization."
  >
    <div className={styles.twoCol}>
      <section className={styles.userGrid}>
        {prototypeUsers.map(user => {
          const effective = effectivePermissionKeys(user);
          return <article className={styles.userCard} key={user.id}>
            <div className={styles.panelHeader}>
              <div><h3>{user.name}</h3><div className={styles.meta}>{user.staffLabel}</div></div>
              <StatusBadge status={user.status} />
            </div>
            <div className={styles.assignments}>
              {user.assignments.map(assignment => {
                const role = roleById(assignment.roleId);
                return <div className={styles.assignment} key={assignment.id}>
                  <div><strong>{role?.name ?? assignment.roleId}</strong><div className={styles.meta}>{role?.type ?? "—"} role</div></div>
                  <span className={styles.scope}>{assignment.scopeType} · {assignment.scopeLabel}</span>
                </div>;
              })}
            </div>
            <h4 className={styles.sectionTitle}>Effective access</h4>
            <div className={styles.effective}>
              {effective.length ? effective.slice(0,8).map(key => <code key={key}>{key}</code>) : <span className={styles.muted}>No effective permissions</span>}
              {effective.length > 8 ? <code>+{effective.length - 8} more</code> : null}
            </div>
            <div className={styles.buttonRow} style={{marginTop:14}}>
              <button type="button" className={styles.buttonDisabled} disabled>Assign role</button>
              <button type="button" className={styles.buttonDisabled} disabled>{user.status === "ACTIVE" ? "Suspend" : "Reactivate"}</button>
            </div>
          </article>;
        })}
      </section>

      <aside className={styles.panel}>
        <header className={styles.panelHeader}><div><h2>User lifecycle</h2><p>Prototype contract before backend integration.</p></div></header>
        <div className={styles.legend}>
          <div className={styles.legendRow}><span>ACTIVE</span><span>May receive effective access from active assignments.</span></div>
          <div className={styles.legendRow}><span>SUSPENDED</span><span>Employment stays intact, protected TOS access resolves to deny.</span></div>
          <div className={styles.legendRow}><span>Assignment</span><span>User → Role → Scope; one user may have multiple assignments.</span></div>
          <div className={styles.legendRow}><span>Effective</span><span>Computed from current role permissions + scope + contextual policy, not copied into a long-lived token.</span></div>
        </div>
        <div className={styles.danger}><strong>Break-glass invariant:</strong> ordinary user management must not suspend the last active Founder-equivalent user.</div>
      </aside>
    </div>
  </AccessShell>;
}
