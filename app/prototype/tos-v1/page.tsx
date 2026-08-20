"use client";

import { useState, type ReactNode } from "react";
import styles from "./tos-v1.module.css";

type Workspace = "ops" | "bo";
type AppRoot = "home" | "shift" | "classroom" | "tasks" | "pinoria";
type ShiftTab = "today" | "schedule" | "register" | "check" | "history";
type ClassTab = "today" | "students" | "lesson" | "journal" | "achievement";
type TaskTab = "all" | "shift" | "learning" | "pinoria" | "requests";
type PinoriaTab = "live" | "attention" | "learners" | "fulfillment" | "tv";

type Student = {
  id: string;
  name: string;
  initial: string;
  journey: string;
  checkIn?: string;
  checkOut?: string;
  attendance: "present" | "absent" | "left";
  note?: string;
};

type ClassItem = {
  id: string;
  title: string;
  path: string;
  room: string;
  start: string;
  end: string;
  mentor: string;
  pa: string;
  syllabus: string;
  students: Student[];
};

const classes: ClassItem[] = [
  {
    id: "art-1800",
    title: "ArtChitect",
    path: "Màu nước II",
    room: "Phòng Họa",
    start: "18:00",
    end: "19:30",
    mentor: "Vy",
    pa: "Trang",
    syllabus: "Màu nước · Layering",
    students: [
      { id: "bo", name: "Bơ", initial: "B", journey: "Màu nước II", checkIn: "17:55", attendance: "present", note: "Quan sát kiểm soát lượng nước." },
      { id: "an", name: "An", initial: "A", journey: "Màu nước I", checkIn: "18:02", attendance: "present" },
      { id: "minh", name: "Minh", initial: "M", journey: "Màu nước II", checkIn: "18:01", attendance: "present" },
      { id: "chi", name: "Chi", initial: "C", journey: "Màu nước II", checkIn: "17:58", attendance: "present" },
      { id: "duy", name: "Duy", initial: "D", journey: "Màu nước I", checkIn: "17:50", attendance: "present" },
      { id: "lan", name: "Lan", initial: "L", journey: "Màu nước I", attendance: "absent" },
      { id: "khoa", name: "Khoa", initial: "K", journey: "Màu nước II", attendance: "absent" },
      { id: "hai", name: "Hải", initial: "H", journey: "Màu nước I", attendance: "absent" },
    ],
  },
  {
    id: "piano-1930",
    title: "PianoHouse",
    path: "Foundation I",
    room: "Phòng Piano 2",
    start: "19:30",
    end: "20:30",
    mentor: "Hằng",
    pa: "Linh",
    syllabus: "Always With Me · Phrase 3–4",
    students: [
      { id: "mai", name: "Mai", initial: "M", journey: "Foundation I", checkIn: "19:21", attendance: "present" },
      { id: "thao", name: "Thảo", initial: "T", journey: "Foundation I", checkIn: "19:24", attendance: "present" },
      { id: "nam", name: "Nam", initial: "N", journey: "Foundation I", attendance: "absent" },
    ],
  },
];

const taskItems = [
  { id: "journal-an", type: "learning" as const, time: "19:30", title: "Journal chưa hoàn tất", meta: "ArtChitect · An", action: "Mở" },
  { id: "achievement-c", type: "learning" as const, time: "20:15", title: "Gam C · evidence ready", meta: "PianoHouse · Mai", action: "Review" },
  { id: "pinoria-choice", type: "pinoria" as const, time: "18:45", title: "Arrival choice đang chờ", meta: "Reception · Bơ", action: "Mở" },
  { id: "shift-fix", type: "requests" as const, time: "Hôm qua", title: "Yêu cầu chỉnh chấm công", meta: "20/08 · thiếu check-out", action: "Xem" },
  { id: "shift-next", type: "shift" as const, time: "CN", title: "Đăng ký ca tuần sau", meta: "Còn 2 ngày", action: "Đăng ký" },
];

const appLauncher: { id: Exclude<AppRoot, "home">; title: string; copy: string; icon: string; meta: string; tone: string }[] = [
  { id: "shift", title: "Ca làm", copy: "Check-in/out, lịch, đăng ký và chấm công", icon: "◷", meta: "Đang trong ca", tone: "shift" },
  { id: "classroom", title: "Lớp học", copy: "Lớp hôm nay, học viên, journal và thành tựu", icon: "▤", meta: "2 lớp hôm nay", tone: "classroom" },
  { id: "tasks", title: "Việc", copy: "Những việc cần xử lý theo đúng context", icon: "◌", meta: "3 việc đang chờ", tone: "tasks" },
  { id: "pinoria", title: "Pinoria", copy: "Ops riêng cho Reception và center-wide staff", icon: "◈", meta: "Reception scope", tone: "pinoria" },
];

