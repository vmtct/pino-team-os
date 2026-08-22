"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoPathProgram, BoRegistration, BoRunningClass, BoSession, BoSyllabus } from "@/lib/bo-model";
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
  return (
    <Page title="Sessions" subtitle="Dated occurrences with capacity, linked curriculum, and registration volume.">
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
function Panel({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return <section className={styles.panel}><div className={styles.panelHeading}><div><h2>{title}</h2><p>{hint}</p></div><span className={styles.readOnly}>Read only</span></div>{children}</section>;
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
function ageRange(item: BoSyllabus) { if (item.ageMin === null && item.ageMax === null) return "—"; return `${item.ageMin ?? "?"}–${item.ageMax ?? "?"}`; }
