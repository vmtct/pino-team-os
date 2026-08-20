"use client";

import { useMemo, useState, type ReactNode } from "react";
import styles from "./tos-v1.module.css";

type Workspace = "ops" | "bo";
type OpsRoot = "home" | "shift" | "classes" | "students" | "tasks";
type ShiftTab = "today" | "schedule" | "register" | "check" | "history";
type ClassTab = "overview" | "students" | "lesson" | "journal" | "achievement";
type StudentTab = "overview" | "lesson" | "journal" | "achievement";
type TaskTab = "all" | "shift" | "learning" | "pinoria" | "requests";

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
  {
    id: "art-2045",
    title: "ArtChitect Advanced",
    path: "Composition",
    room: "Phòng Họa",
    start: "20:45",
    end: "22:15",
    mentor: "Vy",
    pa: "Trang",
    syllabus: "Composition · Focal point",
    students: [
      { id: "gia", name: "Gia", initial: "G", journey: "Composition", checkIn: "20:38", attendance: "present" },
      { id: "linh", name: "Linh", initial: "L", journey: "Composition", attendance: "absent" },
    ],
  },
];

const taskItems = [
  { id: "journal-an", type: "learning" as const, time: "19:30", title: "Journal chưa hoàn tất", meta: "ArtChitect · An", action: "Mở Journal" },
  { id: "achievement-c", type: "learning" as const, time: "20:15", title: "Gam C · evidence ready", meta: "PianoHouse · Mai", action: "Review" },
  { id: "pinoria-choice", type: "pinoria" as const, time: "18:45", title: "Arrival choice đang chờ", meta: "Reception · Bơ", action: "Mở Pinoria" },
  { id: "shift-fix", type: "requests" as const, time: "Hôm qua", title: "Yêu cầu chỉnh chấm công", meta: "20/08 · thiếu check-out", action: "Xem" },
  { id: "shift-next", type: "shift" as const, time: "CN", title: "Đăng ký ca tuần sau", meta: "Còn 2 ngày", action: "Đăng ký" },
];

const lessonBlocks = [
  ["1", "Giới thiệu & demo", "done"],
  ["2", "Thực hành lớp", "done"],
  ["3", "Hoàn thiện bài", "now"],
  ["4", "Nhận xét & dặn dò", "todo"],
];

const opsGlobalNav: { id: OpsRoot; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "shift", label: "Ca", icon: "▣" },
  { id: "classes", label: "Lớp", icon: "▤" },
  { id: "students", label: "Học viên", icon: "◎" },
  { id: "tasks", label: "Việc", icon: "◌" },
];

