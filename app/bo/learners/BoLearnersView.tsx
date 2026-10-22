"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BoDataGrid, BoDataGridBadge, BoDataGridCanonicalId, BoDataGridSidePeek, BoDataGridState, BoDataGridStatus, type BoDataGridColumn } from "@/app/bo/components/data-grid";
import { useBoDataGridUrlState } from "@/app/bo/components/data-grid/useBoDataGridUrlState";
import { boApi, BoApiError } from "@/lib/bo-api";
import { boDataGridRange } from "@/lib/bo-data-grid-state";
import { BO_STUDENT_PILOT_FIELDS, BO_STUDENT_PILOT_DEFAULT_COLUMNS, studentPilotFilterRow } from "@/lib/bo-student-pilot-fields";
import { applyBoFilterSettings, type BoFilterSettings } from "@/lib/bo-filter-settings-state";
import type { BoLearnerDirectoryItem, BoLearnerLifecycle, BoParentSearchResult, BoPathProgram, BoRunningClass } from "@/lib/bo-model";
import { LatestRequestFence, collectPagedDirectory } from "@/lib/bo-school-students-state";
import styles from "./bo-learners.module.css";
import { StudentPinoriaPanel } from "./StudentPinoriaPanel";

type Catalog = { paths: BoPathProgram[]; classes: BoRunningClass[] };
type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };
type LearningFilter = "active" | "inactive" | "all";
const STUDENT_GRID_OPTIONS = { defaultPageSize: 25, allowedPageSizes: [10, 25, 50, 100] as const };

