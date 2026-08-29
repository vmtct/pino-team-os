"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import { attendanceReadinessCounts, attendanceReadinessState, buildUnassignedOwnerGroups, type BoLearningOwnerBulkGroup } from "@/lib/bo-learning-owner-bulk";
import type { BoPathProgram, BoRegistration, BoRunningClass, BoSession, BoSessionLearningOwner, BoStaffRecord, BoSyllabus } from "@/lib/bo-model";
import styles from "./bo.module.css";

export type BoView = "overview" | "running-classes" | "sessions" | "registrations" | "syllabus";

interface Data {
  paths: BoPathProgram[];
  classes: BoRunningClass[];
  syllabi: BoSyllabus[];
  sessions: BoSession[];
}

type LoadState = { status: "loading" } | { status: "error"; message: string; requestId: string | null } | { status: "ready"; data: Data };

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function BoOperationalView({ view }: { view: BoView }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    void Promise.all([boApi.pathPrograms(), boApi.runningClasses(), boApi.syllabi(), boApi.sessions()])
      .then(([paths, classes, syllabi, sessions]) => {
        if (active) setState({ status: "ready", data: { paths, classes, syllabi, sessions } });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Back Office data could not be loaded.",
          requestId: error instanceof BoApiError ? error.requestId : null,
        });
      });
    return () => { active = false; };
  }, []);

  if (state.status === "loading") return <Loading />;
  if (state.status === "error") return <ErrorState message={state.message} requestId={state.requestId} />;
  if (view === "overview") return <Overview data={state.data} />;
  if (view === "running-classes") return <RunningClasses data={state.data} />;
  if (view === "sessions") return <Sessions data={state.data} />;
  if (view === "registrations") return <Registrations data={state.data} />;
  return <SyllabusPrograms data={state.data} />;
}

function Overview({ data }: { data: Data }) {
  const upcoming = data.sessions.slice(0, 8);
  return (
    <Page title="Operational overview" subtitle="Canonical Catalog and Delivery state, read directly through the private BO contract.">
      <div className={styles.metrics}>
        <Metric label="Path programs" value={data.paths.length} />
        <Metric label="Running classes" value={data.classes.length} />
        <Metric label="Upcoming sessions" value={data.sessions.length} />
        <Metric label="Registrations" value={data.sessions.reduce((sum, session) => sum + session.registrationCount, 0)} />
      </div>
      <Panel title="Next sessions" hint="PINO local time · canonical IDs retained">
        {upcoming.length ? <SessionTable sessions={upcoming} data={data} /> : <Empty text="No upcoming sessions." />}
      </Panel>
    </Page>
  );
}

function RunningClasses({ data }: { data: Data }) {
  return (
    <Page title="Running Classes" subtitle="Recurring operational schedule masters from Core.">
      <Panel title={`${data.classes.length} classes`} hint="Schedule intent; dated Session times remain immutable snapshots.">
        {data.classes.length ? (
          <Table headers={["Class", "Program", "Pattern", "Capacity", "Status", "Canonical ID"]}>
            {data.classes.map((item) => (
              <tr key={item.id}>
                <th scope="row">{item.name}</th>
                <td>{pathName(data.paths, item.pathProgramId)}</td>
                <td>{item.recurrenceWeekdays.map((day) => weekdays[day]).join(", ")} · {item.startLocalTime}–{item.endLocalTime}</td>
                <td>{item.defaultCapacity}</td>
                <td><Status value={item.status} /></td>
                <td><Id value={item.id} /></td>
              </tr>
            ))}
          </Table>
        ) : <Empty text="No Running Classes." />}
      </Panel>
    </Page>
  );
}