export default function TosAdaptiveWorkspacePrototype() {
  const [workspace, setWorkspace] = useState<Workspace>("ops");
  const [opsRoot, setOpsRoot] = useState<OpsRoot>("home");
  const [shiftTab, setShiftTab] = useState<ShiftTab>("today");
  const [classTab, setClassTab] = useState<ClassTab>("overview");
  const [taskTab, setTaskTab] = useState<TaskTab>("all");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentTab, setStudentTab] = useState<StudentTab>("overview");
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [journalDone, setJournalDone] = useState(false);
  const [achievementType, setAchievementType] = useState<"piano" | "art">("art");

  const selectedClass = classes.find((item) => item.id === selectedClassId) ?? null;
  const selectedStudent = selectedClass?.students.find((student) => student.id === selectedStudentId) ?? null;

  function goHome() {
    setOpsRoot("home");
    setSelectedClassId(null);
    setSelectedStudentId(null);
  }

  function openClass(id: string) {
    setOpsRoot("classes");
    setSelectedClassId(id);
    setSelectedStudentId(null);
    setClassTab("overview");
  }

  function openStudent(studentId: string) {
    setSelectedStudentId(studentId);
    setStudentTab("overview");
  }

  if (workspace === "bo") {
    return <BOWorkspace onSwitch={() => setWorkspace("ops")} />;
  }

  const featureTitle = selectedStudent ? selectedStudent.name : selectedClass ? selectedClass.title : rootTitle(opsRoot);

  return (
    <div className={styles.prototypePage}>
      <div className={styles.prototypeBanner}>
        <span>PROTOTYPE · UI EVIDENCE ONLY</span>
        <strong>TOS Adaptive Workspace v1</strong>
        <button onClick={() => setWorkspace("bo")}>Xem BO desktop ↗</button>
      </div>

      <div className={styles.phoneStage}>
        <div className={styles.phoneShell}>
          <header className={styles.mobileHeader}>
            {opsRoot === "home" && !selectedClass ? (
              <div>
                <span className={styles.kicker}>PINO TEAM OS · OPS</span>
                <h1>Chào Vy <span>👋</span></h1>
                <p>Thứ 5, 20/08</p>
              </div>
            ) : (
              <div>
                <span className={styles.kicker}>OPS</span>
                <h1>{featureTitle}</h1>
                <p>{selectedStudent && selectedClass ? `${selectedClass.title} · ${selectedClass.start}` : selectedClass ? `${selectedClass.start}–${selectedClass.end} · ${selectedClass.room}` : subtitleForRoot(opsRoot)}</p>
              </div>
            )}
            <button className={styles.homeButton} onClick={goHome} aria-label="Về Home">⌂</button>
          </header>

          <main className={styles.mobileContent}>
            {opsRoot === "home" ? <HomeScreen onRoot={setOpsRoot} onClass={openClass} /> : null}
            {opsRoot === "shift" ? <ShiftFeature tab={shiftTab} onTab={setShiftTab} correctionOpen={correctionOpen} setCorrectionOpen={setCorrectionOpen} /> : null}
            {opsRoot === "classes" ? (
              selectedClass ? (
                selectedStudent ? (
                  <StudentDetail student={selectedStudent} klass={selectedClass} tab={studentTab} onTab={setStudentTab} onBack={() => setSelectedStudentId(null)} journalDone={journalDone} setJournalDone={setJournalDone} achievementType={achievementType} setAchievementType={setAchievementType} />
                ) : (
                  <ClassFeature klass={selectedClass} tab={classTab} onTab={setClassTab} onStudent={openStudent} onBack={() => setSelectedClassId(null)} journalDone={journalDone} setJournalDone={setJournalDone} achievementType={achievementType} setAchievementType={setAchievementType} />
                )
              ) : <ClassesList onClass={openClass} />
            ) : null}
            {opsRoot === "students" ? <GlobalStudents onClass={openClass} /> : null}
            {opsRoot === "tasks" ? <TasksFeature tab={taskTab} onTab={setTaskTab} onRoot={setOpsRoot} onClass={openClass} /> : null}
          </main>

          {!selectedClass && opsRoot !== "shift" && opsRoot !== "tasks" ? <GlobalFooter active={opsRoot} onSelect={setOpsRoot} /> : null}
          {opsRoot === "shift" ? <FeatureFooter items={[
            ["today", "Hôm nay", "◉"], ["schedule", "Lịch", "▦"], ["register", "Đăng ký", "+"], ["check", "Check", "✓"], ["history", "Lịch sử", "◷"],
          ]} active={shiftTab} onSelect={(id) => setShiftTab(id as ShiftTab)} /> : null}
          {opsRoot === "tasks" ? <FeatureFooter items={[
            ["all", "Tất cả", "◌"], ["shift", "Ca", "▣"], ["learning", "Học vụ", "✦"], ["pinoria", "Pinoria", "◎"], ["requests", "Yêu cầu", "↺"],
          ]} active={taskTab} onSelect={(id) => setTaskTab(id as TaskTab)} /> : null}
          {selectedClass ? <FeatureFooter items={[
            ["overview", "Tổng quan", "⌂"], ["students", "Học viên", "◎"], ["lesson", "Giáo án", "▤"], ["journal", "Journal", "✎"], ["achievement", "Thành tựu", "✦"],
          ]} active={selectedStudent ? studentTab : classTab} onSelect={(id) => selectedStudent ? setStudentTab(id === "students" ? "overview" : id as StudentTab) : setClassTab(id as ClassTab)} /> : null}
        </div>
      </div>
    </div>
  );
}