const lessonBlocks = [
  ["1", "Giới thiệu & demo", "done"],
  ["2", "Thực hành lớp", "done"],
  ["3", "Hoàn thiện bài", "now"],
  ["4", "Nhận xét & dặn dò", "todo"],
];

export default function TosAdaptiveWorkspacePrototype() {
  const [workspace, setWorkspace] = useState<Workspace>("ops");
  const [appRoot, setAppRoot] = useState<AppRoot>("home");
  const [shiftTab, setShiftTab] = useState<ShiftTab>("today");
  const [classTab, setClassTab] = useState<ClassTab>("today");
  const [taskTab, setTaskTab] = useState<TaskTab>("all");
  const [pinoriaTab, setPinoriaTab] = useState<PinoriaTab>("live");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [journalDone, setJournalDone] = useState(false);
  const [achievementType, setAchievementType] = useState<"piano" | "art">("art");

  const selectedClass = classes.find((item) => item.id === selectedClassId) ?? null;
  const selectedStudent = selectedClass?.students.find((student) => student.id === selectedStudentId) ?? null;

  function goHome() {
    setAppRoot("home");
    setSelectedClassId(null);
    setSelectedStudentId(null);
  }

  function openApp(root: Exclude<AppRoot, "home">) {
    setAppRoot(root);
    setSelectedStudentId(null);
    if (root === "classroom") {
      setClassTab("today");
      setSelectedClassId(null);
    }
  }

  function openClass(id: string, tab: ClassTab = "today") {
    setAppRoot("classroom");
    setSelectedClassId(id);
    setSelectedStudentId(null);
    setClassTab(tab);
  }

  function chooseClassTab(tab: ClassTab) {
    setClassTab(tab);
    setSelectedStudentId(null);
    if ((tab === "lesson" || tab === "journal" || tab === "achievement") && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }

  if (workspace === "bo") return <BOWorkspace onSwitch={() => setWorkspace("ops")} />;

  const themeClass = appRoot === "shift" ? styles.themeShift : appRoot === "classroom" ? styles.themeClassroom : appRoot === "tasks" ? styles.themeTasks : appRoot === "pinoria" ? styles.themePinoria : styles.themeHome;

  return (
    <div className={styles.prototypePage}>
      <div className={styles.prototypeBanner}>
        <span>PROTOTYPE · UI EVIDENCE ONLY</span>
        <strong>TOS Adaptive Workspace v1</strong>
        <button onClick={() => setWorkspace("bo")}>Xem BO desktop ↗</button>
      </div>

      <div className={styles.phoneStage}>
        <div className={`${styles.phoneShell} ${themeClass}`}>
          <MobileHeader appRoot={appRoot} selectedClass={selectedClass} selectedStudent={selectedStudent} onHome={goHome} />

          <main className={styles.mobileContent}>
            {appRoot === "home" ? <HomeScreen onOpenApp={openApp} onClass={openClass} /> : null}
            {appRoot === "shift" ? <ShiftFeature tab={shiftTab} onTab={setShiftTab} correctionOpen={correctionOpen} setCorrectionOpen={setCorrectionOpen} /> : null}
            {appRoot === "classroom" ? <ClassroomApp tab={classTab} klass={selectedClass} student={selectedStudent} onClass={openClass} onStudent={setSelectedStudentId} onBackClass={() => { setSelectedClassId(null); setSelectedStudentId(null); setClassTab("today"); }} journalDone={journalDone} setJournalDone={setJournalDone} achievementType={achievementType} setAchievementType={setAchievementType} /> : null}
            {appRoot === "tasks" ? <TasksFeature tab={taskTab} onApp={openApp} onClass={openClass} /> : null}
            {appRoot === "pinoria" ? <PinoriaFeature tab={pinoriaTab} /> : null}
          </main>

          {appRoot === "home" ? <GlobalFooter onOpenApp={openApp} /> : null}
          {appRoot === "shift" ? <FeatureFooter items={[["today", "Hôm nay", "◉"], ["schedule", "Lịch", "▦"], ["register", "Đăng ký", "+"], ["check", "Check", "✓"], ["history", "Chấm công", "◷"]]} active={shiftTab} onSelect={(id) => setShiftTab(id as ShiftTab)} /> : null}
          {appRoot === "classroom" ? <FeatureFooter items={[["today", "Lớp hôm nay", "▤"], ["students", "Học viên", "◎"], ["lesson", "Giáo án", "▥"], ["journal", "Journal", "✎"], ["achievement", "Thành tựu", "✦"]]} active={classTab} onSelect={(id) => chooseClassTab(id as ClassTab)} /> : null}
          {appRoot === "tasks" ? <FeatureFooter items={[["all", "Tất cả", "◌"], ["shift", "Ca", "◷"], ["learning", "Học vụ", "✦"], ["pinoria", "Pinoria", "◈"], ["requests", "Yêu cầu", "↺"]]} active={taskTab} onSelect={(id) => setTaskTab(id as TaskTab)} /> : null}
          {appRoot === "pinoria" ? <FeatureFooter items={[["live", "Live", "◉"], ["attention", "Cần xử lý", "!"], ["learners", "Học viên", "◎"], ["fulfillment", "Fulfillment", "◇"], ["tv", "TV", "▣"]]} active={pinoriaTab} onSelect={(id) => setPinoriaTab(id as PinoriaTab)} /> : null}
        </div>
      </div>
    </div>
  );
}

function MobileHeader({ appRoot, selectedClass, selectedStudent, onHome }: { appRoot: AppRoot; selectedClass: ClassItem | null; selectedStudent: Student | null; onHome: () => void }) {
  if (appRoot === "home") {
    return <header className={styles.mobileHeader}><div><span className={styles.kicker}>PINO TEAM OS · OPS</span><h1>Chào Vy <span>👋</span></h1><p>Thứ 5, 20/08</p></div><button className={styles.profileButton}>V</button></header>;
  }
  const title = appRoot === "shift" ? "Ca làm" : appRoot === "classroom" ? "Lớp học" : appRoot === "tasks" ? "Việc" : "Pinoria";
  const subtitle = selectedStudent && selectedClass ? `${selectedStudent.name} · ${selectedClass.title}` : selectedClass ? `${selectedClass.title} · ${selectedClass.start}` : appRoot === "shift" ? "Công việc và thời gian của bạn" : appRoot === "classroom" ? "Pedagogy workspace" : appRoot === "tasks" ? "Attention inbox" : "Reception / center-wide Ops";
  return <header className={styles.mobileHeader}><div><span className={styles.kicker}>OPS APP</span><h1>{title}</h1><p>{subtitle}</p></div><button className={styles.homeButton} onClick={onHome} aria-label="Về Home">⌂</button></header>;
}

function HomeScreen({ onOpenApp, onClass }: { onOpenApp: (root: Exclude<AppRoot, "home">) => void; onClass: (id: string, tab?: ClassTab) => void }) {
  return <div className={styles.stack}>
    <section className={`${styles.card} ${styles.shiftHero}`}>
      <div><span className={styles.label}>CA HIỆN TẠI</span><strong>17:30 – 21:00</strong><small><i className={styles.greenDot} /> Đang làm việc · Check-in 17:27</small></div>
      <button onClick={() => onOpenApp("shift")}>›</button>
    </section>
    <section className={styles.card}>
      <div className={styles.cardHead}><div><span className={styles.label}>LỚP TIẾP THEO</span><strong>18:00 · ArtChitect</strong><small>Phòng Họa · bắt đầu sau 35 phút</small></div><button onClick={() => onClass("art-1800")}>›</button></div>
    </section>
    <section className={styles.card}>
      <div className={styles.cardHead}><div><span className={styles.label}>VIỆC CẦN XỬ LÝ</span><strong>3 việc hôm nay</strong></div><button onClick={() => onOpenApp("tasks")}>›</button></div>
      <div className={styles.compactList}>
        <span><b>Journal</b><em>ArtChitect · An</em><time>19:30</time></span>
        <span><b>Achievement</b><em>Gam C · evidence ready</em><time>20:15</time></span>
        <span><b>Pinoria</b><em>Reception · choice đang chờ</em><time>18:45</time></span>
      </div>
    </section>

    <section className={styles.appsSection}>
      <div className={styles.sectionTitle}><div><span className={styles.label}>ỨNG DỤNG</span><h2>Bạn muốn làm gì?</h2></div></div>
      <div className={styles.appGrid}>
        {appLauncher.map((app) => <AppTile key={app.id} {...app} onClick={() => onOpenApp(app.id)} />)}
      </div>
    </section>
  </div>;
}

function AppTile({ title, copy, icon, meta, tone, onClick }: { title: string; copy: string; icon: string; meta: string; tone: string; onClick: () => void }) {
  return <button className={`${styles.appTile} ${styles[`appTile_${tone}`]}`} onClick={onClick}><span className={styles.appIcon}>{icon}</span><strong>{title}</strong><p>{copy}</p><small>{meta}</small></button>;
}

function GlobalFooter({ onOpenApp }: { onOpenApp: (root: Exclude<AppRoot, "home">) => void }) {
  return <nav className={styles.mobileFooter} aria-label="OPS apps"><button className={styles.footerActive}><span>⌂</span><small>Home</small></button><button onClick={() => onOpenApp("shift")}><span>◷</span><small>Ca làm</small></button><button onClick={() => onOpenApp("classroom")}><span>▤</span><small>Lớp học</small></button><button onClick={() => onOpenApp("tasks")}><span>◌</span><small>Việc</small></button><button onClick={() => onOpenApp("pinoria")}><span>◈</span><small>Pinoria</small></button></nav>;
}

function FeatureFooter({ items, active, onSelect }: { items: string[][]; active: string; onSelect: (id: string) => void }) {
  return <nav className={`${styles.mobileFooter} ${styles.featureFooter}`}>{items.map(([id, label, icon]) => <button key={id} className={active === id ? styles.footerActive : ""} onClick={() => onSelect(id)}><span>{icon}</span><small>{label}</small></button>)}</nav>;
}

function ShiftFeature({ tab, onTab, correctionOpen, setCorrectionOpen }: { tab: ShiftTab; onTab: (tab: ShiftTab) => void; correctionOpen: boolean; setCorrectionOpen: (open: boolean) => void }) {
  if (tab === "today") return <div className={styles.stack}><AppIntro eyebrow="CA LÀM" title="Hôm nay" copy="Những gì liên quan trực tiếp tới ca làm của bạn." /><section className={`${styles.card} ${styles.appHero}`}><span className={styles.label}>17:30 – 21:00</span><h2>Đang trong ca</h2><p><i className={styles.greenDot} /> Check-in lúc 17:27</p><button className={styles.primaryButton} onClick={() => onTab("check")}>Mở Check-in/out</button></section><section className={styles.card}><span className={styles.label}>ĐƯỢC PHÂN CÔNG</span><ShiftRow time="18:00–19:30" title="ArtChitect" meta="Phòng Họa" /><ShiftRow time="19:30–20:30" title="PianoHouse" meta="Phòng Piano 2" /></section></div>;
  if (tab === "schedule") return <div className={styles.stack}><AppIntro eyebrow="CA LÀM" title="Lịch của tôi" copy="Xem lịch theo tuần, ưu tiên dạng đọc nhanh trên mobile." /><WeekStrip /><section className={styles.card}><ShiftRow time="17:30–21:00" title="PA · Full evening" meta="ArtChitect + PianoHouse" /><ShiftRow time="18:00–19:30" title="ArtChitect" meta="Phòng Họa" /><ShiftRow time="19:30–20:30" title="PianoHouse" meta="Phòng Piano 2" /></section></div>;
  if (tab === "register") return <ShiftRegistrationPrototype />;
  if (tab === "check") return <div className={styles.stack}><AppIntro eyebrow="CA LÀM" title="Check-in/out" copy="Chỉ thao tác cho ca làm của chính bạn." /><section className={`${styles.card} ${styles.checkCard}`}><div className={styles.checkStatus}><i className={styles.greenDot} /><strong>Đang làm việc</strong></div><p>Check-in · 17:27</p><textarea placeholder="Ghi chú nếu cần…" /><button className={styles.dangerButton}>CHECK OUT</button><small className={styles.helper}>Prototype UI only · không ghi dữ liệu.</small></section></div>;
  return <div className={styles.stack}><AppIntro eyebrow="CA LÀM" title="Chấm công" copy="Lịch sử và correction request của riêng bạn." /><section className={styles.filterPills}><button className={styles.activePill}>Tháng 8</button><button>Tất cả</button></section><TimesheetCard date="20/08" inTime="17:27" outTime="21:03" rounded="17:30 → 21:00" status="Bình thường" onCorrect={() => setCorrectionOpen(true)} /><TimesheetCard date="18/08" inTime="17:34" outTime="—" rounded="17:30 → —" status="Thiếu Check-out" onCorrect={() => setCorrectionOpen(true)} warn />{correctionOpen ? <CorrectionSheet onClose={() => setCorrectionOpen(false)} /> : null}</div>;
}

function ClassroomApp({ tab, klass, student, onClass, onStudent, onBackClass, journalDone, setJournalDone, achievementType, setAchievementType }: { tab: ClassTab; klass: ClassItem | null; student: Student | null; onClass: (id: string, tab?: ClassTab) => void; onStudent: (id: string | null) => void; onBackClass: () => void; journalDone: boolean; setJournalDone: (done: boolean) => void; achievementType: "piano" | "art"; setAchievementType: (type: "piano" | "art") => void }) {
  if (tab === "today") {
    if (!klass) return <ClassesToday onClass={onClass} />;
    return <ClassOverview klass={klass} onBack={onBackClass} onStudent={(id) => { onStudent(id); }} />;
  }
  if (tab === "students") return student && klass ? <StudentDetail student={student} klass={klass} onBack={() => onStudent(null)} /> : <GlobalStudents klass={klass} onClass={onClass} onStudent={onStudent} />;
  const activeClass = klass ?? classes[0];
  if (tab === "lesson") return <LessonView klass={activeClass} />;
  if (tab === "journal") return <JournalView klass={activeClass} done={journalDone} setDone={setJournalDone} />;
  return <AchievementView type={achievementType} setType={setAchievementType} studentName={activeClass.students[0]?.name ?? "Học viên"} />;
}

function ClassesToday({ onClass }: { onClass: (id: string, tab?: ClassTab) => void }) {
  return <div className={styles.stack}><AppIntro eyebrow="LỚP HỌC" title="Lớp hôm nay" copy="Mentor workspace thuần pedagogy. Hiện diện chỉ là fact từ Reception." />{classes.map((item) => { const present = item.students.filter((s) => s.attendance === "present").length; return <button className={`${styles.card} ${styles.classCard}`} key={item.id} onClick={() => onClass(item.id)}><time>{item.start}</time><div><strong>{item.title}</strong><small>{item.room} · {item.end}</small><div className={styles.tagRow}><span>Mentor {item.mentor}</span><span>PA {item.pa}</span></div><p>{present}/{item.students.length} học viên đã đến</p></div><b>›</b></button>; })}<p className={styles.boundaryNote}>Không có Check-in/out learner · không có Pinoria trong app Lớp học.</p></div>;
}

function ClassOverview({ klass, onBack, onStudent }: { klass: ClassItem; onBack: () => void; onStudent: (id: string) => void }) {
  const present = klass.students.filter((s) => s.attendance === "present").length;
  return <div className={styles.stack}><button className={styles.backLink} onClick={onBack}>← Lớp hôm nay</button><section className={styles.card}><span className={styles.label}>THÔNG TIN LỚP</span><InfoRow label="Mentor" value={klass.mentor} /><InfoRow label="PA" value={klass.pa} /><InfoRow label="Sĩ số" value={`${present}/${klass.students.length}`} /><InfoRow label="Syllabus" value={klass.syllabus} /></section><section className={styles.card}><span className={styles.label}>HIỆN DIỆN · READ ONLY</span><div className={styles.attendanceMeter}><div style={{ width: `${(present / klass.students.length) * 100}%` }} /></div><InfoRow label="Đã đến" value={String(present)} /><InfoRow label="Chưa đến" value={String(klass.students.length - present)} warn /><small className={styles.helper}>Nguồn: Reception. Mentor chỉ xem fact, không thao tác.</small></section><section className={styles.card}><span className={styles.label}>PEDAGOGY ATTENTION</span><TaskLine title="Journal lớp chưa hoàn tất" meta="Hoàn thành trước khi kết thúc ca" /><TaskLine title="1 Achievement cần review" meta="Evidence đã sẵn sàng" /></section><section className={styles.card}><span className={styles.label}>HỌC VIÊN</span>{klass.students.slice(0, 4).map((s) => <button className={styles.studentMini} key={s.id} onClick={() => onStudent(s.id)}><span className={styles.avatar}>{s.initial}</span><span><strong>{s.name}</strong><small>{s.attendance === "present" ? `Đã đến ${s.checkIn}` : "Chưa đến"}</small></span><b>›</b></button>)}</section></div>;
}

function GlobalStudents({ klass, onClass, onStudent }: { klass: ClassItem | null; onClass: (id: string, tab?: ClassTab) => void; onStudent: (id: string | null) => void }) {
  const source = klass ? [klass] : classes;
  return <div className={styles.stack}><AppIntro eyebrow="LỚP HỌC" title={klass ? `Học viên · ${klass.title}` : "Học viên"} copy="Tìm và mở learner trong context học vụ, không biến thành CRM." /><div className={styles.searchBox}><span>⌕</span><input placeholder="Tìm học viên…" /></div>{source.map((item) => <section className={styles.cardList} key={item.id}>{!klass ? <button className={styles.classStrip} onClick={() => onClass(item.id, "students")}><strong>{item.title}</strong><span>{item.start}</span></button> : null}{item.students.map((student) => <button key={student.id} className={styles.studentRow} onClick={() => { if (!klass) onClass(item.id, "students"); onStudent(student.id); }}><span className={styles.avatar}>{student.initial}</span><span><strong>{student.name}</strong><small className={student.attendance === "present" ? styles.presentText : styles.absentText}>{student.attendance === "present" ? `● Đã đến ${student.checkIn}` : "○ Chưa đến"}</small></span><b>›</b></button>)}</section>)}<p className={styles.boundaryNote}>Pedagogy view · attendance read-only · Pinoria-free.</p></div>;
}

function StudentDetail({ student, klass, onBack }: { student: Student; klass: ClassItem; onBack: () => void }) {
  return <div className={styles.stack}><button className={styles.backLink} onClick={onBack}>← Học viên</button><AppIntro eyebrow="HỌC VIÊN" title={student.name} copy={`${klass.title} · ${klass.start}`} /><section className={styles.card}><span className={styles.label}>HIỆN DIỆN · FACT</span><InfoRow label="Check-in" value={student.checkIn ?? "—"} good={!!student.checkIn} /><InfoRow label="Check-out" value={student.checkOut ?? "—"} /><small className={styles.helper}>Nguồn: Reception · không có action Check-in/out.</small></section><section className={styles.card}><span className={styles.label}>HỌC TẬP</span><InfoRow label="Journey hiện tại" value={student.journey} /><InfoRow label="Bài hôm nay" value={klass.syllabus} /><div className={styles.objectiveBox}><strong>Mục tiêu buổi học</strong><ul><li>Kỹ thuật layering</li><li>Kiểm soát lượng nước</li><li>Phối màu hài hòa</li></ul></div></section><section className={styles.card}><span className={styles.label}>GHI CHÚ SƯ PHẠM</span><textarea placeholder={`Nhập ghi chú về ${student.name}…`} defaultValue={student.note ?? ""} /></section></div>;
}

function LessonView({ klass }: { klass: ClassItem }) {
  return <div className={styles.stack}><AppIntro eyebrow="LỚP HỌC · GIÁO ÁN" title={klass.syllabus} copy={`${klass.title} · ${klass.start} · execution view, không phải CMS`} /><section className={styles.card}><span className={styles.label}>MỤC TIÊU</span><ul className={styles.goalList}><li>Kỹ thuật layer trên ướt</li><li>Kiểm soát lượng nước</li><li>Tạo độ sâu bằng 2 lớp màu</li></ul></section><div className={styles.mediaPlaceholder}><span>▶</span><strong>Demo / reference</strong><small>Prototype media placeholder</small></div><section className={styles.card}><span className={styles.label}>TIẾN TRÌNH BUỔI HỌC</span>{lessonBlocks.map(([n, title, state]) => <div className={styles.lessonStep} key={n}><span>{n}</span><strong>{title}</strong><em>{state === "done" ? "✓" : state === "now" ? "Đang làm" : "○"}</em></div>)}</section></div>;
}

function JournalView({ klass, done, setDone }: { klass: ClassItem; done: boolean; setDone: (done: boolean) => void }) {
  return <div className={styles.stack}><AppIntro eyebrow="LỚP HỌC · JOURNAL" title="Classroom Journal" copy={`${klass.title} · ${klass.start} · capture-first`} /><section className={styles.card}><span className={styles.label}>CAPTURE</span><div className={styles.captureGrid}><button><span>▧</span><strong>Chụp ảnh</strong></button><button><span>◉</span><strong>Ghi âm</strong></button><button><span>▶</span><strong>Video</strong></button></div><label className={styles.field}>Quan sát chung<textarea placeholder="Ghi nhanh điều đáng chú ý trong lớp…" /></label><div className={styles.studentNotes}><button>+ Bơ</button><button>+ An</button><button>+ Minh</button></div><div className={styles.stickyActions}><button>Lưu nháp</button><button className={styles.primaryButton} onClick={() => setDone(!done)}>{done ? "✓ Đã hoàn tất" : "Hoàn tất Journal"}</button></div><small className={styles.helper}>Media là Evidence candidate; Journal không tự award Achievement.</small></section></div>;
}

function AchievementView({ type, setType, studentName }: { type: "piano" | "art"; setType: (type: "piano" | "art") => void; studentName: string }) {
  const piano = type === "piano";
  return <div className={styles.stack}><AppIntro eyebrow="LỚP HỌC · THÀNH TỰU" title="Universal Achievement shell" copy="Một interaction grammar dùng cho nhiều loại achievement." /><section className={styles.segmented}><button className={!piano ? styles.segmentActive : ""} onClick={() => setType("art")}>Art</button><button className={piano ? styles.segmentActive : ""} onClick={() => setType("piano")}>Piano</button></section><section className={styles.card}><span className={styles.label}>{piano ? "PIANOHOUSE" : "ARTCHITECT"}</span><h2>{piano ? "Gam C trưởng" : "Đồ án Màu nước II"}</h2><p className={styles.muted}>{studentName} · {piano ? "2 tay · 1 octave" : "Layering + color control"}</p><div className={styles.evidenceCard}><span>{piano ? "◉" : "▧"}</span><div><strong>{piano ? "recording-gam-c.m4a" : "final-watercolor.jpg"}</strong><small>Evidence attached</small></div></div><div className={styles.criteria}>{(piano ? ["Đúng nốt", "Nhịp ổn định", "Hai tay phối hợp"] : ["Layering", "Kiểm soát nước", "Bố cục"]).map((criterion, i) => <label key={criterion}><input type="checkbox" defaultChecked={i < 2} /> {criterion}</label>)}</div><button className={styles.primaryButton}>Xác nhận Achievement</button><small className={styles.helper}>Prototype local state only · frontend không sở hữu criteria/domain truth.</small></section></div>;
}

function TasksFeature({ tab, onApp, onClass }: { tab: TaskTab; onApp: (root: Exclude<AppRoot, "home">) => void; onClass: (id: string, tab?: ClassTab) => void }) {
  const visible = taskItems.filter((item) => tab === "all" || item.type === tab);
  return <div className={styles.stack}><AppIntro eyebrow="VIỆC" title="Cần xử lý" copy="Attention inbox chỉ aggregate và deep-link; không sở hữu business state." />{visible.map((item) => <section className={`${styles.card} ${styles.taskItem}`} key={item.id}><time>{item.time}</time><div><strong>{item.title}</strong><small>{item.meta}</small></div><button onClick={() => item.type === "shift" || item.type === "requests" ? onApp("shift") : item.type === "pinoria" ? onApp("pinoria") : onClass(item.id === "achievement-c" ? "piano-1930" : "art-1800", item.id === "achievement-c" ? "achievement" : "journal")}>{item.action}</button></section>)}</div>;
}

function PinoriaFeature({ tab }: { tab: PinoriaTab }) {
  const content: Record<PinoriaTab, { title: string; copy: string; rows: [string, string][] }> = {
    live: { title: "Live House", copy: "Center-wide operational context, tách khỏi pedagogy.", rows: [["Hiện diện", "8 learner tại House"], ["TV", "Online · Ambient"], ["Cần chú ý", "2 choices · 1 ritual"]] },
    attention: { title: "Cần xử lý", copy: "Những Pinoria actions phải hoàn tất trước checkout.", rows: [["Bơ", "Moss Satchel choice"], ["An", "Leaf Cap choice"], ["Bơ", "Companion ritual ready"]] },
    learners: { title: "Học viên", copy: "Pinoria operational learner view, không phải pedagogy profile.", rows: [["Bơ", "Bùm · Lv2"], ["An", "Mây · Lv1"], ["Mai", "Kiri · Lv1"]] },
    fulfillment: { title: "Fulfillment", copy: "Physical fulfillment queue cho Ops có quyền.", rows: [["Chest #42", "3 items pending"], ["PINA Bow", "2 ready"], ["Journey Relic", "1 ready"]] },
    tv: { title: "TV", copy: "Presentation surface status. TV không quyết định attendance.", rows: [["Reception TV", "Online"], ["Mode", "Ambient House"], ["Queue", "0 events"]] },
  };
  const current = content[tab];
  return <div className={styles.stack}><AppIntro eyebrow="PINORIA OPS" title={current.title} copy={current.copy} /><section className={styles.card}>{current.rows.map(([label, value]) => <InfoRow key={label} label={label} value={value} />)}</section><p className={styles.boundaryNote}>Pinoria là app operational riêng. Không xuất hiện trong Mentor Class/Learner pedagogy view.</p></div>;
}

function AppIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div className={styles.appIntro}><span className={styles.label}>{eyebrow}</span><h2>{title}</h2><p>{copy}</p></div>;
}