function Sessions({ data }: { data: Data }) {
  const [staff, setStaff] = useState<BoStaffRecord[]>([]);
  const [owners, setOwners] = useState<Record<string, BoSessionLearningOwner | null>>({});
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [loadingOwners, setLoadingOwners] = useState(true);
  const [ownerLoadError, setOwnerLoadError] = useState("");
  const [savingSessionId, setSavingSessionId] = useState<string | null>(null);
  const [bulkSelections, setBulkSelections] = useState<Record<string, string>>({});
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    setLoadingOwners(true);
    setOwnerLoadError("");
    void Promise.all([
      boApi.staffRecords(),
      Promise.all(data.sessions.map(async (session) => [session.id, (await boApi.learningOwner(session.id)).owner] as const)),
    ]).then(([staffRows, ownerPairs]) => {
      if (!active) return;
      const activeStaff = staffRows.filter((item) => item.status === "active");
      const ownerMap = Object.fromEntries(ownerPairs) as Record<string, BoSessionLearningOwner | null>;
      setStaff(activeStaff);
      setOwners(ownerMap);
      setSelections(Object.fromEntries(data.sessions.map((session) => [session.id, ownerMap[session.id]?.staffMemberId ?? ""])));
      setLoadingOwners(false);
    }).catch((error: unknown) => {
      if (!active) return;
      setOwnerLoadError(error instanceof Error ? error.message : "Learning Owner readiness could not be loaded.");
      setLoadingOwners(false);
    });
    return () => { active = false; };
  }, [data.sessions]);

  const orderedSessions = useMemo(() => [...data.sessions].sort((left, right) => {
    const ownerDelta = Number(Boolean(owners[left.id])) - Number(Boolean(owners[right.id]));
    return ownerDelta || left.startsAt.localeCompare(right.startsAt);
  }), [data.sessions, owners]);
  const unassignedCount = data.sessions.filter((session) => !owners[session.id]).length;
  const ownerGroups = useMemo(() => buildUnassignedOwnerGroups(data.sessions, owners), [data.sessions, owners]);
  const readinessCounts = useMemo(() => attendanceReadinessCounts(data.sessions, owners), [data.sessions, owners]);

  async function assignGroup(group: BoLearningOwnerBulkGroup) {
    const selected = bulkSelections[group.key] ?? "";
    if (!selected || !group.sessionIds.length) return;
    const first = data.sessions.find((item) => item.id === group.sessionIds[0]);
    const label = group.runningClassId ? className(data.classes, group.runningClassId) : first ? sessionLabel(first, data) : "Session";
    if (!confirm(`Gán ${selectedStaffLabel(staff, selected)} làm Learning Owner cho ${group.sessionIds.length} Session chưa được gán của ${label}?`)) return;
    setBulkBusy(group.key);
    setBulkStatus((value) => ({ ...value, [group.key]: "" }));
    const successes: Record<string, BoSessionLearningOwner> = {};
    const failures: Record<string, string> = {};
    for (const sessionId of group.sessionIds) {
      try { successes[sessionId] = await boApi.assignLearningOwner(sessionId, { staffMemberId: selected, reason: "Assigned from BO Running Class bulk queue" }, `learning-owner-bulk:${group.key}:${sessionId}:${selected}:${crypto.randomUUID()}`); }
      catch (error) { failures[sessionId] = error instanceof Error ? error.message : "Learning Owner could not be saved."; }
    }
    setOwners((value) => ({ ...value, ...successes }));
    setSelections((value) => ({ ...value, ...Object.fromEntries(Object.keys(successes).map((sessionId) => [sessionId, selected])) }));
    const cleared = Object.fromEntries(Object.keys(successes).map((sessionId) => [sessionId, ""]));
    setRowErrors((value) => ({ ...value, ...cleared, ...failures }));
    const failed = Object.keys(failures).length;
    setBulkStatus((value) => ({ ...value, [group.key]: failed ? `${Object.keys(successes).length}/${group.sessionIds.length} đã gán · ${failed} Session cần xử lý riêng` : `${group.sessionIds.length} Session đã được gán` }));
    setBulkBusy(null);
  }

  async function saveOwner(session: BoSession) {
    const selected = selections[session.id] ?? "";
    const current = owners[session.id] ?? null;
    const reason = (reasons[session.id] ?? "").trim();
    const changing = Boolean(current && current.staffMemberId !== selected);
    if (!selected) return;
    if (changing && !reason) {
      setRowErrors((value) => ({ ...value, [session.id]: "Handoff reason is required when changing Learning Owner." }));
      return;
    }
    setSavingSessionId(session.id);
    setRowErrors((value) => ({ ...value, [session.id]: "" }));
    try {
      const next = await boApi.assignLearningOwner(session.id, {
        staffMemberId: selected,
        ...(current ? { expectedVersion: current.version } : {}),
        reason: changing ? reason : "Assigned from BO Session queue",
      }, `learning-owner:${session.id}:${selected}:${current?.version ?? 0}:${crypto.randomUUID()}`);
      setOwners((value) => ({ ...value, [session.id]: next }));
      setReasons((value) => ({ ...value, [session.id]: "" }));
    } catch (error) {
      setRowErrors((value) => ({ ...value, [session.id]: error instanceof Error ? error.message : "Learning Owner could not be saved." }));
    } finally {
      setSavingSessionId(null);
    }
  }

  return (
    <Page title="Sessions" subtitle="Dated occurrences with capacity, linked curriculum, and Learning Owner readiness.">
      <Panel title={`Attendance unlock · ${readinessCounts.needsOwnerOnly} chỉ thiếu Owner`} hint={`${readinessCounts.presentReady} ready · ${readinessCounts.needsSyllabus} blocked bởi Syllabus · ${unassignedCount} Session chưa có owner tổng cộng.`} mode="write">
        {loadingOwners ? <Loading compact /> : ownerLoadError ? <ErrorState message={ownerLoadError} requestId={null} compact /> : !staff.length ? <Empty text="No active StaffMember is available for Learning Owner assignment." /> : (
          <div className={styles.ownerQueue}>
            {ownerGroups.length ? <section className={styles.ownerBulk}><div className={styles.ownerBulkHead}><div><strong>Gán nhanh để mở Attendance</strong><small>Chỉ gồm Session có primary Syllabus và chưa có owner; Syllabus-blocked Session không xuất hiện ở đây.</small></div></div>{ownerGroups.map((group) => { const label = group.runningClassId ? className(data.classes, group.runningClassId) : "Session độc lập"; const selected = bulkSelections[group.key] ?? ""; return <div className={styles.ownerBulkRow} key={group.key}><div><strong>{label}</strong><small>{pathName(data.paths, group.pathProgramId)} · {group.sessionIds.length} Session chưa gán</small></div><label className={styles.field}>Learning Owner<select value={selected} onChange={(event) => setBulkSelections((value) => ({ ...value, [group.key]: event.target.value }))}><option value="">Chọn owner…</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.displayLabel}{item.roleLabel ? ` · ${item.roleLabel}` : ""}</option>)}</select></label><button className={styles.secondaryButton} disabled={!selected || bulkBusy === group.key} onClick={() => void assignGroup(group)}>{bulkBusy === group.key ? "Đang gán…" : `Gán ${group.sessionIds.length} Session`}</button>{bulkStatus[group.key] ? <small className={styles.ownerBulkStatus}>{bulkStatus[group.key]}</small> : null}</div>; })}</section> : null}
            {orderedSessions.map((session) => {
              const current = owners[session.id] ?? null;
              const selected = selections[session.id] ?? "";
              const changing = Boolean(current && current.staffMemberId !== selected);
              const currentStaff = current ? staff.find((item) => item.id === current.staffMemberId) : null;
              const readiness = attendanceReadinessState(session, current);
              const disabled = !selected || savingSessionId === session.id || selected === current?.staffMemberId || (changing && !(reasons[session.id] ?? "").trim());
              return (
                <article className={styles.ownerRow} key={session.id}>
                  <div className={styles.ownerMeta}>
                    <strong>{sessionLabel(session, data)}</strong>
                    <span>{pathName(data.paths, session.pathProgramId)} · {syllabusName(data.syllabi, session.syllabusId)}</span>
                    <small>{current ? `Owner: ${currentStaff?.displayLabel ?? current.staffMemberId} · v${current.version}` : "Owner chưa được gán"}</small>
                    <small className={styles.ownerReadiness}>{readiness === "PRESENT_READY" ? "Attendance PRESENT ready" : readiness === "NEEDS_OWNER" ? "Attendance PRESENT · chỉ còn thiếu Learning Owner" : readiness === "NEEDS_SYLLABUS" ? "Attendance PRESENT blocked · thiếu primary Syllabus" : "Ngoài upcoming Attendance scope"}</small>
                  </div>
                  <div className={styles.ownerControls}>
                    <label className={styles.field}>Learning Owner
                      <select value={selected} onChange={(event) => setSelections((value) => ({ ...value, [session.id]: event.target.value }))}>
                        {staff.map((item) => <option key={item.id} value={item.id}>{item.displayLabel}{item.roleLabel ? ` · ${item.roleLabel}` : ""}</option>)}
                      </select>
                    </label>
                    {changing ? <label className={styles.field}>Handoff reason<input value={reasons[session.id] ?? ""} onChange={(event) => setReasons((value) => ({ ...value, [session.id]: event.target.value }))} placeholder="Why is ownership changing?" /></label> : null}
                    <button className={styles.primaryButton} disabled={disabled} onClick={() => void saveOwner(session)}>{savingSessionId === session.id ? "Saving…" : current ? "Change owner" : "Assign owner"}</button>
                  </div>
                  {rowErrors[session.id] ? <p className={styles.ownerError}>{rowErrors[session.id]}</p> : null}
                </article>
              );
            })}
          </div>
        )}
      </Panel>
      <Panel title={`${data.sessions.length} upcoming sessions`} hint="Availability is the canonical Core projection.">
        {data.sessions.length ? <SessionTable sessions={data.sessions} data={data} /> : <Empty text="No upcoming sessions." />}
      </Panel>
    </Page>
  );
}

