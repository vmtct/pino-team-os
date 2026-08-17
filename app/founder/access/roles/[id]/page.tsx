import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessShell } from "../../access-shell";
import styles from "../../access.module.css";
import { permissionsForRole, prototypePermissions, roleById } from "@/lib/access-control-prototype";

export default async function AccessRoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = roleById(id);
  if (!role) notFound();
  const selected = new Set(role.permissionKeys);
  const groups = [...new Set(prototypePermissions.map(permission => permission.group))];

  return <AccessShell
    title="Role Builder"
    subtitle="Review cách Founder/Admin hiểu và cấu hình một permission bundle. Tất cả checkbox hiện chỉ là mock; Save bị disabled vì Core access-control runtime chưa được APPROVED/implemented."
  >
    <Link href="/founder/access/roles" className={styles.back}>← Back to roles</Link>
    <section className={styles.panel}>
      <header className={styles.roleHeader}>
        <div>
          <div className={styles.badges} style={{justifyContent:"flex-start",marginBottom:8}}>
            <span className={`${styles.badge} ${role.type === "SYSTEM" ? styles.system : styles.active}`}>{role.type}</span>
            {role.protected ? <span className={`${styles.badge} ${styles.prototype}`}>PROTECTED</span> : null}
          </div>
          <h2>{role.name}</h2>
          <p>{role.description}</p>
          <div className={styles.meta}>Stable key: {role.key}</div>
        </div>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.buttonDisabled} disabled>Save role</button>
          {role.type === "CUSTOM" ? <button type="button" className={styles.buttonDisabled} disabled>Archive</button> : null}
        </div>
      </header>

      <div className={styles.notice}><strong>Authorization note:</strong> backend sẽ authorize bằng permission key, không bằng tên “{role.name}”. Scope được gắn ở Role Assignment, không nằm trong Role.</div>

      {groups.map(group => <section key={group}>
        <h3 className={styles.sectionTitle}>{group}</h3>
        <div className={styles.checklist}>
          {prototypePermissions.filter(permission => permission.group === group).map(permission => <label className={styles.check} key={permission.key}>
            <input type="checkbox" checked={selected.has(permission.key)} readOnly disabled={role.protected} />
            <span><strong>{permission.label}</strong><code>{permission.key}</code><span>{permission.description}</span></span>
          </label>)}
        </div>
      </section>)}

      {role.protected ? <div className={styles.danger}><strong>Protected system role:</strong> integrated runtime phải ngăn archive/delete role này và ngăn remove/suspend last active Founder-equivalent assignment.</div> : null}
    </section>
  </AccessShell>;
}