function HomeScreen({ onRoot, onClass }: { onRoot: (root: OpsRoot) => void; onClass: (id: string) => void }) {
  return <div className={styles.stack}>
    <section className={`${styles.card} ${styles.shiftHero}`}>
      <div><span className={styles.label}>CA HIỆN TẠI</span><strong>17:30 – 21:00</strong><small><i className={styles.greenDot} /> Đang làm việc · Check-in 17:27</small></div>
      <button onClick={() => onRoot("shift")}>›</button>
    </section>
    <section className={styles.card}>
      <div className={styles.cardHead}><div><span className={styles.label}>LỚP TIẾP THEO</span><strong>18:00 · ArtChitect</strong><small>Phòng Họa · bắt đầu sau 35 phút</small></div><button onClick={() => onClass("art-1800")}>›</button></div>
    </section>
    <section className={styles.card}>
      <div className={styles.cardHead}><div><span className={styles.label}>VIỆC CẦN XỬ LÝ</span><strong>3 việc hôm nay</strong></div><button onClick={() => onRoot("tasks")}>›</button></div>
      <div className={styles.compactList}>
        <span><b>Journal</b><em>ArtChitect · An</em><time>19:30</time></span>
        <span><b>Achievement</b><em>Gam C · evidence ready</em><time>20:15</time></span>
        <span><b>Pinoria</b><em>Reception · choice đang chờ</em><time>18:45</time></span>
      </div>
    </section>
    <section>
      <div className={styles.sectionTitle}><div><span className={styles.label}>LỐI TẮT</span><h2>Hôm nay bạn cần gì?</h2></div></div>
      <div className={styles.shortcutGrid}>
        <Shortcut icon="✓" label="Check-in/out" onClick={() => { onRoot("shift"); }} />
        <Shortcut icon="▣" label="Ca của tôi" onClick={() => onRoot("shift")} />
        <Shortcut icon="+" label="Đăng ký ca" onClick={() => onRoot("shift")} />
        <Shortcut icon="◷" label="Chấm công" onClick={() => onRoot("shift")} />
        <Shortcut icon="▤" label="Lớp hôm nay" onClick={() => onRoot("classes")} />
        <Shortcut icon="◎" label="Học viên" onClick={() => onRoot("students")} />
        <Shortcut icon="✎" label="Journal" onClick={() => onClass("art-1800")} />
        <Shortcut icon="✦" label="Thành tựu" onClick={() => onClass("art-1800")} />
        <Shortcut icon="◈" label="Pinoria" onClick={() => onRoot("tasks")} note="Reception" />
        <Shortcut icon="◌" label="Cần xử lý" onClick={() => onRoot("tasks")} />
      </div>
    </section>
  </div>;
}

function Shortcut({ icon, label, onClick, note }: { icon: string; label: string; onClick: () => void; note?: string }) {
  return <button className={styles.shortcut} onClick={onClick}><span>{icon}</span><strong>{label}</strong>{note ? <small>{note}</small> : null}</button>;
}

function ShiftFeature({ tab, onTab, correctionOpen, setCorrectionOpen }: { tab: ShiftTab; onTab: (tab: ShiftTab) => void; correctionOpen: boolean; setCorrectionOpen: (open: boolean) => void }) {
  if (tab === "today") return <div className={styles.stack}>
    <section className={`${styles.card} ${styles.bigStatus}`}><span className={styles.label}>HÔM NAY</span><strong>17:30 – 21:00</strong><p><i className={styles.greenDot} /> Đã Check-in lúc 17:27</p><button className={styles.primaryButton} onClick={() => onTab("check")}>Mở Check-in/out</button></section>
    <section className={styles.card}><span className={styles.label}>ĐƯỢC PHÂN CÔNG</span><div className={styles.timelineItem}><time>18:00</time><div><strong>ArtChitect</strong><small>Phòng Họa · Mentor Vy</small></div></div><div className={styles.timelineItem}><time>19:30</time><div><strong>PianoHouse</strong><small>Phòng Piano 2 · Mentor Hằng</small></div></div></section>
  </div>;
  if (tab === "schedule") return <div className={styles.stack}><WeekStrip /><section className={styles.card}><span className={styles.label}>THỨ 5 · 20/08</span><ShiftRow time="17:30–21:00" title="PA · Full evening" meta="ArtChitect + PianoHouse" /><ShiftRow time="18:00–19:30" title="ArtChitect" meta="Phòng Họa" /><ShiftRow time="19:30–20:30" title="PianoHouse" meta="Phòng Piano 2" /></section></div>;
  if (tab === "register") return <ShiftRegistrationPrototype />;
  if (tab === "check") return <div className={styles.stack}><section className={`${styles.card} ${styles.checkCard}`}><span className={styles.label}>TRẠNG THÁI</span><div className={styles.checkStatus}><i className={styles.greenDot} /><strong>Đang làm việc</strong></div><p>Check-in · 17:27</p><textarea placeholder="Ghi chú nếu cần…" /><button className={styles.dangerButton}>CHECK OUT</button><small className={styles.helper}>Prototype UI only · không ghi dữ liệu chấm công.</small></section></div>;
  return <div className={styles.stack}>
    <section className={styles.filterPills}><button className={styles.activePill}>Tháng 8</button><button>Tất cả</button></section>
    <TimesheetCard date="20/08" inTime="17:27" outTime="21:03" rounded="17:30 → 21:00" status="Bình thường" onCorrect={() => setCorrectionOpen(true)} />
    <TimesheetCard date="18/08" inTime="17:34" outTime="—" rounded="17:30 → —" status="Thiếu Check-out" onCorrect={() => setCorrectionOpen(true)} warn />
    {correctionOpen ? <CorrectionSheet onClose={() => setCorrectionOpen(false)} /> : null}
  </div>;
}

