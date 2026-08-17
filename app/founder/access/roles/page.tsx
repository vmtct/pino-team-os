import Link from "next/link";
import { AccessShell } from "../access-shell";
import styles from "../access.module.css";
import { permissionsForRole, prototypeRoles } from "@/lib/access-control-prototype";

export default function AccessRolesPage() {
  return <AccessShell
    title="Roles"
    subtitle="Role là configurable permission bundle. Founder/Admin có thể tạo role mới mà không cần code; authorization thật vẫn check permission + scope + context trên server."
  >
    <div className={styles.twoCol}>
      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div><h2>Role catalog</h2><p>SYSTEM role có structural protection; CUSTOM role có thể được chỉnh permission bundle khi spec/runtime đã integrated.</p></div>
          <button type="button" className={styles.buttonDisabled} disabled>+ Create role</button>
        </header>
        <div className={styles.roleList}>
          {prototypeRoles.map(role => <article className={styles.roleCard} key={role.id}>
            <div>
              <div className={styles.badges} style={{justifyContent:"flex-start",marginBottom:7}}>
                <span className={`${styles.badge} ${role.type === "SYSTEM" ? styles.system : styles.active}`}>{role.type}</span>
                <span className={`${styles.badge} ${role.status === "ACTIVE" ? styles.active : styles.suspended}`}>{role.status}</span>
                {role.protected ? <span className={`${styles.badge} ${styles.prototype}`}>PROTECTED</span> : null}
              </div>
              <h3>{role.name}</h3>
              <p>{role.description}</p>
              <div className={styles.meta}>key: {role.key}</div>
            </div>
            <div>
              <div className={styles.permissionCount}>{permissionsForRole(role).length} permissions</div>
              <div className={styles.buttonRow} style={{marginTop:10}}><Link className={styles.buttonGhost} href={`/founder/access/roles/${role.id}`}>Review role</Link></div>
            </div>
          </article>)}
        </div>
      </section>

      <aside className={styles.panel}>
        <header className={styles.panelHeader}><div><h2>Role doctrine</h2><p>Role UX phải đơn giản nhưng không được biến role name thành security primitive.</p></div></header>
        <div className={styles.legend}>
          <div className={styles.legendRow}><span>Role</span><span>Bundle permissions để dễ assign/quản trị.</span></div>
          <div className={styles.legendRow}><span>Permission</span><span>Atomic capability mà backend authorize.</span></div>
          <div className={styles.legendRow}><span>Scope</span><span>Được phép trong boundary nào.</span></div>
          <div className={styles.legendRow}><span>Context</span><span>Target resource hiện tại có thực sự thuộc actor không.</span></div>
        </div>
        <div className={styles.notice} style={{marginTop:14}}><strong>Không tạo role explosion:</strong> không tạo “Teacher Class A / Teacher Class B”. Dùng Teacher + scope/context.</div>
      </aside>
    </div>
  </AccessShell>;
}
