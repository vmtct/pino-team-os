import Link from "next/link";
import styles from "./access.module.css";

export const dynamic = "force-dynamic";

type View = "users" | "roles" | "permissions" | "audit";
type Params = { view?: string; id?: string };

const users = [
  { id: "tri", name: "Văn Minh Trị", staff: "Founder", status: "ACTIVE", roles: ["Founder"], scope: "GLOBAL" },
  { id: "hang", name: "Hằng", staff: "Operations", status: "ACTIVE", roles: ["Manager", "Workforce Manager"], scope: "GLOBAL" },
  { id: "bao", name: "Bảo", staff: "PianoHouse", status: "ACTIVE", roles: ["Teacher"], scope: "PATH · PIANO HOUSE" },
  { id: "demo", name: "Demo Suspended User", staff: "—", status: "SUSPENDED", roles: ["Teacher"], scope: "RUNNING CLASS" },
];

const roles = [
  { id: "founder", name: "Founder", type: "SYSTEM", members: 1, permissions: 18, description: "Protected break-glass administration role." },
  { id: "manager", name: "Manager", type: "SYSTEM", members: 1, permissions: 10, description: "Broad operating access without system ownership." },
  { id: "workforce-manager", name: "Workforce Manager", type: "CUSTOM", members: 1, permissions: 5, description: "Plans, assigns and publishes workforce coverage." },
  { id: "teacher", name: "Teacher", type: "CUSTOM", members: 2, permissions: 4, description: "Assigned-class teaching and evidence actions." },
];

const permissionGroups = [
  {
    name: "Access Control",
    items: [
      ["access.user.view", "View users"],
      ["access.user.manage", "Manage user status"],
      ["access.role.view", "View roles"],
      ["access.role.create", "Create custom roles"],
      ["access.role.edit", "Edit role permissions"],
      ["access.role.archive", "Archive custom roles"],
      ["access.role.assign", "Assign roles"],
      ["access.audit.view", "View access audit"],
    ],
  },
  {
    name: "Workforce",
    items: [
      ["workforce.plan.view", "View workforce plans"],
      ["workforce.plan.edit", "Edit workforce plans"],
      ["workforce.plan.publish", "Publish workforce plans"],
      ["workforce.assignment.assign", "Assign staff to coverage"],
      ["workforce.policy.manage", "Manage Founder staffing policy"],
    ],
  },
  {
    name: "Sessions & Students",
    items: [
      ["session.attendance.submit", "Submit attendance"],
      ["session.evidence.submit", "Submit evidence"],
      ["student.profile.view", "View student profile"],
    ],
  },
];

const audit = [
  { time: "16:42", text: "Tri assigned Workforce Manager to Hằng · GLOBAL", event: "ACCESS_ROLE_ASSIGNED" },
  { time: "16:36", text: "Tri created custom role Workforce Manager", event: "ACCESS_ROLE_CREATED" },
  { time: "16:21", text: "Tri suspended Demo Suspended User", event: "ACCESS_USER_SUSPENDED" },
  { time: "15:58", text: "Founder system role permission set inspected", event: "ACCESS_AUDIT_VIEWED" },
];

export default async function AccessPrototypePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const view: View = ["users", "roles", "permissions", "audit"].includes(params.view || "") ? params.view as View : "users";

  return <div className={styles.shell}>
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>TOS · ACCESS CONTROL</p>
        <h1>Access Control</h1>
        <p className={styles.subtitle}>Ai được làm gì, ở đâu, trong ngữ cảnh nào.</p>
      </div>
      <span className={styles.prototype}>PROTOTYPE / MOCK DATA</span>
    </header>

    <nav className={styles.tabs} aria-label="Access Control prototype sections">
      <Tab view="users" current={view}>Users</Tab>
      <Tab view="roles" current={view}>Roles</Tab>
      <Tab view="permissions" current={view}>Permissions</Tab>
      <Tab view="audit" current={view}>Audit</Tab>
    </nav>

    <div className={styles.notice}>Prototype only. Không tạo User, Role, Permission hoặc D1 record thật. Mục tiêu vòng này là duyệt information architecture và workflow trước khi Codex implement backend.</div>

    {view === "users" ? <UsersView selectedId={params.id || users[0].id} /> : null}
    {view === "roles" ? <RolesView selectedId={params.id || roles[2].id} /> : null}
    {view === "permissions" ? <PermissionsView /> : null}
    {view === "audit" ? <AuditView /> : null}
  </div>;
}