export function BoLearnersView() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const grid = useBoDataGridUrlState(STUDENT_GRID_OPTIONS);
  const selectedId = searchParams.get("student");
  const [directory, setDirectory] = useState<Load<BoLearnerDirectoryItem[]>>({ state: "loading" });
  const [pilotSettings, setPilotSettings] = useState<BoFilterSettings>({ group: { combinator: "and", filters: [] }, visibleKeys: BO_STUDENT_PILOT_DEFAULT_COLUMNS });
  const [detail, setDetail] = useState<Load<BoLearnerLifecycle> | null>(null);
  const [catalog, setCatalog] = useState<Load<Catalog>>({ state: "loading" });
  const [showCreate, setShowCreate] = useState(false);
  const [neutralizeTarget, setNeutralizeTarget] = useState<BoLearnerLifecycle | null>(null);
  const detailRequestFence = useRef(new LatestRequestFence());
  const selectedIdRef = useRef<string | null>(null);

  async function readDirectory() {
    return collectPagedDirectory((beforeStudentId, limit) => boApi.learners("", limit, beforeStudentId));
  }

  function selectStudent(id: string | null, history: "push" | "replace" = "replace") {
    selectedIdRef.current = id;
    detailRequestFence.current.invalidate();
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("student", id);
    else params.delete("student");
    const queryString = params.toString();
    const href = queryString ? `${pathname}?${queryString}` : pathname;
    if (history === "push") router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  }

  async function loadDirectory() {
    try {
      const rows = await readDirectory();
      setDirectory({ state: "ready", data: rows });
      const current = selectedIdRef.current;
      if (current && !rows.some((item) => item.id === current)) selectStudent(null);
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
    }).catch((error: unknown) => { if (active) setDirectory({ state: "error", message: message(error) }); });
    void boApi.scopeCatalog().then((value) => { if (active) setCatalog({ state: "ready", data: { paths: value.paths, classes: value.classes } }); }).catch((error: unknown) => { if (active) setCatalog({ state: "error", message: message(error) }); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    selectedIdRef.current = selectedId;
    detailRequestFence.current.invalidate();
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId]);

  const rows = useMemo(() => directory.state === "ready" ? directory.data : [], [directory]);
  const activeRows = useMemo(() => rows.filter((student) => student.activeSubscriptions > 0), [rows]);
  const learningFilter: LearningFilter = grid.state.filters.learning === "inactive" ? "inactive" : grid.state.filters.learning === "all" ? "all" : "active";
  const filtered = useMemo(() => {
    const term = grid.state.search.trim().toLocaleLowerCase("vi");
    return rows.filter((student) => {
      if (learningFilter === "active" && student.activeSubscriptions === 0) return false;
      if (learningFilter === "inactive" && student.activeSubscriptions > 0) return false;
      if (!term) return true;
      return `${student.displayName} ${student.id} ${student.status} ${student.activePaths.map((path) => path.displayName).join(" ")}`.toLocaleLowerCase("vi").includes(term);
    });
  }, [grid.state.search, learningFilter, rows]);
  const sorted = useMemo(() => {
    const key = grid.state.sortKey ?? "name";
    const direction = grid.state.sortDirection === "desc" ? -1 : 1;
    return [...filtered].sort((left, right) => direction * compareStudents(left, right, key));
  }, [filtered, grid.state.sortDirection, grid.state.sortKey]);
  const pilotFiltered = useMemo(() => applyBoFilterSettings(sorted.map((student) => ({ ...student, ...studentPilotFilterRow(student) })), pilotSettings, BO_STUDENT_PILOT_FIELDS), [sorted, pilotSettings]);
  const range = boDataGridRange(grid.state.page, grid.state.pageSize, pilotFiltered.length);
  const visibleRows = pilotFiltered.slice((range.page - 1) * grid.state.pageSize, range.page * grid.state.pageSize);
  const selectedRow = rows.find((student) => student.id === selectedId) ?? null;
  const columns = useMemo<BoDataGridColumn<BoLearnerDirectoryItem>[]>(() => [
    { key: "name", header: "Học viên", sortable: true, sticky: true, minWidth: 230, render: (student) => <div className={styles.gridIdentity}><span className={styles.avatarSmall}>{initials(student.displayName)}</span><div><strong>{student.displayName}</strong><BoDataGridCanonicalId value={student.id} label="Copy Student ID" /></div></div> },
    { key: "birth", header: "Tuổi / sinh", sortable: true, minWidth: 130, render: (student) => <div className={styles.gridStack}><strong>{ageLabel(student.birthYear)}</strong><small>{student.birthPrecision.replaceAll("_", " ")}</small></div> },
    { key: "paths", header: "Active Paths", sortable: true, minWidth: 210, render: (student) => student.activePaths.length ? <div className={styles.gridPathList}>{student.activePaths.slice(0, 2).map((path) => <BoDataGridBadge key={path.id}>{path.displayName}</BoDataGridBadge>)}{student.activePaths.length > 2 ? <BoDataGridBadge>+{student.activePaths.length - 2}</BoDataGridBadge> : null}</div> : <span className={styles.gridMuted}>Chưa có active Path</span> },
    { key: "learning", header: "Subscription / Class", sortable: true, minWidth: 170, render: (student) => <div className={styles.gridStack}><BoDataGridStatus value={student.activeSubscriptions > 0 ? "Đang học" : "Chưa active"} tone={student.activeSubscriptions > 0 ? "success" : "warning"} /><small>{student.activeSubscriptions > 0 ? `${student.activeSubscriptions} active Path · mở detail để xem class` : "Cần Subscription trước khi xếp lớp"}</small></div> },
    { key: "member", header: "House", sortable: true, minWidth: 115, render: (student) => <BoDataGridStatus value={student.houseMember ? "Member" : "Non-member"} tone={student.houseMember ? "info" : "neutral"} /> },
    { key: "attention", header: "Attention", sortable: true, minWidth: 150, render: (student) => { const attention = studentAttention(student); return <BoDataGridStatus value={attention.label} tone={attention.tone} />; } },
  ], []);

  if (catalog.state === "loading") return <BoDataGridState kind="loading" message="Đang tải canonical scope catalog cho Student detail…" />;
  if (catalog.state === "error") return <BoDataGridState kind="error" message={catalog.message} />;

  return <main className={styles.page}>
    <header className={styles.heading}>
      <div>
        <span>School · Student management</span>
        <h1>Học viên</h1>
        <p>Manager nhìn ngay ai đang học, học chương trình nào, còn bao nhiêu buổi và đang ở lớp nào.</p>
      </div>
      <div className={styles.headingActions}><button type="button" className={styles.primaryButton} onClick={() => { if (selectedId) selectStudent(null); setShowCreate(true); }}>+ Thêm học viên</button><Link className={styles.secondaryButton} href="/bo/running-classes">Mở Classes</Link></div>
    </header>

    <section className={styles.metrics}>
      <Metric label="Tổng hồ sơ" value={rows.length} note="canonical Student" />
      <Metric label="Đang học" value={activeRows.length} note="có active Path" />
      <Metric label="House Member" value={rows.filter((item) => item.houseMember).length} note="membership hiện có" />
      <Metric label="Chưa active" value={rows.filter((item) => item.activeSubscriptions === 0).length} note="chưa có active Path" />
    </section>

    <BoDataGrid
      rows={directory.state === "ready" ? visibleRows : []}
      columns={columns}
      typedFilterSettings={pilotSettings}
      typedFilterFields={BO_STUDENT_PILOT_FIELDS}
      onTypedFilterSettingsChange={setPilotSettings}
      rowKey={(student) => student.id}
      caption="School Students directory"
      state={directory.state === "loading" ? "loading" : directory.state === "error" ? "error" : "ready"}
      stateMessage={directory.state === "error" ? directory.message : undefined}
      search={grid.state.search}
      onSearchChange={grid.setSearch}
      searchPlaceholder="Tìm học viên, chương trình, Student ID…"
      sortKey={grid.state.sortKey ?? "name"}
      sortDirection={grid.state.sortDirection}
      onSortChange={grid.setSort}
      filterChips={learningFilter === "all" ? [] : [{ key: "learning", label: "Learning", value: learningFilter === "active" ? "Đang học" : "Chưa active", onClear: () => grid.setFilter("learning", "all") }]}
      resultLabel={`${pilotFiltered.length} / ${rows.length} học viên`}
      selectedRowKey={selectedId}
      onRowOpen={(student) => selectStudent(student.id, "push")}
      quickViewOpener
      emptyTitle="Không có học viên phù hợp"
      emptyMessage="Thử đổi search hoặc Learning filter; canonical Student directory không bị thay đổi."
      pagination={{ page: range.page, pageSize: grid.state.pageSize, total: pilotFiltered.length, pageSizeOptions: STUDENT_GRID_OPTIONS.allowedPageSizes, onPageChange: grid.setPage, onPageSizeChange: grid.setPageSize }}
      toolbarActions={<label className={styles.gridToolbarFilter}>Learning<select aria-label="Lọc học viên theo trạng thái học" value={learningFilter} onChange={(event) => grid.setFilter("learning", event.target.value)}><option value="active">Đang học</option><option value="inactive">Chưa active</option><option value="all">Tất cả</option></select></label>}
    />
    {selectedId ? <BoDataGridSidePeek title={selectedRow?.displayName ?? "Học viên"} eyebrow="School · Student detail" onClose={() => selectStudent(null)}>
      <div className={styles.peekDetail}><LearnerDetail load={detail} catalog={catalog.data} onNeutralize={setNeutralizeTarget} /></div>
    </BoDataGridSidePeek> : null}
    {showCreate ? <CreateStudentIntake onClose={() => setShowCreate(false)} onCreated={async (studentId) => { setShowCreate(false); await loadDirectory(); selectStudent(studentId); }} /> : null}
    {neutralizeTarget ? <NeutralizeStudentIntake lifecycle={neutralizeTarget} onClose={() => setNeutralizeTarget(null)} onNeutralized={async () => {
      setNeutralizeTarget(null);
      selectStudent(null);
      await loadDirectory();
    }} /> : null}

  </main>;
}