function WeekStrip() { return <div className={styles.weekStrip}>{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d, i) => <button key={d} className={i === 3 ? styles.dayActive : ""}><span>{d}</span><strong>{17 + i}</strong></button>)}</div>; }

function ShiftRow({ time, title, meta }: { time: string; title: string; meta: string }) { return <div className={styles.shiftRow}><time>{time}</time><div><strong>{title}</strong><small>{meta}</small></div></div>; }

function ShiftRegistrationPrototype() {
  const [selected, setSelected] = useState<Record<string, boolean>>({ "T2-Tối": true, "T4-Tối": true, "T6-Tối": true });
  return <div className={styles.stack}><section className={styles.card}><span className={styles.label}>TUẦN SAU · 24–30/08</span><h2>Đăng ký ca</h2><p className={styles.muted}>Chọn những ca bạn có thể nhận. Manager là người chốt cuối.</p>{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(day => <div className={styles.registrationDay} key={day}><strong>{day}</strong><button className={selected[`${day}-Tối`] ? styles.selectedShift : ""} onClick={() => setSelected(current => ({ ...current, [`${day}-Tối`]: !current[`${day}-Tối`] }))}>17:30–21:00</button></div>)}<div className={styles.stickyActions}><button>Lưu nháp</button><button className={styles.primaryButton}>Gửi đăng ký</button></div></section></div>;
}

function TimesheetCard({ date, inTime, outTime, rounded, status, warn, onCorrect }: { date: string; inTime: string; outTime: string; rounded: string; status: string; warn?: boolean; onCorrect: () => void }) {
  return <section className={styles.card}><div className={styles.cardHead}><div><span className={styles.label}>{date}</span><strong>{inTime} → {outTime}</strong><small>Rounded · {rounded}</small></div><span className={warn ? styles.warnBadge : styles.goodBadge}>{status}</span></div><button className={styles.textAction} onClick={onCorrect}>Yêu cầu chỉnh sửa →</button></section>;
}

function CorrectionSheet({ onClose }: { onClose: () => void }) {
  return <div className={styles.sheetBackdrop}><div className={styles.bottomSheet}><div className={styles.sheetHandle} /><span className={styles.label}>UI EVIDENCE ONLY</span><h2>Yêu cầu chỉnh chấm công</h2><label>Giá trị đề nghị<input type="time" defaultValue="21:00" /></label><label>Lý do<textarea defaultValue="Quên check-out sau khi hỗ trợ phụ huynh cuối ca." /></label><button className={styles.primaryButton} onClick={onClose}>Gửi yêu cầu</button><button className={styles.ghostButton} onClick={onClose}>Đóng</button></div></div>;
}

function ClassesList({ onClass }: { onClass: (id: string) => void }) {
  return <div className={styles.stack}><div className={styles.sectionTitle}><div><span className={styles.label}>THỨ 5 · 20/08</span><h2>Lớp hôm nay</h2></div></div>{classes.map(item => { const present = item.students.filter(s => s.attendance === "present").length; return <button className={`${styles.card} ${styles.classCard}`} key={item.id} onClick={() => onClass(item.id)}><time>{item.start}</time><div><strong>{item.title}</strong><small>{item.room} · {item.end}</small><div className={styles.tagRow}><span>Mentor {item.mentor}</span><span>PA {item.pa}</span></div><p>{present}/{item.students.length} học viên đã đến</p></div><b>›</b></button>; })}</div>;
}