function Tab({ view, current, children }: { view: View; current: View; children: React.ReactNode }) {
  return <Link className={`${styles.tab} ${view === current ? styles.tabActive : ""}`} href={`/founder/access?view=${view}`}>{children}</Link>;
}

function UsersView({ selectedId }: { selectedId: string }) {
  const user = users.find(item => item.id === selectedId) || users[0];
  return <section className={styles.workspace}>
    <aside className={styles.rail}>
      <div className={styles.railTitle}><strong>Users</strong><span className={styles.count}>{users.length}</span></div>
      <div className={styles.list}>{users.map(item => <Link key={item.id} href={`/founder/access?view=users&id=${item.id}`} className={`${styles.item} ${item.id === user.id ? styles.itemActive : ""}`}>
        <span className={styles.itemTop}><strong>{item.name}</strong><span className={`${styles.status} ${item.status === "ACTIVE" ? styles.active : styles.suspended}`}>{item.status}</span></span>
        <span className={styles.meta}>{item.staff} · {item.roles.join(", ")}</span>
      </Link>)}</div>
    </aside>
    <div className={styles.content}>
      <div className={styles.contentTop}>
        <div><h2>{user.name}</h2><p>System identity linked to StaffMember where available.</p></div>
        <div className={styles.actions}><button className={styles.buttonGhost}>Suspend user</button><button className={styles.button}>+ Assign role</button></div>
      </div>
      <div className={styles.summary}>
        <Metric value={user.status} label="Account status" />
        <Metric value={String(user.roles.length)} label="Assigned roles" />
        <Metric value={user.scope} label="Broadest scope" />
        <Metric value={user.status === "ACTIVE" ? "ALLOW" : "DENY"} label="Protected access" />
      </div>
      <div className={styles.grid2}>
        <div className={styles.card}><h3>Assigned roles</h3><div className={styles.roleRows}>{user.roles.map(role => <div className={styles.roleRow} key={role}><span className={styles.roleName}>{role}</span><span className={styles.scope}>{user.scope}</span></div>)}</div></div>
        <div className={styles.card}><h3>Effective access</h3><div className={styles.permissionRows}>
          <Effective label="Workforce" value={user.id === "tri" || user.id === "hang" ? "Manage" : "Assigned only"} />
          <Effective label="Students" value={user.status === "ACTIVE" ? "Scoped" : "None"} />
          <Effective label="Access Control" value={user.id === "tri" ? "Full" : "None"} />
          <Effective label="Audit" value={user.id === "tri" ? "View" : "None"} />
        </div></div>
      </div>
      <div className={styles.card} style={{marginTop:14}}><span className={styles.label}>Important distinction</span><div className={styles.value}>StaffMember = người làm việc tại PINO. User = identity có thể đăng nhập hệ thống. Suspend User không làm mất Staff history.</div></div>
    </div>
  </section>;
}