function CreateStudentIntake({ onClose, onCreated }: { onClose: () => void; onCreated: (studentId: string) => Promise<void> }) {
  const [studentName, setStudentName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [parentMode, setParentMode] = useState<"EXISTING" | "NEW">("EXISTING");
  const [parentQuery, setParentQuery] = useState("");
  const [parentOptions, setParentOptions] = useState<Load<BoParentSearchResult[]>>({ state: "loading" });
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [guardianName, setGuardianName] = useState("");
  const [contactType, setContactType] = useState<"PHONE" | "EMAIL">("PHONE");
  const [contactValue, setContactValue] = useState("");
  const [relationshipType, setRelationshipType] = useState<"PARENT" | "GUARDIAN" | "OTHER">("PARENT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState<{ idempotencyKey: string; body: Parameters<typeof boApi.createStudentIntake>[0] } | null>(null);
  const [canResetAttempt, setCanResetAttempt] = useState(false);

  useEffect(() => {
    if (parentMode !== "EXISTING" || attempt) return;
    let active = true;
    const handle = window.setTimeout(() => {
      setParentOptions({ state: "loading" });
      void boApi.parents(parentQuery, 20).then((data) => {
        if (!active) return;
        setParentOptions({ state: "ready", data });
        setSelectedParentId((current) => current && data.some((item) => item.parent.id === current) ? current : null);
      }).catch((cause: unknown) => { if (active) setParentOptions({ state: "error", message: message(cause) }); });
    }, 180);
    return () => { active = false; window.clearTimeout(handle); };
  }, [attempt, parentMode, parentQuery]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const selectedParentReady = parentOptions.state === "ready" && selectedParentId !== null && parentOptions.data.some((item) => item.parent.id === selectedParentId);
    if (!attempt && parentMode === "EXISTING" && !selectedParentReady) {
      setError("Chọn một phụ huynh / guardian từ kết quả tìm kiếm hiện tại trước khi tạo học viên.");
      return;
    }
    setBusy(true); setError(""); setCanResetAttempt(false);
    const currentAttempt = attempt ?? (() => {
      const [year, month, day] = birthDate ? birthDate.split("-").map(Number) : [null, null, null];
      const common = {
        displayName: studentName,
        birthYear: year, birthMonth: month, birthDay: day, birthPrecision: birthDate ? "FULL_DATE" as const : "UNKNOWN" as const,
        relationshipType, effectiveFrom: new Date().toISOString(),
      };
      return {
        idempotencyKey: crypto.randomUUID(),
        body: parentMode === "EXISTING"
          ? { ...common, existingParentUserId: selectedParentId! }
          : { ...common, guardianDisplayName: guardianName.trim() || null, contactType, contactValue },
      };
    })();
    if (!attempt) setAttempt(currentAttempt);
    try {
      const result = await boApi.createStudentIntake(currentAttempt.body, currentAttempt.idempotencyKey);
      await onCreated(result.studentProfileId);
    } catch (cause) {
      setError(message(cause));
      setCanResetAttempt(cause instanceof BoApiError && cause.structuredResponse && cause.status >= 400 && cause.status < 500);
    } finally { setBusy(false); }
  }

  const attemptLocked = attempt !== null;
  const uncertainAttempt = attemptLocked && Boolean(error) && !canResetAttempt;
  const selectedParent = parentOptions.state === "ready" ? parentOptions.data.find((item) => item.parent.id === selectedParentId) ?? null : null;
  function resetAttempt() { setAttempt(null); setCanResetAttempt(false); setError(""); }
  function closeIfSafe() { if (!busy && !uncertainAttempt) onClose(); }
  function switchParentMode(next: "EXISTING" | "NEW") { if (!attemptLocked) { setParentMode(next); setSelectedParentId(null); setError(""); } }

  return <BoDataGridSidePeek title="Thêm học viên" eyebrow="School · Student intake" onClose={closeIfSafe}>
    <form className={styles.intakeDrawerForm} onSubmit={(event) => void submit(event)}>
      <p className={styles.intakeDrawerIntro}>Tạo Student Profile và nối đúng Parent/Guardian trong một canonical command.</p>
      {error ? <div className={styles.formError}>{error}{uncertainAttempt ? <><br /><small>Kết quả chưa xác định. Hãy thử lại cùng yêu cầu để đối soát an toàn.</small></> : null}</div> : null}
      <div className={styles.formGrid}>
        <label className={styles.fullField}>Tên học viên<input required disabled={attemptLocked} value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="Nguyễn Minh Anh" /></label>
        <label>Ngày sinh<input type="date" disabled={attemptLocked} value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label>
        <label>Quan hệ<select disabled={attemptLocked} value={relationshipType} onChange={(event) => setRelationshipType(event.target.value as "PARENT" | "GUARDIAN" | "OTHER")}><option value="PARENT">Cha/Mẹ</option><option value="GUARDIAN">Người giám hộ</option><option value="OTHER">Khác</option></select></label>
      </div>
      <div className={styles.parentModeToggle} aria-label="Cách liên kết phụ huynh">
        <button type="button" className={parentMode === "EXISTING" ? styles.parentModeActive : ""} disabled={attemptLocked} onClick={() => switchParentMode("EXISTING")}>Chọn phụ huynh hiện có</button>
        <button type="button" className={parentMode === "NEW" ? styles.parentModeActive : ""} disabled={attemptLocked} onClick={() => switchParentMode("NEW")}>Tạo phụ huynh mới</button>
      </div>
      {parentMode === "EXISTING" ? <div className={styles.parentPicker}>
        <label>Tìm theo tên, SĐT hoặc email<input disabled={attemptLocked} value={parentQuery} onChange={(event) => { setParentQuery(event.target.value); setSelectedParentId(null); setParentOptions({ state: "loading" }); setError(""); }} placeholder="Nguyễn Văn A · 090… · parent@example.com" /></label>
        <div className={styles.parentOptions} aria-live="polite">
          {parentOptions.state === "loading" ? <span>Đang tìm phụ huynh…</span> : null}
          {parentOptions.state === "error" ? <span className={styles.parentPickerError}>{parentOptions.message}</span> : null}
          {parentOptions.state === "ready" ? parentOptions.data.map((item) => <button key={item.parent.id} type="button" disabled={attemptLocked} className={item.parent.id === selectedParentId ? styles.parentOptionActive : styles.parentOption} onClick={() => { setSelectedParentId(item.parent.id); setError(""); }}><strong>{item.parent.displayName || "Parent chưa đặt tên"}</strong><small>{item.contacts.map((contact) => `${contact.identifierType === "PHONE" ? "SĐT" : "Email"} · ${contact.normalizedValue}`).join(" · ") || "Chưa có contact active"}</small></button>) : null}
          {parentOptions.state === "ready" && parentOptions.data.length === 0 ? <span>Không tìm thấy Parent phù hợp. Chọn “Tạo phụ huynh mới” nếu đây là gia đình mới.</span> : null}
        </div>
        {selectedParent ? <small className={styles.parentSelection}>Đã chọn: <strong>{selectedParent.parent.displayName || selectedParent.parent.id}</strong></small> : null}
      </div> : <div className={styles.formGrid}>
        <label className={styles.fullField}>Tên phụ huynh / guardian<input disabled={attemptLocked} value={guardianName} onChange={(event) => setGuardianName(event.target.value)} placeholder="Nguyễn Văn A" /></label>
        <label>Liên hệ<select disabled={attemptLocked} value={contactType} onChange={(event) => setContactType(event.target.value as "PHONE" | "EMAIL")}><option value="PHONE">Số điện thoại</option><option value="EMAIL">Email</option></select></label>
        <label>Giá trị<input required disabled={attemptLocked} value={contactValue} onChange={(event) => setContactValue(event.target.value)} placeholder={contactType === "PHONE" ? "090…" : "parent@example.com"} /></label>
      </div>}
      <small>{parentMode === "EXISTING" ? "Student mới sẽ nối trực tiếp vào Parent đã chọn; không tạo hoặc sửa contact của Parent." : "Nếu contact canonical đã thuộc Parent hiện có, Core vẫn reuse Parent như safety net; Student không tự merge theo tên/ngày sinh."}</small>
      <footer>{attemptLocked && error && canResetAttempt ? <button type="button" className={styles.secondaryButton} onClick={resetAttempt} disabled={busy}>Sửa dữ liệu</button> : null}<button type="button" className={styles.secondaryButton} onClick={closeIfSafe} disabled={busy || uncertainAttempt}>Hủy</button><button type="submit" className={styles.primaryButton} disabled={busy}>{busy ? "Đang tạo…" : attemptLocked ? "Thử lại cùng yêu cầu" : "Tạo học viên"}</button></footer>
    </form>
  </BoDataGridSidePeek>;
}

function NeutralizeStudentIntake({ lifecycle, onClose, onNeutralized }: { lifecycle: BoLearnerLifecycle; onClose: () => void; onNeutralized: () => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof boApi.voidStudentIntake>> | null>(null);
  const [attempt, setAttempt] = useState<{ idempotencyKey: string; expectedStudentVersion: number; reason: string } | null>(null);
  const [canResetAttempt, setCanResetAttempt] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setCanResetAttempt(false);
    const currentAttempt = attempt ?? { idempotencyKey: crypto.randomUUID(), expectedStudentVersion: lifecycle.student.version, reason: reason.trim() };
    if (!attempt) setAttempt(currentAttempt);
    try {
      const value = await boApi.voidStudentIntake(lifecycle.student.id, { expectedStudentVersion: currentAttempt.expectedStudentVersion, reason: currentAttempt.reason }, currentAttempt.idempotencyKey);
      setResult(value);
    } catch (cause) {
      setError(message(cause));
      setCanResetAttempt(cause instanceof BoApiError && cause.structuredResponse && cause.status >= 400 && cause.status < 500);
    } finally { setBusy(false); }
  }

  const attemptLocked = attempt !== null;
  const uncertainAttempt = attemptLocked && Boolean(error) && !canResetAttempt;
  function resetAttempt() { setAttempt(null); setCanResetAttempt(false); setError(""); }
  function closeIfSafe() { if (busy || uncertainAttempt) return; if (result) { void onNeutralized(); return; } onClose(); }
  const disposition = result?.parentDisposition === "ARCHIVED"
    ? "Parent/contact do intake này tạo riêng đã được lưu trữ an toàn."
    : result?.parentDisposition === "REUSED_UNCHANGED"
      ? "Parent được reuse được giữ nguyên."
      : result ? "Parent/contact còn dependency nên được giữ nguyên." : "";

  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeIfSafe(); }}>
    <form className={styles.modal} onSubmit={(event) => void submit(event)}>
      <header><div><span>School · Student lifecycle</span><h2>Lưu trữ intake</h2><p>{lifecycle.student.displayName}</p></div><button type="button" onClick={closeIfSafe} disabled={busy || uncertainAttempt}>×</button></header>
      {result ? <div className={styles.neutralizeSuccess}><strong>Đã neutralize Student + Guardian.</strong><span>{disposition}</span></div> : <>
        <div className={styles.neutralizeWarning}><strong>Thao tác có kiểm soát</strong><span>Student sẽ chuyển sang ARCHIVED và Guardian của intake sẽ kết thúc. Parent/contact chỉ được lưu trữ nếu chính intake này tạo mới và không còn relationship hoặc dependency đang sống.</span></div>
        {error ? <div className={styles.formError}>{error}{uncertainAttempt ? <><br /><small>Kết quả chưa xác định. Hãy thử lại cùng yêu cầu để đối soát an toàn.</small></> : null}</div> : null}
        <label className={styles.reasonField}>Lý do<input required minLength={3} disabled={attemptLocked} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Intake tạo nhầm trong vận hành" /></label>
      </>}
      <footer>
        {result ? <button type="button" className={styles.primaryButton} onClick={() => void onNeutralized()}>Đóng & Clean Verify</button> : <>
          {attemptLocked && error && canResetAttempt ? <button type="button" className={styles.secondaryButton} onClick={resetAttempt} disabled={busy}>Sửa lý do / tải lại</button> : null}
          <button type="button" className={styles.secondaryButton} onClick={closeIfSafe} disabled={busy || uncertainAttempt}>Hủy</button>
          <button type="submit" className={styles.dangerButton} disabled={busy || !reason.trim()}>{busy ? "Đang lưu trữ…" : attemptLocked ? "Thử lại cùng yêu cầu" : "Xác nhận lưu trữ"}</button>
        </>}
      </footer>
    </form>
  </div>;
}

