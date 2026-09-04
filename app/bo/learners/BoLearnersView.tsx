"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoLearnerDirectoryItem, BoLearnerLifecycle, BoPathProgram, BoRunningClass } from "@/lib/bo-model";
import { LatestRequestFence, collectPagedDirectory } from "@/lib/bo-school-students-state";
import styles from "./bo-learners.module.css";
import { StudentPinoriaPanel } from "./StudentPinoriaPanel";

type Catalog = { paths: BoPathProgram[]; classes: BoRunningClass[] };
type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };
type Filter = "active" | "inactive" | "all";

export function BoLearnersView() {
  const [directory, setDirectory] = useState<Load<BoLearnerDirectoryItem[]>>({ state: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Load<BoLearnerLifecycle> | null>(null);
  const [catalog, setCatalog] = useState<Catalog>({ paths: [], classes: [] });
  const [filter, setFilter] = useState<Filter>("active");
  const [query, setQuery] = useState("");
  const detailRequestFence = useRef(new LatestRequestFence());
  const selectedIdRef = useRef<string | null>(null);

  async function readDirectory() {
    return collectPagedDirectory((beforeStudentId, limit) => boApi.learners("", limit, beforeStudentId));
  }

  function selectStudent(id: string | null) {
    selectedIdRef.current = id;
    detailRequestFence.current.invalidate();
    setSelectedId(id);
  }

  async function loadDirectory() {
    try {
      const rows = await readDirectory();
      setDirectory({ state: "ready", data: rows });
      const current = selectedIdRef.current;
      if (!current || !rows.some((item) => item.id === current)) {
        selectStudent(rows.find((item) => item.activeSubscriptions > 0)?.id ?? rows[0]?.id ?? null);
      }
    } catch (error) {
      setDirectory({ state: "error", message: message(error) });
    }
  }

  async function loadDetail(id: string) {
    const ticket = detailRequestFence.current.begin(id);
    setDetail({ state: "loading" });
    try {
      const data = await boApi.learnerLifecycle(id);
      if (detailRequestFence.current.isCurrent(ticket, selectedIdRef.current)) setDetail({ state: "ready", data });
    } catch (error) {
      if (detailRequestFence.current.isCurrent(ticket, selectedIdRef.current)) setDetail({ state: "error", message: message(error) });
    }
  }

  useEffect(() => {
    let active = true;
    void collectPagedDirectory((beforeStudentId, limit) => boApi.learners("", limit, beforeStudentId)).then((rows) => {
      if (!active) return;
      setDirectory({ state: "ready", data: rows });
      const next = rows.find((item) => item.activeSubscriptions > 0)?.id ?? rows[0]?.id ?? null;
      selectedIdRef.current = next;
      setSelectedId(next);
    }).catch((error: unknown) => { if (active) setDirectory({ state: "error", message: message(error) }); });
    void boApi.scopeCatalog().then((value) => { if (active) setCatalog({ paths: value.paths, classes: value.classes }); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => { if (selectedId) void loadDetail(selectedId); }, [selectedId]);

  const rows = useMemo(() => directory.state === "ready" ? directory.data : [], [directory]);
  const activeRows = useMemo(() => rows.filter((student) => student.activeSubscriptions > 0), [rows]);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("vi");
    return rows.filter((student) => {
      if (filter === "active" && student.activeSubscriptions === 0) return false;
      if (filter === "inactive" && student.activeSubscriptions > 0) return false;
      if (!term) return true;
      return `${student.displayName} ${student.activePaths.map((path) => path.displayName).join(" ")}`.toLocaleLowerCase("vi").includes(term);
    });
  }, [filter, query, rows]);

  function switchFilter(next: Filter) {
    setFilter(next);
    const first = rows.find((student) => next === "all" || (next === "active" ? student.activeSubscriptions > 0 : student.activeSubscriptions === 0));
    if (first) selectStudent(first.id);
  }


  if (directory.state === "loading" && !selectedId) return <State text="Đang tải danh sách học viên…" />;
  if (directory.state === "error") return <State text={directory.message} error />;

  return <main className={styles.page}>
    <header className={styles.heading}>
      <div>
        <span>School · Student management</span>
        <h1>Học viên</h1>
        <p>Manager nhìn ngay ai đang học, học chương trình nào, còn bao nhiêu buổi và đang ở lớp nào.</p>
      </div>
      <Link className={styles.primaryButton} href="/bo/running-classes">Mở Classes</Link>
    </header>

    <section className={styles.metrics}>
      <Metric label="Tổng hồ sơ" value={rows.length} note="canonical Student" />
      <Metric label="Đang học" value={activeRows.length} note="có active Path" />
      <Metric label="House Member" value={rows.filter((item) => item.houseMember).length} note="membership hiện có" />
      <Metric label="Chưa active" value={rows.filter((item) => item.activeSubscriptions === 0).length} note="chưa có active Path" />
    </section>

    <section className={styles.workspace}>
      <aside className={styles.directory}>
        <div className={styles.searchWrap}><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm học viên, chương trình…" /></div>
        <div className={styles.tabs}>
          <FilterButton active={filter === "active"} onClick={() => switchFilter("active")}>Đang học <b>{activeRows.length}</b></FilterButton>
          <FilterButton active={filter === "inactive"} onClick={() => switchFilter("inactive")}>Chưa active <b>{rows.length - activeRows.length}</b></FilterButton>
          <FilterButton active={filter === "all"} onClick={() => switchFilter("all")}>Tất cả <b>{rows.length}</b></FilterButton>
        </div>
        <div className={styles.directoryMeta}><span>{filtered.length} học viên</span><small>Live canonical read</small></div>
        <div className={styles.studentList}>
          {filtered.map((student) => <StudentButton key={student.id} student={student} active={selectedId === student.id} onClick={() => selectStudent(student.id)} />)}
          {!filtered.length ? <div className={styles.emptyInline}>Không có học viên phù hợp.</div> : null}
        </div>
      </aside>

      <section className={styles.detail}>
        {selectedId ? <LearnerDetail load={detail} catalog={catalog} /> : <State text="Chọn học viên để mở hồ sơ." />}
      </section>
    </section>

  </main>;
}

function Metric({ label, value, note }: { label: string; value: number; note: string }) {
  return <article className={styles.metric}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={active ? styles.tabActive : ""} onClick={onClick}>{children}</button>;
}

function StudentButton({ student, active, onClick }: { student: BoLearnerDirectoryItem; active: boolean; onClick: () => void }) {
  const learning = student.activeSubscriptions > 0;
  return <button type="button" className={`${styles.studentCard} ${active ? styles.studentCardActive : ""}`} onClick={onClick}>
    <span className={styles.avatarSmall}>{initials(student.displayName)}</span>
    <span className={styles.studentCardBody}>
      <span className={styles.studentNameRow}><strong>{student.displayName}</strong></span>
      <small>{ageLabel(student.birthYear)}</small>
      <span className={styles.studentMeta}>{learning ? student.activePaths.map((path) => path.displayName).join(" · ") : "Chưa có active Path"}</span>
    </span>
    <span className={styles.unitBadge}>{learning ? <><b>{student.activeSubscriptions}</b><small>path</small></> : <small>—</small>}</span>
  </button>;
}

function LearnerDetail({ load, catalog }: { load: Load<BoLearnerLifecycle> | null; catalog: Catalog }) {
  if (!load || load.state === "loading") return <State text="Đang tải lifecycle…" />;
  if (load.state === "error") return <State text={load.message} error />;
  const data = load.data;
  const active = data.subscriptions.filter((entry) => entry.subscription.lifecycle === "ACTIVE");
  const units = active.reduce((sum, entry) => sum + entry.subscription.effectiveAvailableUnits, 0);
  return <>
    <StudentHero lifecycle={data} activeCount={active.length} />
    <AttentionCard lifecycle={data} />
    <LearningSection lifecycle={data} catalog={catalog} />
    <StudentPinoriaPanel studentId={data.student.id} />
    <section className={styles.lowerGrid}>
      <GuardianPanel lifecycle={data} />
      <MembershipPanel lifecycle={data} units={units} />
    </section>
    <SystemDetails lifecycle={data} />
  </>;
}

function StudentHero({ lifecycle, activeCount }: { lifecycle: BoLearnerLifecycle; activeCount: number }) {
  const student = lifecycle.student;
  return <section className={styles.heroCard}>
    <div className={styles.heroIdentity}>
      <span className={styles.avatarLarge}>{initials(student.displayName)}</span>
      <div><span className={styles.eyebrow}>Student profile</span><h2>{student.displayName}</h2><p>{ageLabel(student.birthYear)}</p></div>
    </div>
    <div className={styles.heroActions}><Link className={styles.secondaryButton} href="/bo/running-classes">Mở Classes</Link></div>
    <div className={styles.heroStatus}>
      <span className={activeCount ? styles.statusActive : styles.statusMuted}>{activeCount ? "Đang học" : "Chưa active"}</span>
      {lifecycle.houseMembership ? <span>House Member</span> : null}
      {activeCount > 1 ? <span>{activeCount} chương trình</span> : null}
    </div>
  </section>;
}

function AttentionCard({ lifecycle }: { lifecycle: BoLearnerLifecycle }) {
  const active = lifecycle.subscriptions.filter((entry) => entry.subscription.lifecycle === "ACTIVE");
  const alerts: string[] = [];
  if (!active.length) alerts.push("Chưa có chương trình đang học — cần tạo Subscription trước khi xếp lớp.");
  const low = active.filter((entry) => entry.subscription.effectiveAvailableUnits <= 4);
  if (low.length) alerts.push(`${low.map((entry) => entry.subscription.pathDisplayName).join(", ")} còn ≤ 4 buổi — nên xử lý renewal sớm.`);
  const unplaced = active.filter((entry) => !entry.enrollments.some(isCurrentEnrollment));
  if (unplaced.length) alerts.push(`${unplaced.map((entry) => entry.subscription.pathDisplayName).join(", ")} chưa có lớp đang hiệu lực.`);
  if (!lifecycle.guardians.length) alerts.push("Chưa có Guardian active trên hồ sơ.");
  if (!alerts.length) return <section className={styles.goodCard}><span>✓</span><div><strong>Hồ sơ đang ổn</strong><p>Không có exception vận hành rõ ràng trong lifecycle hiện tại.</p></div></section>;
  return <section className={styles.attentionCard}><span>!</span><div><strong>Cần chú ý</strong>{alerts.map((alert) => <p key={alert}>{alert}</p>)}</div></section>;
}

function LearningSection({ lifecycle, catalog }: { lifecycle: BoLearnerLifecycle; catalog: Catalog }) {
  const active = lifecycle.subscriptions.filter((entry) => entry.subscription.lifecycle === "ACTIVE");
  return <section className={styles.sectionCard}>
    <div className={styles.sectionHeading}>
      <div><span className={styles.eyebrow}>Current learning</span><h3>Chương trình đang học</h3></div>
      <span className={styles.linkButton}>Read-only</span>
    </div>
    {active.length ? <div className={styles.learningGrid}>{active.map((entry) => <LearningCard key={entry.subscription.id} entry={entry} catalog={catalog} />)}</div> : <div className={styles.emptyState}><strong>Chưa có Subscription active</strong><span>Quản lý Subscription ở owner surface độc lập.</span></div>}
  </section>;
}

function LearningCard({ entry, catalog }: { entry: BoLearnerLifecycle["subscriptions"][number]; catalog: Catalog }) {
  const subscription = entry.subscription;
  const current = entry.enrollments.filter(isCurrentEnrollment);
  const low = subscription.effectiveAvailableUnits <= Math.max(4, subscription.weeklyCommitment * 2);
  return <article className={`${styles.learningCard} ${low ? styles.learningCardLow : ""}`}>
    <div className={styles.learningCardHead}>
      <div><span>ACTIVE SUBSCRIPTION</span><strong>{subscription.pathDisplayName}</strong><small>{subscription.weeklyCommitment} buổi / tuần</small></div>
      <div className={`${styles.balance} ${low ? styles.balanceLow : ""}`}><strong>{subscription.effectiveAvailableUnits}</strong><span>buổi còn lại</span><small>~ {weeksLeft(subscription.effectiveAvailableUnits, subscription.weeklyCommitment)}</small></div>
    </div>
    <div className={styles.learningFacts}>
      <div><span>Bắt đầu</span><strong>{subscription.serviceStartsOn ?? "—"}</strong></div>
      <div><span>Commercial ref</span><strong>{subscription.commercialReference ?? "—"}</strong></div>
    </div>
    <div className={styles.classList}>
      <span className={styles.eyebrow}>Lớp hiện tại</span>
      {current.length ? current.map((enrollment) => {
        const runningClass = catalog.classes.find((item) => item.id === enrollment.runningClassId);
        return <div key={enrollment.id}><strong>{enrollment.runningClassName}</strong><span>{runningClass ? scheduleLabel(runningClass) : "Theo class schedule"}</span></div>;
      }) : <p>Chưa có class placement hiệu lực.</p>}
    </div>
    <div className={styles.cardActions}><Link href="/bo/running-classes">Mở Classes</Link></div>
  </article>;
}

function GuardianPanel({ lifecycle }: { lifecycle: BoLearnerLifecycle }) {
  return <section className={styles.sectionCard}>
    <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Family</span><h3>Guardian</h3></div><span className={styles.linkButton}>Read-only</span></div>
    {lifecycle.guardians.length ? <div className={styles.guardianList}>{lifecycle.guardians.map((guardian) => {
      const name = guardian.parent.displayName ?? "Guardian";
      return <article key={guardian.relationshipId}><span className={styles.avatarSmall}>{initials(name)}</span><div><strong>{name}</strong><span>{guardian.relationshipType} · {guardian.parent.status}</span><small>{guardian.parent.contacts.map((contact) => `${contact.type}: ${contact.value}`).join(" · ") || "Không có active contact"}</small></div></article>;
    })}</div> : <div className={styles.emptyInline}>Chưa có Guardian active.</div>}
  </section>;
}

function MembershipPanel({ lifecycle, units }: { lifecycle: BoLearnerLifecycle; units: number }) {
  const member = Boolean(lifecycle.houseMembership);
  const active = lifecycle.subscriptions.filter((entry) => entry.subscription.lifecycle === "ACTIVE").length;
  return <section className={styles.sectionCard}>
    <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>House</span><h3>Membership</h3></div></div>
    <div className={styles.membershipState}>
      <span className={member ? styles.memberMark : styles.memberMarkMuted}>{member ? "P" : "—"}</span>
      <div><strong>{member ? "House Member" : "Chưa là House Member"}</strong><span>{member ? `Canonical membership · từ ${shortDate(lifecycle.houseMembership!.joinedAt)}` : "Membership được tạo theo canonical promotion flow"}</span></div>
    </div>
    <div className={styles.miniFacts}><div><span>Active paths</span><strong>{active}</strong></div><div><span>Units hiện có</span><strong>{units}</strong></div></div>
  </section>;
}

function SystemDetails({ lifecycle }: { lifecycle: BoLearnerLifecycle }) {
  return <details className={styles.systemDetails}>
    <summary>System details</summary>
    <div><span>Student ID</span><code>{lifecycle.student.id}</code></div>
    <div><span>Status</span><code>{lifecycle.student.status}</code></div>
    <div><span>Birth precision</span><code>{lifecycle.student.birthPrecision}</code></div>
    <div><span>Source</span><code>canonical private BO lifecycle projection</code></div>
  </details>;
}

function isCurrentEnrollment(enrollment: BoLearnerLifecycle["subscriptions"][number]["enrollments"][number]) {
  const now = today();
  return enrollment.effectiveFromLocalDate <= now && (enrollment.effectiveUntilExclusiveLocalDate === null || enrollment.effectiveUntilExclusiveLocalDate > now);
}
function scheduleLabel(item: BoRunningClass) {
  const day = ["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
  return `${day[item.recurrenceWeekdays[0] ?? 0] ?? ""} · ${item.startLocalTime}`;
}
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase(); }
function ageLabel(year: number | null) { return year ? `${year} · ~${Math.max(0, new Date().getFullYear() - year)} tuổi` : "Chưa có năm sinh"; }
function weeksLeft(units: number, weekly: number) { if (!weekly) return "—"; const weeks = units / weekly; return weeks < 1 ? "< 1 tuần" : `${weeks.toFixed(weeks < 3 ? 1 : 0)} tuần`; }
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function shortDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "medium" }).format(new Date(value)); }
function State({ text, error = false }: { text: string; error?: boolean }) { return <div className={`${styles.emptyState} ${error ? styles.errorState : ""}`}><strong>{error ? "Không thể tải" : "PINO BO"}</strong><span>{text}</span></div>; }
function message(error: unknown) { return error instanceof BoApiError ? `${error.message}${error.requestId ? ` · ${error.requestId}` : ""}` : error instanceof Error ? error.message : "Read failed."; }