function Registrations({ data }: { data: Data }) {
  const [sessionId, setSessionId] = useState(data.sessions[0]?.id ?? "");
  const [state, setState] = useState<{ loading: boolean; rows: BoRegistration[]; error: string }>({ loading: false, rows: [], error: "" });

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    setState({ loading: true, rows: [], error: "" });
    void boApi.registrations(sessionId)
      .then((rows) => { if (active) setState({ loading: false, rows, error: "" }); })
      .catch((error: unknown) => { if (active) setState({ loading: false, rows: [], error: error instanceof Error ? error.message : "Registrations could not be loaded." }); });
    return () => { active = false; };
  }, [sessionId]);

  return (
    <Page title="Registrations" subtitle="Read-only public registration queue, filtered by canonical Session.">
      <Panel title="Session registrations" hint="Contact data remains inside the Founder-only BO boundary.">
        {data.sessions.length ? (
          <>
            <label className={styles.filterLabel}>Session
              <select value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
                {data.sessions.map((session) => <option value={session.id} key={session.id}>{sessionLabel(session, data)}</option>)}
              </select>
            </label>
            {state.loading ? <Loading compact /> : state.error ? <ErrorState message={state.error} requestId={null} compact /> : state.rows.length ? (
              <Table headers={["Learner", "Contact", "Submitted", "Status", "Canonical ID"]}>
                {state.rows.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">{item.childName}</th>
                    <td>{item.contactName}<small>{item.contactEmail ?? item.contactPhone}</small></td>
                    <td>{dateTime(item.createdAt)}</td>
                    <td><Status value={item.status} /></td>
                    <td><Id value={item.id} /></td>
                  </tr>
                ))}
              </Table>
            ) : <Empty text="No registrations for this Session." />}
          </>
        ) : <Empty text="No Sessions are available for registration review." />}
      </Panel>
    </Page>
  );
}