function ClassFeature({ klass, tab, onTab, onStudent, onBack, journalDone, setJournalDone, achievementType, setAchievementType }: { klass: ClassItem; tab: ClassTab; onTab: (tab: ClassTab) => void; onStudent: (id: string) => void; onBack: () => void; journalDone: boolean; setJournalDone: (done: boolean) => void; achievementType: "piano" | "art"; setAchievementType: (type: "piano" | "art") => void }) {
  const present = klass.students.filter(s => s.attendance === "present").length;
  if (tab === "students") return <StudentList klass={klass} onStudent={onStudent} onBack={onBack} />;
  if (tab === "lesson") return <LessonView klass={klass} />;
  if (tab === "journal") return <JournalView klass={klass} done={journalDone} setDone={setJournalDone} />;
  if (tab === "achievement") return <AchievementView type={achievementType} setType={setAchievementType} studentName={klass.students[0]?.name ?? "Học viên"} />;
  return <div className={styles.stack}>
    <button className={styles.backLink} onClick={onBack}>← Lớp hôm nay</button>
    <section className={styles.card}><span className={styles.label}>THÔNG TIN LỚP</span><InfoRow label="Mentor" value={klass.mentor} /><InfoRow label="PA" value={klass.pa} /><InfoRow label="Sĩ số" value={`${present}/${klass.students.length}`} /><InfoRow label="Tình trạng" value="Đang diễn ra" good /><InfoRow label="Syllabus hôm nay" value={klass.syllabus} /></section>
    <section className={styles.card}><span className={styles.label}>HIỆN DIỆN · READ ONLY</span><div className={styles.attendanceMeter}><div style={{ width: `${(present / klass.students.length) * 100}%` }} /></div><InfoRow label="Đã đến" value={String(present)} /><InfoRow label="Chưa đến" value={String(klass.students.length - present)} warn /><small className={styles.helper}>Nguồn: Reception. Mentor chỉ xem facts, không Check-in/out.</small></section>
    <section className={styles.card}><span className={styles.label}>PEDAGOGY ATTENTION</span><TaskLine title="Journal lớp chưa hoàn tất" meta="Hoàn thành trước khi kết thúc ca" /><TaskLine title="1 Achievement cần review" meta="Evidence đã sẵn sàng" /></section>
  </div>;
}

function StudentList({ klass, onStudent, onBack }: { klass: ClassItem; onStudent: (id: string) => void; onBack: () => void }) {
  return <div className={styles.stack}><button className={styles.backLink} onClick={onBack}>← Lớp hôm nay</button><section className={styles.filterPills}><button className={styles.activePill}>Tất cả ({klass.students.length})</button><button>Đã đến</button><button>Chưa đến</button></section><section className={styles.cardList}>{klass.students.map(student => <button key={student.id} className={styles.studentRow} onClick={() => onStudent(student.id)}><span className={styles.avatar}>{student.initial}</span><span><strong>{student.name}</strong><small className={student.attendance === "present" ? styles.presentText : styles.absentText}>{student.attendance === "present" ? `● Đã đến ${student.checkIn}` : student.attendance === "left" ? `Đã về ${student.checkOut}` : "○ Chưa đến"}</small></span><b>›</b></button>)}</section><p className={styles.boundaryNote}>Pedagogy view · không có action Check-in/out · không có Pinoria.</p></div>;
}