function WeekStrip() { return <div className={styles.weekStrip}>{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day, i) => <button key={day} className={i === 3 ? styles.dayActive : ""}><span>{day}</span><strong>{17 + i}</strong></button>)}</div>; }
function ShiftRow({ time, title, meta }: { time: string; title: string; meta: string }) { return <div className={styles.shiftRow}><time>{time}</time><div><strong>{title}</strong><small>{meta}</small></div></div>; }

function ShiftRegistrationPrototype() {
  const [selected, setSelected] = useState<Record<string, boolean>>({ "T2": true, "T4": true, "T6": true });
  return <div className={styles.stack}><AppIntro eyebrow="CA LÀM" title="Đăng ký ca" copy="Request availability; Manager là người chốt final assignment." /><section className={styles.card}>{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <div className={styles.registrationDay} key={day}><strong>{day}</strong><button className={selected[day] ? styles.selectedShift : ""} onClick={() => setSelected((current) => ({ ...current, [day]: !current[day] }))}>17:30–21:00</button></div>)}<div className={styles.stickyActions}><button>Lưu nháp</button><button className={styles.primaryButton}>Gửi đăng ký</button></div></section></div>;
}

function TimesheetCard({ date, inTime, outTime, rounded, status, warn, onCorrect }: { date: string; inTime: string; outTime: string; rounded: string; status: string; warn?: boolean; onCorrect: () => void }) {
  return <section className={styles.card}><div className={styles.cardHead}><div><span className={styles.label}>{date}</span><strong>{inTime} → {outTime}</strong><small>Rounded · {rounded}</small></div><span className={warn ? styles.warnBadge : styles.goodBadge}>{status}</span></div><button className={styles.textAction} onClick={onCorrect}>Yêu cầu chỉnh sửa →</button></section>;
}