function SyllabusPrograms({ data }: { data: Data }) {
  const grouped = useMemo(() => data.paths.map((path) => ({ path, syllabi: data.syllabi.filter((item) => item.pathProgramId === path.id) })), [data]);
  return (
    <Page title="Syllabus / Programs" subtitle="Canonical curriculum structure and publication state.">
      {grouped.length ? grouped.map(({ path, syllabi }) => (
        <Panel key={path.id} title={path.displayName} hint={`${path.code} · ${path.status} · ${path.id}`}>
          {syllabi.length ? (
            <Table headers={["Week", "Syllabus", "Age", "Publication", "Canonical ID"]}>
              {syllabi.map((item) => (
                <tr key={item.id}>
                  <td>{item.curriculumWeek}</td>
                  <th scope="row">{item.title}<small>{item.shortDescription ?? item.skillSummary ?? "No summary"}</small></th>
                  <td>{ageRange(item)}</td>
                  <td><Status value={item.publicationStatus} /></td>
                  <td><Id value={item.id} /></td>
                </tr>
              ))}
            </Table>
          ) : <Empty text="No Syllabi for this Path Program." />}
        </Panel>
      )) : <Empty text="No Path Programs." />}
    </Page>
  );
}

function SessionTable({ sessions, data }: { sessions: BoSession[]; data: Data }) {
  return (
    <Table headers={["When", "Class / Program", "Syllabus", "Capacity", "Registrations", "Status", "Canonical ID"]}>
      {sessions.map((session) => (
        <tr key={session.id}>
          <td>{dateTime(session.startsAt)}<small>{session.localDate ?? ""}</small></td>
          <th scope="row">{className(data.classes, session.runningClassId)}<small>{pathName(data.paths, session.pathProgramId)}</small></th>
          <td>{syllabusName(data.syllabi, session.syllabusId)}</td>
          <td>{session.availability.remainingSeats}/{session.availability.capacity} open</td>
          <td>{session.registrationCount}</td>
          <td><Status value={session.status} /></td>
          <td><Id value={session.id} /></td>
        </tr>
      ))}
    </Table>
  );
}