function RolesView({ selectedId }: { selectedId: string }) {
  const role = roles.find(item => item.id === selectedId) || roles[0];
  const workforceRole = role.id === "workforce-manager";
  const teacherRole = role.id === "teacher";
  return <section className={styles.workspace}>
    <aside className={styles.rail}>
      <div className={styles.railTitle}><strong>Roles</strong><span className={styles.count}>{roles.length}</span></div>
      <div className={styles.list}>{roles.map(item => <Link key={item.id} href={`/founder/access?view=roles&id=${item.id}`} className={`${styles.item} ${item.id === role.id ? styles.itemActive : ""}`}>
        <span className={styles.itemTop}><strong>{item.name}</strong><span className={`${styles.status} ${item.type === "SYSTEM" ? styles.system : styles.custom}`}>{item.type}</span></span>
        <span className={styles.meta}>{item.members} users · {item.permissions} permissions</span>
      </Link>)}</div>
    </aside>
    <div className={styles.content}>
      <div className={styles.contentTop}>
        <div><h2>{role.name}</h2><p>{role.description}</p></div>
        <div className={styles.actions}><button className={styles.buttonGhost}>{role.type === "SYSTEM" ? "Protected role" : "Archive"}</button><button className={styles.button}>Save role</button></div>
      </div>
      <div className={styles.grid2}>
        <div className={styles.card}><span className={styles.label}>Role type</span><div className={styles.value}>{role.type} · {role.type === "SYSTEM" ? "structural protections apply" : "Founder configurable"}</div></div>
        <div className={styles.card}><span className={styles.label}>Assignment model</span><div className={styles.value}>User → Role → Scope. Role name itself never authorizes server actions.</div></div>
      </div>
      {permissionGroups.map(group => <div className={styles.permissionGroup} key={group.name}><h4>{group.name}</h4><div className={styles.card}><div className={styles.permissionRows}>{group.items.map(([key, label]) => {
        const granted = role.id === "founder" || role.id === "manager" && !key.startsWith("access.role") || workforceRole && key.startsWith("workforce.") && key !== "workforce.policy.manage" || teacherRole && ["session.attendance.submit","session.evidence.submit","student.profile.view"].includes(key);
        return <div className={styles.permissionRow} key={key}><span><span className={`${styles.check} ${granted ? styles.checkOn : ""}`}>{granted ? "✓" : ""}</span> &nbsp;{key}<span className={styles.meta}>{label}</span></span><span className={granted ? styles.grant : styles.deny}>{granted ? "GRANTED" : "NO GRANT"}</span></div>;
      })}</div></div></div>)}
    </div>
  </section>;
}

function PermissionsView() {
  const total = permissionGroups.reduce((sum, group) => sum + group.items.length, 0);
  return <section className={styles.workspace}>
    <aside className={styles.rail}><div className={styles.railTitle}><strong>Permission registry</strong><span className={styles.count}>{total}</span></div><p className={styles.meta}>Stable machine contracts. Feature code không tự phát minh permission string.</p></aside>
    <div className={styles.content}>
      <div className={styles.contentTop}><div><h2>Canonical permissions</h2><p>Pattern: domain.resource.action</p></div><div className={styles.actions}><button className={styles.buttonGhost}>Registry rules</button></div></div>
      {permissionGroups.map(group => <div className={styles.permissionGroup} key={group.name}><h4>{group.name}</h4><div className={styles.card}><div className={styles.permissionRows}>{group.items.map(([key, label]) => <div className={styles.permissionRow} key={key}><span>{key}<span className={styles.meta}>{label}</span></span><span className={styles.status + " " + styles.active}>REGISTERED</span></div>)}</div></div></div>)}
    </div>
  </section>;
}

function AuditView() {
  return <section className={styles.workspace}>
    <aside className={styles.rail}><div className={styles.railTitle}><strong>Audit</strong><span className={styles.count}>Today</span></div><p className={styles.meta}>Append-only explanation of privileged access changes.</p></aside>
    <div className={styles.content}>
      <div className={styles.contentTop}><div><h2>Access audit</h2><p>Who changed what access, when, and on which target.</p></div><div className={styles.actions}><button className={styles.buttonGhost}>Filter events</button></div></div>
      <div className={styles.card}><div className={styles.auditRows}>{audit.map((item, index) => <div className={styles.auditRow} key={index}><span className={styles.auditTime}>{item.time}</span><span className={styles.auditText}><strong>{item.event}</strong><br />{item.text}</span></div>)}</div></div>
      <div className={styles.card} style={{marginTop:14}}><span className={styles.label}>Doctrine</span><div className={styles.value}>Assignment records access. Authorization decides current ability. Audit explains changes and privileged actions.</div></div>
    </div>
  </section>;
}

function Metric({ value, label }: { value: string; label: string }) { return <div className={styles.metric}><b>{value}</b><span>{label}</span></div>; }
function Effective({ label, value }: { label: string; value: string }) { return <div className={styles.permissionRow}><span className={styles.roleName}>{label}</span><span className={value === "None" ? styles.deny : styles.grant}>{value}</span></div>; }