function StudentDetail({ student, klass, tab, onTab, onBack, journalDone, setJournalDone, achievementType, setAchievementType }: { student: Student; klass: ClassItem; tab: StudentTab; onTab: (tab: StudentTab) => void; onBack: () => void; journalDone: boolean; setJournalDone: (done: boolean) => void; achievementType: "piano" | "art"; setAchievementType: (type: "piano" | "art") => void }) {
  if (tab === "lesson") return <><button className={styles.backLink} onClick={onBack}>← Danh sách học viên</button><LessonView klass={klass} student={student} /></>;
  if (tab === "journal") return <><button className={styles.backLink} onClick={onBack}>← Danh sách học viên</button><JournalView klass={klass} student={student} done={journalDone} setDone={setJournalDone} /></>;
  if (tab === "achievement") return <><button className={styles.backLink} onClick={onBack}>← Danh sách học viên</button><AchievementView type={achievementType} setType={setAchievementType} studentName={student.name} /></>;
  return <div className={styles.stack}><button className={styles.backLink} onClick={onBack}>← Danh sách học viên</button><section className={styles.card}><span className={styles.label}>THÔNG TIN HIỆN DIỆN</span><InfoRow label="Check-in" value={student.checkIn ?? "—"} good={!!student.checkIn} /><InfoRow label="Check-out" value={student.checkOut ?? "—"} /><small className={styles.helper}>Nguồn: Reception · Mentor chỉ xem thông tin, không thao tác.</small></section><section className={styles.card}><span className={styles.label}>THÔNG TIN HỌC TẬP</span><InfoRow label="Journey hiện tại" value={student.journey} /><InfoRow label="Bài học hôm nay" value={klass.syllabus} /><div className={styles.objectiveBox}><strong>Mục tiêu buổi học</strong><ul><li>Kỹ thuật layering</li><li>Kiểm soát lượng nước</li><li>Phối màu hài hòa</li></ul></div></section><section className={styles.card}><span className={styles.label}>GHI CHÚ SƯ PHẠM</span><textarea placeholder={`Nhập ghi chú về ${student.name} trong buổi học…`} defaultValue={student.note} /></section><p className={styles.boundaryNote}>Thuần pedagogy · attendance facts only · Pinoria-free.</p></div>;
}

function LessonView({ klass, student }: { klass: ClassItem; student?: Student }) {
  return <div className={styles.stack}><section className={styles.card}><span className={styles.label}>GIÁO ÁN THỰC THI</span><h2>{klass.syllabus}</h2><p>{student ? `${student.name} · ${student.journey}` : `${klass.title} · ${klass.path}`}</p><div className={styles.objectiveBox}><strong>Mục tiêu</strong><ul><li>Kỹ thuật ướt trên ướt</li><li>Kiểm soát lượng nước</li><li>Tạo lớp màu trong suốt</li></ul></div></section><section className={styles.card}><span className={styles.label}>NỘI DUNG HÔM NAY</span>{lessonBlocks.map(([n, title, state]) => <div className={styles.lessonStep} key={n}><span>{n}</span><strong>{title}</strong><em className={state === "done" ? styles.goodBadge : state === "now" ? styles.warnBadge : ""}>{state === "done" ? "✓" : state === "now" ? "Đang làm" : "○"}</em></div>)}</section><section className={styles.mediaPlaceholder}><span>▶</span><strong>Demo / reference media</strong><small>Execution projection · không phải CMS</small></section></div>;
}

function JournalView({ klass, student, done, setDone }: { klass: ClassItem; student?: Student; done: boolean; setDone: (done: boolean) => void }) {
  return <div className={styles.stack}><section className={styles.card}><span className={styles.label}>CLASSROOM JOURNAL</span><h2>{student ? `Journal · ${student.name}` : klass.title}</h2><p className={styles.muted}>Capture-first · evidence candidate only.</p><div className={styles.captureGrid}><button><span>📷</span><strong>Chụp ảnh bài</strong></button><button><span>🎙</span><strong>Ghi âm</strong></button><button><span>🎥</span><strong>Video</strong></button></div><label className={styles.field}>Quan sát {student ? "học viên" : "chung"}<textarea placeholder="Ghi lại điều đáng chú ý trong buổi học…" /></label>{!student ? <div className={styles.studentNotes}><button>Bơ <span>+</span></button><button>An <span>+</span></button><button>Minh <span>+</span></button></div> : null}<div className={styles.stickyActions}><button>Lưu nháp</button><button className={done ? styles.successButton : styles.primaryButton} onClick={() => setDone(!done)}>{done ? "✓ Đã hoàn tất" : "Hoàn tất Journal"}</button></div></section></div>;
}