function Page({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <section className={styles.page}><header className={styles.heading}><span>PINO TEAM · BACK OFFICE</span><h1>{title}</h1><p>{subtitle}</p></header>{children}</section>;
}
function Panel({ title, hint, children, mode = "read" }: { title: string; hint: string; children: ReactNode; mode?: "read" | "write" }) {
  return <section className={styles.panel}><div className={styles.panelHeading}><div><h2>{title}</h2><p>{hint}</p></div><span className={mode === "write" ? styles.writePill : styles.readOnly}>{mode === "write" ? "Controlled write" : "Read only"}</span></div>{children}</section>;
}
function Metric({ label, value }: { label: string; value: number }) { return <article className={styles.metric}><span>{label}</span><strong>{value}</strong></article>; }
function Table({ headers, children }: { headers: string[]; children: ReactNode }) { return <div className={styles.tableWrap}><table><thead><tr>{headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function Loading({ compact = false }: { compact?: boolean }) { return <div className={`${styles.state} ${compact ? styles.compactState : ""}`} aria-busy="true"><strong>Loading canonical data…</strong><span>Core is resolving the current BO projection.</span></div>; }
function ErrorState({ message, requestId, compact = false }: { message: string; requestId: string | null; compact?: boolean }) { return <div className={`${styles.state} ${styles.errorState} ${compact ? styles.compactState : ""}`} role="alert"><strong>Unable to load this BO view</strong><span>{message}</span>{requestId ? <Id value={`Request ${requestId}`} /> : null}</div>; }
function Empty({ text }: { text: string }) { return <div className={styles.empty}>{text}</div>; }
function Status({ value }: { value: string }) { return <span className={styles.statusPill}>{value.replaceAll("_", " ")}</span>; }
function Id({ value }: { value: string }) { return <code className={styles.id}>{value}</code>; }
function pathName(paths: BoPathProgram[], id: string | null) { return paths.find((item) => item.id === id)?.displayName ?? "Unlinked Path"; }
function className(classes: BoRunningClass[], id: string | null) { return classes.find((item) => item.id === id)?.name ?? "Unlinked class"; }
function syllabusName(syllabi: BoSyllabus[], id: string | null) { return syllabi.find((item) => item.id === id)?.title ?? "Unlinked syllabus"; }
function dateTime(value: string) { return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function sessionLabel(session: BoSession, data: Data) { return `${dateTime(session.startsAt)} · ${className(data.classes, session.runningClassId)}`; }
function selectedStaffLabel(staff: BoStaffRecord[], id: string) { return staff.find((item) => item.id === id)?.displayLabel ?? "StaffMember đã chọn"; }
function ageRange(item: BoSyllabus) { if (item.ageMin === null && item.ageMax === null) return "—"; return `${item.ageMin ?? "?"}–${item.ageMax ?? "?"}`; }