function Metric({ label, value, note }: { label: string; value: number; note: string }) {
  return <article className={styles.metric}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function LearnerDetail({ load, catalog, onNeutralize }: { load: Load<BoLearnerLifecycle> | null; catalog: Catalog; onNeutralize: (lifecycle: BoLearnerLifecycle) => void }) {
  if (!load || load.state === "loading") return <State text="Đang tải lifecycle…" />;
  if (load.state === "error") return <State text={load.message} error />;
  const data = load.data;
  const active = data.subscriptions.filter((entry) => entry.subscription.lifecycle === "ACTIVE");
  const units = active.reduce((sum, entry) => sum + entry.subscription.effectiveAvailableUnits, 0);
  return <>
    <StudentHero lifecycle={data} activeCount={active.length} onNeutralize={() => onNeutralize(data)} />
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

function StudentHero({ lifecycle, activeCount, onNeutralize }: { lifecycle: BoLearnerLifecycle; activeCount: number; onNeutralize: () => void }) {
  const student = lifecycle.student;
  return <section className={styles.heroCard}>
    <div className={styles.heroIdentity}>
      <span className={styles.avatarLarge}>{initials(student.displayName)}</span>
      <div><span className={styles.eyebrow}>Student profile</span><h2>{student.displayName}</h2><p>{ageLabel(student.birthYear)}</p></div>
    </div>
    <div className={styles.heroActions}><Link className={styles.secondaryButton} href={`/bo/subscriptions?studentId=${encodeURIComponent(student.id)}`}>Mở Subscription</Link><Link className={styles.secondaryButton} href="/bo/running-classes">Mở Classes</Link><button type="button" className={styles.dangerButton} onClick={onNeutralize}>Lưu trữ intake</button></div>
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

function compareStudents(left: BoLearnerDirectoryItem, right: BoLearnerDirectoryItem, key: string) {
  if (key === "birth") return (left.birthYear ?? 0) - (right.birthYear ?? 0) || left.displayName.localeCompare(right.displayName, "vi");
  if (key === "paths") return left.activePaths.map((path) => path.displayName).join(" ").localeCompare(right.activePaths.map((path) => path.displayName).join(" "), "vi") || left.displayName.localeCompare(right.displayName, "vi");
  if (key === "learning") return left.activeSubscriptions - right.activeSubscriptions || left.displayName.localeCompare(right.displayName, "vi");
  if (key === "member") return Number(left.houseMember) - Number(right.houseMember) || left.displayName.localeCompare(right.displayName, "vi");
  if (key === "attention") return attentionRank(left) - attentionRank(right) || left.displayName.localeCompare(right.displayName, "vi");
  return left.displayName.localeCompare(right.displayName, "vi");
}
function attentionRank(student: BoLearnerDirectoryItem) {
  if (student.status !== "ACTIVE") return 3;
  if (student.activeSubscriptions === 0) return 2;
  if (student.activePaths.length === 0) return 1;
  return 0;
}
function studentAttention(student: BoLearnerDirectoryItem): { label: string; tone: "success" | "warning" | "danger" } {
  if (student.status !== "ACTIVE") return { label: student.status, tone: "danger" };
  if (student.activeSubscriptions === 0) return { label: "Cần setup", tone: "warning" };
  if (student.activePaths.length === 0) return { label: "Thiếu Path", tone: "warning" };
  return { label: "Ổn", tone: "success" };
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
