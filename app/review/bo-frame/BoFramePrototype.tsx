"use client";

import { useMemo, useState } from "react";
import styles from "./bo-frame.module.css";

type SectionId =
  | "home"
  | "learners"
  | "delivery"
  | "open-studio"
  | "programs"
  | "practice"
  | "staff"
  | "schedule"
  | "economy"
  | "collection"
  | "access"
  | "policies"
  | "audit";

type NavItem = { id: SectionId; label: string; hint?: string };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  { label: "Workspace", items: [{ id: "home", label: "Hôm nay" }] },
  { label: "Operations", items: [
    { id: "learners", label: "Learners" },
    { id: "delivery", label: "Delivery" },
    { id: "open-studio", label: "Open Studio" },
  ] },
  { label: "Learning", items: [
    { id: "programs", label: "Programs & Syllabus" },
    { id: "practice", label: "Practice" },
  ] },
  { label: "Workforce", items: [
    { id: "staff", label: "Staff" },
    { id: "schedule", label: "Schedule & Time" },
  ] },
  { label: "Pinoria", items: [
    { id: "economy", label: "Economy" },
    { id: "collection", label: "Collection" },
  ] },
  { label: "System", items: [
    { id: "access", label: "Access" },
    { id: "policies", label: "Policies" },
    { id: "audit", label: "Audit" },
  ] },
];

const sectionMeta: Record<SectionId, { eyebrow: string; title: string; description: string; tabs: string[] }> = {
  home: { eyebrow: "PINO House · Cần Thơ", title: "Hôm nay", description: "Một màn hình để biết trung tâm đang ổn ở đâu và cần xử lý gì trước.", tabs: ["Tổng quan"] },
  learners: { eyebrow: "Operations", title: "Learners", description: "Hồ sơ, membership, placement và hành trình của học viên.", tabs: ["Danh sách", "Chờ xếp lớp", "Membership", "Guardians"] },
  delivery: { eyebrow: "Operations", title: "Delivery", description: "Không gian, lớp đang chạy, session và attendance trong một context.", tabs: ["Lớp đang chạy", "Sessions", "Attendance", "Registrations"] },
  "open-studio": { eyebrow: "Operations", title: "Open Studio", description: "Acquisition, booking, capacity và conversion từ trải nghiệm vào chương trình.", tabs: ["Lịch mở", "Bookings", "Participants", "Conversion"] },
  programs: { eyebrow: "Learning", title: "Programs & Syllabus", description: "Quản lý cấu trúc chương trình, version giáo án và nội dung được publish.", tabs: ["Programs", "Syllabus", "Versions", "Publishing"] },
  practice: { eyebrow: "Learning", title: "Practice", description: "Tài nguyên luyện tập, repertoire access và content pages.", tabs: ["Library", "Repertoire", "Access", "Publishing"] },
  staff: { eyebrow: "Workforce", title: "Staff", description: "Hồ sơ nhân sự, onboarding, role assignment và trạng thái làm việc.", tabs: ["Directory", "Onboarding", "Assignments"] },
  schedule: { eyebrow: "Workforce", title: "Schedule & Time", description: "Planning ca tuần, availability, chấm công và ngoại lệ.", tabs: ["Tuần này", "Availability", "Timesheet", "Exceptions"] },
  economy: { eyebrow: "Pinoria", title: "Economy", description: "PLS, Seed, Wish, reward rules và các control cần quan sát.", tabs: ["Overview", "Wish", "Rewards", "Activity"] },
  collection: { eyebrow: "Pinoria", title: "Collection", description: "Wearables, loadout, companion và inventory học viên.", tabs: ["Wardrobe", "Companions", "Inventory"] },
  access: { eyebrow: "System", title: "Access", description: "Users, roles và scope. UI chỉ phản ánh authority từ Core.", tabs: ["Users", "Roles", "Assignments"] },
  policies: { eyebrow: "System", title: "Policies", description: "Surface canonical rules theo domain mà không biến BO thành policy owner.", tabs: ["Effective", "Drafts", "History"] },
  audit: { eyebrow: "System", title: "Audit", description: "Dòng sự kiện thay đổi có thể truy vết, ưu tiên hành động quan trọng.", tabs: ["Recent", "Access", "Operations", "Exports"] },
};

const attention = [
  { tone: "high", label: "2 learner chưa có placement", meta: "Cần xử lý trước lịch tối nay", section: "learners" as SectionId },
  { tone: "medium", label: "Ca 18:00 thiếu 1 TA", meta: "PianoHouse · 18:00–19:30", section: "schedule" as SectionId },
  { tone: "medium", label: "1 staff cần đổi PIN", meta: "Onboarding gate", section: "staff" as SectionId },
  { tone: "low", label: "Wish banner đang ở Draft", meta: "Mid-Autumn collection", section: "economy" as SectionId },
];