function AchievementView({ type, setType, studentName }: { type: "piano" | "art"; setType: (type: "piano" | "art") => void; studentName: string }) {
  const piano = type === "piano";
  return <div className={styles.stack}><section className={styles.filterPills}><button className={!piano ? styles.activePill : ""} onClick={() => setType("art")}>Art example</button><button className={piano ? styles.activePill : ""} onClick={() => setType("piano")}>Piano example</button></section><section className={styles.card}><span className={styles.label}>UNIVERSAL ACHIEVEMENT SHELL</span><h2>{piano ? "Gam C trưởng" : "Đồ án màu nước II"}</h2><p>{studentName} · {piano ? "PianoHouse" : "ArtChitect"}</p><div className={styles.evidenceCard}><span>{piano ? "🎙" : "📷"}</span><div><strong>{piano ? "recording-gam-c.m4a" : "watercolor-final.jpg"}</strong><small>Evidence candidate</small></div></div><div className={styles.criteria}>{(piano ? ["Đúng nốt 2 tay", "Nhịp ổn định", "1 octave liền mạch"] : ["Layering", "Color control", "Composition"]).map((item, i) => <label key={item}><input type="checkbox" defaultChecked={i < 2} /> <span>{item}</span></label>)}</div><label className={styles.field}>Assessment<select defaultValue="ready"><option value="notyet">Chưa đủ</option><option value="ready">Đạt</option><option value="retry">Cần làm lại</option></select></label><button className={styles.primaryButton}>Xác nhận Achievement</button><small className={styles.helper}>Prototype only · UI không tự tạo Journey truth.</small></section></div>;
}

function GlobalStudents({ onClass }: { onClass: (id: string) => void }) {
  const all = useMemo(() => classes.flatMap(klass => klass.students.map(student => ({ ...student, classId: klass.id, className: klass.title }))), []);
  return <div className={styles.stack}><label className={styles.searchBox}>⌕<input placeholder="Tìm học viên trong ca của bạn…" /></label><section className={styles.cardList}>{all.slice(0, 10).map(student => <button className={styles.studentRow} key={`${student.classId}-${student.id}`} onClick={() => onClass(student.classId)}><span className={styles.avatar}>{student.initial}</span><span><strong>{student.name}</strong><small>{student.className} · {student.journey}</small></span><b>›</b></button>)}</section><p className={styles.boundaryNote}>Ops lookup chỉ phục vụ pedagogy context · không phải CRM profile.</p></div>;
}

function TasksFeature({ tab, onTab, onRoot, onClass }: { tab: TaskTab; onTab: (tab: TaskTab) => void; onRoot: (root: OpsRoot) => void; onClass: (id: string) => void }) {
  const visible = taskItems.filter(item => tab === "all" || item.type === tab);
  return <div className={styles.stack}><section className={styles.card}><span className={styles.label}>ATTENTION INBOX</span><h2>{visible.length} việc cần bạn chú ý</h2><p className={styles.muted}>Inbox chỉ aggregate deep-link, không sở hữu business state.</p></section>{visible.map(item => <section className={styles.card} key={item.id}><div className={styles.taskItem}><span className={styles.taskDot} /><div><time>{item.time}</time><strong>{item.title}</strong><small>{item.meta}</small></div><button onClick={() => item.type === "learning" ? onClass("art-1800") : item.type === "shift" || item.type === "requests" ? onRoot("shift") : onTab("pinoria")}>{item.action}</button></div></section>)}</div>;
}