function CorrectionSheet({ onClose }: { onClose: () => void }) {
  return <div className={styles.sheetBackdrop}><div className={styles.bottomSheet}><div className={styles.sheetHandle} /><span className={styles.label}>UI EVIDENCE ONLY</span><h2>Yêu cầu chỉnh chấm công</h2><label>Giá trị đề nghị<input type="time" defaultValue="21:00" /></label><label>Lý do<textarea defaultValue="Quên check-out sau khi hỗ trợ phụ huynh cuối ca." /></label><button className={styles.primaryButton} onClick={onClose}>Gửi yêu cầu</button><button className={styles.ghostButton} onClick={onClose}>Đóng</button></div></div>;
}

function InfoRow({ label, value, good, warn }: { label: string; value: string; good?: boolean; warn?: boolean }) { return <div className={styles.infoRow}><span>{label}</span><strong className={good ? styles.presentText : warn ? styles.absentText : ""}>{value}</strong></div>; }
function TaskLine({ title, meta }: { title: string; meta: string }) { return <div className={styles.taskLine}><i className={styles.taskDot} /><div><strong>{title}</strong><small>{meta}</small></div><b>›</b></div>; }

function BOWorkspace({ onSwitch }: { onSwitch: () => void }) {
  const groups = ["Overview", "Operations", "Learning", "People", "Workforce", "Pinoria", "Content", "System"];
  return <div className={styles.boPage}><aside className={styles.boSidebar}><div className={styles.boBrand}><span>P</span><div><strong>PINO TOS</strong><small>Back Office</small></div></div>{groups.map((group, i) => <button key={group} className={i === 0 ? styles.boNavActive : ""}>{group}<span>›</span></button>)}<div className={styles.boFoot}><span>PROTOTYPE · DESKTOP-FIRST</span><button onClick={onSwitch}>← Về OPS mobile</button></div></aside><main className={styles.boMain}><header className={styles.boHeader}><div><span className={styles.label}>BACK OFFICE</span><h1>Dashboard</h1><p>Control the House · desktop-first</p></div><div className={styles.boUser}>Vy · Founder</div></header><div className={styles.boMetrics}><Metric label="Lớp đang diễn ra" value="12" /><Metric label="Học viên có mặt" value="78%" /><Metric label="Việc cần xử lý" value="23" /><Metric label="Check-in hôm nay" value="36" /></div><div className={styles.boGrid}><section className={styles.boPanel}><span className={styles.label}>LỚP HÔM NAY</span><h2>Operational overview</h2>{classes.map((item) => <div className={styles.boRow} key={item.id}><strong>{item.start}</strong><span>{item.title}</span><em>{item.room}</em></div>)}</section><section className={styles.boPanel}><span className={styles.label}>ATTENTION</span><h2>Needs resolution</h2>{taskItems.slice(0, 4).map((item) => <div className={styles.boRow} key={item.id}><strong>•</strong><span>{item.title}</span><em>{item.time}</em></div>)}</section></div></main></div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <section><span>{label}</span><strong>{value}</strong></section>; }