const sessions = [
  { time: "18:00", name: "PianoHouse", room: "Piano", load: "8 / 8", state: "Đủ" },
  { time: "18:00", name: "ArtChitect", room: "Art", load: "4 / 5", state: "Ổn" },
  { time: "19:00", name: "Toppi", room: "House", load: "6 / 8", state: "Ổn" },
  { time: "19:30", name: "Little Piner", room: "Glass", load: "5 / 6", state: "Ổn" },
];

function Dot({ tone }: { tone: "high" | "medium" | "low" }) {
  return <span className={`${styles.dot} ${styles[`dot_${tone}`]}`} aria-hidden="true" />;
}

export function BoFramePrototype() {
  const [active, setActive] = useState<SectionId>("home");
  const [activeTab, setActiveTab] = useState(0);
  const [commandOpen, setCommandOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const meta = sectionMeta[active];
  const flatNav = useMemo(() => navGroups.flatMap((group) => group.items), []);

  function choose(section: SectionId) {
    setActive(section);
    setActiveTab(0);
    setCommandOpen(false);
    setMenuOpen(false);
  }

  return (
    <div className={styles.reviewShell}>
      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>P</span>
          <div><strong>PINO House</strong><small>Back Office</small></div>
          <button className={styles.closeMenu} onClick={() => setMenuOpen(false)} aria-label="Đóng menu">×</button>
        </div>
        <div className={styles.prototypeBadge}>PLT-BO · F1 PROTOTYPE</div>
        <nav className={styles.nav} aria-label="BO prototype navigation">
          {navGroups.map((group) => (
            <section className={styles.navGroup} key={group.label}>
              <span>{group.label}</span>
              {group.items.map((item) => (
                <button type="button" key={item.id} className={item.id === active ? styles.navActive : ""} onClick={() => choose(item.id)}>
                  <i aria-hidden="true" /><b>{item.label}</b>
                </button>
              ))}
            </section>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <span className={styles.avatar}>TM</span>
          <div><strong>Founder</strong><small>Global scope</small></div>
          <button type="button" aria-label="More">•••</button>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <button className={styles.menuButton} onClick={() => setMenuOpen(true)} aria-label="Mở menu">☰</button>
          <button className={styles.centerPicker} type="button">
            <span>PINO House · Cần Thơ</span><small>2026-H2 · W36</small><b>⌄</b>
          </button>
          <button className={styles.commandButton} type="button" onClick={() => setCommandOpen(true)}>
            <span>Tìm learner, class, staff…</span><kbd>⌘ K</kbd>
          </button>
          <div className={styles.topActions}>
            <button type="button" aria-label="Thông báo">3</button><span className={styles.avatarSmall}>TM</span>
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.pageHeader}>
            <div><span className={styles.eyebrow}>{meta.eyebrow}</span><h1>{meta.title}</h1><p>{meta.description}</p></div>
            <div className={styles.headerMeta}><span>Prototype</span><small>Dữ liệu minh họa</small></div>
          </div>
          <div className={styles.tabs} role="tablist">
            {meta.tabs.map((tab, index) => (
              <button key={tab} type="button" role="tab" aria-selected={activeTab === index} className={activeTab === index ? styles.tabActive : ""} onClick={() => setActiveTab(index)}>{tab}</button>
            ))}
          </div>
          {active === "home" ? <HomeDashboard choose={choose} /> : <SectionPreview active={active} tab={meta.tabs[activeTab]} />}
        </main>
      </div>

      {menuOpen ? <button className={styles.scrim} onClick={() => setMenuOpen(false)} aria-label="Đóng menu" /> : null}
      {commandOpen ? (
        <div className={styles.commandScrim} onMouseDown={() => setCommandOpen(false)}>
          <section className={styles.commandPalette} onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.commandInput}><span>⌕</span><input autoFocus placeholder="Đi tới…" aria-label="Đi tới section" /><kbd>ESC</kbd></div>
            <small className={styles.commandLabel}>Đi nhanh</small>
            {flatNav.slice(0, 8).map((item) => (
              <button type="button" key={item.id} onClick={() => choose(item.id)}><span>{item.label}</span><small>{sectionMeta[item.id].eyebrow}</small></button>
            ))}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function HomeDashboard({ choose }: { choose: (section: SectionId) => void }) {
  return (
    <div className={styles.homeGrid}>
      <section className={styles.homePrimary}>
        <div className={styles.metricGrid}>
          <Metric label="Active learners" value="29" meta="+3 từ Open Studio" />
          <Metric label="Lớp tối nay" value="4" meta="23 learner dự kiến" />
          <Metric label="Coverage" value="92%" meta="Thiếu 1 TA lúc 18:00" warn />
          <Metric label="Cần xử lý" value="4" meta="2 ưu tiên cao" warn />
        </div>
        <article className={styles.panel}>
          <div className={styles.panelHeader}><div><span>Tonight</span><h2>Lịch vận hành</h2></div><button type="button" onClick={() => choose("delivery")}>Mở Delivery →</button></div>
          <div className={styles.sessionTable}>
            {sessions.map((session) => (
              <div className={styles.sessionRow} key={`${session.time}-${session.name}`}>
                <strong>{session.time}</strong><div><b>{session.name}</b><small>{session.room}</small></div><span>{session.load}</span><em>{session.state}</em>
              </div>
            ))}
          </div>
        </article>
        <div className={styles.twoColumn}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}><div><span>Acquisition</span><h2>Open Studio funnel</h2></div><button type="button" onClick={() => choose("open-studio")}>Chi tiết →</button></div>
            <div className={styles.funnel}>
              <FunnelStep value="18" label="Đăng ký" width="100%" /><FunnelStep value="12" label="Đến trải nghiệm" width="74%" /><FunnelStep value="5" label="Qualified" width="46%" /><FunnelStep value="2" label="Converted" width="28%" />
            </div>
          </article>
          <article className={styles.panel}>
            <div className={styles.panelHeader}><div><span>Learning</span><h2>Program pulse</h2></div><button type="button" onClick={() => choose("programs")}>Programs →</button></div>
            <div className={styles.programList}>
              <Program name="PianoHouse" value="11" note="2 learner gần milestone" /><Program name="ArtChitect" value="10" note="1 syllabus draft" /><Program name="Little Piner" value="12" note="A+B / B+C shared" /><Program name="Toppi" value="6" note="Pilot cohort" />
            </div>
          </article>
        </div>
      </section>

      <aside className={styles.attentionRail}>
        <article className={`${styles.panel} ${styles.attentionPanel}`}>
          <div className={styles.panelHeader}><div><span>Attention</span><h2>Cần xử lý</h2></div><b className={styles.countBadge}>4</b></div>
          <div className={styles.attentionList}>
            {attention.map((item) => (
              <button key={item.label} type="button" onClick={() => choose(item.section)}><Dot tone={item.tone as "high" | "medium" | "low"} /><div><b>{item.label}</b><small>{item.meta}</small></div><span>→</span></button>
            ))}
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHeader}><div><span>Staffing</span><h2>Tối nay</h2></div></div>
          <div className={styles.staffing}><div><span>Mentor</span><b>4 / 4</b></div><div><span>TA</span><b className={styles.warnText}>3 / 4</b></div><div><span>Front desk</span><b>1 / 1</b></div></div>
          <button className={styles.fullButton} type="button" onClick={() => choose("schedule")}>Mở lịch ca</button>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHeader}><div><span>Pinoria</span><h2>Economy pulse</h2></div></div>
          <div className={styles.pinoriaStats}><div><strong>1,280</strong><small>PLS issued / 7d</small></div><div><strong>42</strong><small>Seed available</small></div><div><strong>7</strong><small>Wish draws / 7d</small></div></div>
          <button className={styles.fullButton} type="button" onClick={() => choose("economy")}>Mở Pinoria</button>
        </article>
      </aside>
    </div>
  );
}

function Metric({ label, value, meta, warn = false }: { label: string; value: string; meta: string; warn?: boolean }) {
  return <article className={styles.metric}><span>{label}</span><strong>{value}</strong><small className={warn ? styles.warnText : ""}>{meta}</small></article>;
}

function FunnelStep({ value, label, width }: { value: string; label: string; width: string }) {
  return <div className={styles.funnelStep}><div style={{ width }}><strong>{value}</strong><span>{label}</span></div></div>;
}

function Program({ name, value, note }: { name: string; value: string; note: string }) {
  return <div className={styles.programRow}><span className={styles.programMark}>{name.slice(0, 1)}</span><div><b>{name}</b><small>{note}</small></div><strong>{value}</strong></div>;
}

function SectionPreview({ active, tab }: { active: SectionId; tab: string }) {
  const meta = sectionMeta[active];
  return (
    <div className={styles.sectionGrid}>
      <section className={styles.panel}>
        <div className={styles.contextToolbar}><div className={styles.fakeSearch}>⌕ <span>Tìm trong {meta.title.toLowerCase()}…</span></div><button type="button">Bộ lọc</button><button type="button" className={styles.primaryButton}>Primary action</button></div>
        <div className={styles.previewCanvas}><span>Context preview</span><h2>{meta.title} · {tab}</h2><p>Frame này dùng để review hierarchy, density, global navigation và contextual tabs trước khi nối vào canonical data/actions của feature owner.</p><div className={styles.skeletonTable}>{[1,2,3,4,5].map((row) => <i key={row} />)}</div></div>
      </section>
      <aside className={styles.panel}>
        <div className={styles.panelHeader}><div><span>Context</span><h2>Quick facts</h2></div></div>
        <div className={styles.quickFacts}><div><span>Owner</span><b>Feature slice</b></div><div><span>Shell</span><b>PLT-BO</b></div><div><span>Authority</span><b>Core / PLT-ACCESS</b></div><div><span>Layout</span><b>Dense desktop</b></div></div>
      </aside>
    </div>
  );
}