function GlobalFooter({ active, onSelect }: { active: OpsRoot; onSelect: (id: OpsRoot) => void }) {
  return <nav className={styles.mobileFooter}>{opsGlobalNav.map(item => <button className={active === item.id ? styles.footerActive : ""} key={item.id} onClick={() => onSelect(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}</nav>;
}

function FeatureFooter({ items, active, onSelect }: { items: [string, string, string][]; active: string; onSelect: (id: string) => void }) {
  return <nav className={styles.mobileFooter}>{items.map(([id, label, icon]) => <button className={active === id ? styles.footerActive : ""} key={id} onClick={() => onSelect(id)}><span>{icon}</span><small>{label}</small></button>)}</nav>;
}

function BOWorkspace({ onSwitch }: { onSwitch: () => void }) {
  const [group, setGroup] = useState("Overview");
  const groups = ["Overview", "Operations", "Learning", "People", "Workforce", "Pinoria", "Content", "System"];
  return <div className={styles.boPage}><aside className={styles.boSidebar}><div className={styles.boBrand}><span>P</span><div><strong>PINO TOS</strong><small>Back Office</small></div></div>{groups.map(item => <button key={item} className={group === item ? styles.boNavActive : ""} onClick={() => setGroup(item)}>{item}<span>›</span></button>)}<div className={styles.boFoot}><span>PROTOTYPE</span><button onClick={onSwitch}>← OPS mobile</button></div></aside><main className={styles.boMain}><header className={styles.boHeader}><div><span className={styles.label}>BACK OFFICE · DESKTOP FIRST</span><h1>{group}</h1><p>Control the house · quản lý, cấu hình và xử lý ngoại lệ.</p></div><div className={styles.userChip}>Vy · Founder <span>⌄</span></div></header>{group === "Overview" ? <BODashboard /> : <BOPlaceholder group={group} />}</main></div>;
}

function BODashboard() {
  return <><div className={styles.metricGrid}><Metric label="Lớp đang diễn ra" value="12" note="+2 so với hôm qua" /><Metric label="Học viên có mặt" value="78%" note="245 / 315" /><Metric label="Việc cần xử lý" value="23" note="+5 mới hôm nay" /><Metric label="Check-in hôm nay" value="36" note="/ 42 staff" /></div><div className={styles.boTwoCol}><section className={styles.boPanel}><div className={styles.panelHead}><div><span className={styles.label}>OPERATIONS</span><h2>Lớp hôm nay</h2></div><button>View all</button></div><BOTable rows={[["18:00", "ArtChitect", "Phòng Họa", "6/8"], ["19:30", "PianoHouse", "Piano 2", "7/10"], ["20:45", "ArtChitect Advanced", "Phòng Họa", "4/6"], ["18:00", "Afterwork · Acrylic", "Studio", "9/12"]]} /></section><section className={styles.boPanel}><div className={styles.panelHead}><div><span className={styles.label}>ATTENTION</span><h2>Cần xử lý</h2></div></div><TaskLine title="3 Pinoria choices" meta="Reception queue" /><TaskLine title="2 Journal chưa hoàn tất" meta="Học vụ" /><TaskLine title="4 Achievement cần review" meta="Learning" /><TaskLine title="1 yêu cầu chỉnh chấm công" meta="Workforce" /></section></div><div className={styles.boThreeCol}><section className={styles.boPanel}><span className={styles.label}>WORKFORCE</span><h2>Coverage hôm nay</h2><div className={styles.coverageBars}><span><b>TE</b><i style={{ width: "92%" }} /></span><span><b>TA</b><i style={{ width: "78%" }} /></span><span><b>Reception</b><i style={{ width: "100%" }} /></span></div></section><section className={styles.boPanel}><span className={styles.label}>BOOKINGS</span><h2>6 pending</h2><p>Action queue tách Booking và Registration. Không bulk mutation trong v1.</p></section><section className={styles.boPanel}><span className={styles.label}>SYSTEM</span><h2>Policy / Access</h2><p>Desktop configuration surface. Permission + Scope + Context vẫn là authority.</p></section></div></>;
}

function BOPlaceholder({ group }: { group: string }) { return <section className={`${styles.boPanel} ${styles.placeholderPanel}`}><span className={styles.label}>SHELL EVIDENCE</span><h2>{group}</h2><p>Chưa build module business trong prototype này. Mục tiêu hiện tại là kiểm chứng navigation, density và desktop composition.</p><div className={styles.placeholderGrid}>{[1, 2, 3].map(item => <div key={item}><span /><strong>Future {group} surface</strong><small>Queue / table / split view / form tùy feature.</small></div>)}</div></section>; }

function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <section className={styles.metric}><span>{label}</span><strong>{value}</strong><small>{note}</small></section>; }
function BOTable({ rows }: { rows: string[][] }) { return <div className={styles.boTable}>{rows.map(row => <div key={row.join("-")}>{row.map((cell, index) => <span key={`${cell}-${index}`} className={index === 1 ? styles.tableStrong : ""}>{cell}</span>)}</div>)}</div>; }
function InfoRow({ label, value, good, warn }: { label: string; value: string; good?: boolean; warn?: boolean }) { return <div className={styles.infoRow}><span>{label}</span><strong className={good ? styles.presentText : warn ? styles.absentText : ""}>{value}</strong></div>; }
function TaskLine({ title, meta }: { title: string; meta: string }) { return <div className={styles.taskLine}><span className={styles.taskDot} /><div><strong>{title}</strong><small>{meta}</small></div><b>›</b></div>; }

function rootTitle(root: OpsRoot) {
  return ({ home: "Home", shift: "Ca của tôi", classes: "Lớp hôm nay", students: "Học viên", tasks: "Việc" } satisfies Record<OpsRoot, string>)[root];
}
function subtitleForRoot(root: OpsRoot) {
  return ({ home: "", shift: "Workforce · cá nhân", classes: "Pedagogy execution", students: "Trong assignment của bạn", tasks: "Attention inbox" } satisfies Record<OpsRoot, string>)[root];
}
