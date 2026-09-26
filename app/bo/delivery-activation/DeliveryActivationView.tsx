"use client";

import { useEffect, useMemo, useState } from "react";
import { BoApiError } from "@/lib/bo-api";
import { f3DeliveryApi, type DeliveryStatus, type DeliveryTopology, type F3BootstrapState, type F3LearningSpace, type F3RunningClass, type F3Term, type F3TermWeek } from "@/lib/f3-delivery-api";
import { applyReviewedF3Seed } from "@/lib/f3-reviewed-seed";
import { activateReviewedEnrollments } from "@/lib/f4-enrollment-api";
import styles from "../bo.module.css";

type LoadState = { status: "loading" } | { status: "error"; message: string; requestId: string | null } | { status: "ready"; data: F3BootstrapState };
type ActionState = { status: "idle" } | { status: "running"; label: string } | { status: "success"; message: string } | { status: "error"; message: string; requestId: string | null };

const weekdayNames = ["", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];

export function DeliveryActivationView() {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [action, setAction] = useState<ActionState>({ status: "idle" });
  const [centerId, setCenterId] = useState("");
  const [spaceCode, setSpaceCode] = useState("");
  const [spaceName, setSpaceName] = useState("");
  const [spaceOptimal, setSpaceOptimal] = useState("");
  const [spaceHard, setSpaceHard] = useState("");
  const [classPathId, setClassPathId] = useState("");
  const [classSpaceId, setClassSpaceId] = useState("");
  const [className, setClassName] = useState("");
  const [weekdayIso, setWeekdayIso] = useState("1");
  const [startsLocal, setStartsLocal] = useState("");
  const [endsLocal, setEndsLocal] = useState("");
  const [topology, setTopology] = useState<DeliveryTopology>("FIXED_COHORT");
  const [participationMinutes, setParticipationMinutes] = useState("");
  const [classOptimal, setClassOptimal] = useState("");
  const [classHard, setClassHard] = useState("");
  const [blockClassId, setBlockClassId] = useState("");
  const [blockKind, setBlockKind] = useState<"LEARNING" | "BRIDGE" | "TRANSITION">("LEARNING");
  const [blockStart, setBlockStart] = useState("0");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockLabel, setBlockLabel] = useState("");
  const [termId, setTermId] = useState("");
  const [termCode, setTermCode] = useState("");
  const [termName, setTermName] = useState("");
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState("");
  const [termWeekCode, setTermWeekCode] = useState("");
  const [termWeekOrdinal, setTermWeekOrdinal] = useState("");
  const [termWeekStart, setTermWeekStart] = useState("");
  const [termWeekEnd, setTermWeekEnd] = useState("");
  const [termWeekRhythm, setTermWeekRhythm] = useState("");
  const [editingTermWeekId, setEditingTermWeekId] = useState<string | null>(null);
  const [horizonDays, setHorizonDays] = useState("");
  const [materializeStart, setMaterializeStart] = useState("");

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    try {
      const data = await f3DeliveryApi.bootstrap();
      setLoad({ status: "ready", data });
      setCenterId((current) => current || (data.centers.length === 1 ? data.centers[0]!.id : ""));
    } catch (error) {
      setLoad({ status: "error", message: error instanceof Error ? error.message : "Delivery state could not be loaded.", requestId: error instanceof BoApiError ? error.requestId : null });
    }
  }

  if (load.status === "loading") return <State title="Loading delivery activation…" message="Reading canonical production delivery state." />;
  if (load.status === "error") return <State error title="Unable to load delivery activation" message={load.message} requestId={load.requestId} />;

  const data = load.data;
  const center = data.centers.find((item) => item.id === centerId) ?? null;
  const spaces = data.learningSpaces.filter((item) => item.centerId === centerId);
  const activeSpaces = data.activeLearningSpaces.filter((item) => item.centerId === centerId);
  const neutralizedSpaces = spaces.filter((item) => item.status !== "ACTIVE");
  const classes = data.runningClasses.filter((item) => item.centerId === centerId);
  const activeClasses = data.activeRunningClasses.filter((item) => item.centerId === centerId);
  const neutralizedClasses = classes.filter((item) => item.status !== "ACTIVE");
  const classIdsWithBlocks = new Set(data.runningClassBlocks.map((item) => item.runningClassId));
  const classesMissingBlocks = activeClasses.filter((item) => item.deliveryTopology !== "FLEXIBLE_STUDIO" && !classIdsWithBlocks.has(item.id));
  const centerPolicy = data.materializationPolicyStreams.find((item) => item.targetType === "CENTER" && item.targetId === centerId) ?? null;
  const globalPolicy = data.materializationPolicyStreams.find((item) => item.targetType === "GLOBAL") ?? null;
  const effectivePolicy = centerPolicy?.publishedValue ?? globalPolicy?.publishedValue ?? null;
  const currentTerm = center ? currentTermForCenter(data, centerId, center.timeZone) : null;
  const centerTerms = data.terms.filter((term) => term.centerId === centerId);
  const selectedTerm = centerTerms.find((term) => term.id === termId) ?? currentTerm ?? centerTerms[0] ?? null;
  const selectedTermWeeks = selectedTerm ? data.termWeeks.filter((week) => week.termId === selectedTerm.id).sort((left, right) => left.ordinal - right.ordinal) : [];
  const canMaterialize = Boolean(centerId && activeClasses.length > 0 && classesMissingBlocks.length === 0 && effectivePolicy && materializeStart && action.status !== "running");

  async function run(label: string, work: () => Promise<string>) {
    if (action.status === "running") return;
    setAction({ status: "running", label });
    try {
      const message = await work();
      await refresh();
      setAction({ status: "success", message });
    } catch (error) {
      setAction({ status: "error", message: error instanceof Error ? error.message : `${label} failed.`, requestId: error instanceof BoApiError ? error.requestId : null });
    }
  }

  function createSpace() {
    const optimal = positive(spaceOptimal), hard = optionalPositive(spaceHard);
    if (!centerId || !spaceCode.trim() || !spaceName.trim() || optimal === null || hard === undefined) return;
    void run("Creating Learning Space", async () => {
      const created = await f3DeliveryApi.createLearningSpace({ centerId, code: spaceCode.trim(), displayName: spaceName.trim(), optimalConcurrentCapacity: optimal, hardConcurrentCapacity: hard, status: "ACTIVE" });
      setSpaceCode(""); setSpaceName(""); setSpaceOptimal(""); setSpaceHard("");
      return `Learning Space committed: ${created.displayName}`;
    });
  }

  function createClass() {
    const optimal = positive(classOptimal), hard = optionalPositive(classHard), minutes = optionalPositive(participationMinutes);
    if (!centerId || !classPathId || !classSpaceId || !className.trim() || !startsLocal || !endsLocal || optimal === null || hard === undefined || minutes === undefined) return;
    void run("Creating Running Class", async () => {
      const created = await f3DeliveryApi.createRunningClass({
        centerId, pathProgramId: classPathId, learningSpaceId: classSpaceId, operationalName: className.trim(), weekdayIso: Number(weekdayIso),
        windowStartsLocal: startsLocal, windowEndsLocal: endsLocal, deliveryTopology: topology,
        defaultParticipationMinutes: minutes, optimalConcurrentCapacity: optimal, hardConcurrentCapacity: hard, status: "ACTIVE",
      });
      setClassName(""); setStartsLocal(""); setEndsLocal(""); setParticipationMinutes(""); setClassOptimal(""); setClassHard("");
      setBlockClassId(created.id);
      return created.deliveryTopology === "FLEXIBLE_STUDIO" ? `Running Class committed: ${created.operationalName}. Flexible Studio placements carry learner intervals; class blocks are optional.` : `Running Class committed: ${created.operationalName}. Add its real block structure before materialization.`;
    });
  }

  function createBlock() {
    const start = nonNegative(blockStart), end = positive(blockEnd);
    if (!blockClassId || start === null || end === null || end <= start) return;
    void run("Creating Running Class block", async () => {
      const created = await f3DeliveryApi.createRunningClassBlock({ runningClassId: blockClassId, blockKind, startsOffsetMinutes: start, endsOffsetMinutes: end, label: blockLabel.trim() || null });
      setBlockStart("0"); setBlockEnd(""); setBlockLabel("");
      return `${created.blockKind} block committed for Running Class.`;
    });
  }

  function createTerm() {
    if (!centerId || !termCode.trim() || !termName.trim() || !termStart || !termEnd) return;
    void run("Creating Term", async () => {
      const created = await f3DeliveryApi.createTerm({ centerId, code: termCode.trim(), displayName: termName.trim(), startDate: termStart, endDate: termEnd });
      setTermId(created.id);
      setTermCode(""); setTermName(""); setTermStart(""); setTermEnd("");
      return `Term committed: ${created.displayName} · ${created.startDate} → ${created.endDate}`;
    });
  }

  function resetTermWeekForm() {
    setEditingTermWeekId(null);
    setTermWeekCode(""); setTermWeekOrdinal(""); setTermWeekStart(""); setTermWeekEnd(""); setTermWeekRhythm("");
  }

  function prefillNextTermWeek() {
    if (!selectedTerm) return;
    const draft = nextTermWeekIdentityDraft(selectedTermWeeks);
    setEditingTermWeekId(null);
    setTermId(selectedTerm.id);
    setTermWeekCode(draft.code);
    setTermWeekOrdinal(String(draft.ordinal));
  }

  function startEditTermWeek(week: F3TermWeek) {
    setEditingTermWeekId(week.id);
    setTermWeekCode(week.code);
    setTermWeekOrdinal(String(week.ordinal));
    setTermWeekStart(week.startDate);
    setTermWeekEnd(week.endDate);
    setTermWeekRhythm(week.rhythmKey);
  }

  function saveTermWeek() {
    const ordinal = positive(termWeekOrdinal);
    const rhythmKey = termWeekRhythm.trim().toUpperCase();
    if (!centerId || !selectedTerm || !termWeekCode.trim() || ordinal === null || !termWeekStart || !termWeekEnd || !rhythmKey) return;
    const editing = editingTermWeekId ? selectedTermWeeks.find((week) => week.id === editingTermWeekId) ?? null : null;
    void run(editing ? "Updating TermWeek" : "Creating TermWeek", async () => {
      const saved = editing
        ? await f3DeliveryApi.updateTermWeek(editing.id, { centerId, expectedUpdatedAt: editing.updatedAt, code: termWeekCode.trim(), ordinal, startDate: termWeekStart, endDate: termWeekEnd, rhythmKey })
        : await f3DeliveryApi.createTermWeek({ centerId, termId: selectedTerm.id, code: termWeekCode.trim(), ordinal, startDate: termWeekStart, endDate: termWeekEnd, rhythmKey });
      resetTermWeekForm();
      return `TermWeek ${editing ? "updated" : "committed"}: ${saved.code} · ${saved.startDate} → ${saved.endDate} · ${saved.rhythmKey}`;
    });
  }

  function deleteTermWeek(week: F3TermWeek) {
    if (!centerId || !window.confirm(`Delete TermWeek ${week.code}? This is blocked if operational data already references it.`)) return;
    void run("Deleting TermWeek", async () => {
      await f3DeliveryApi.deleteTermWeek(week.id, { centerId, expectedUpdatedAt: week.updatedAt });
      if (editingTermWeekId === week.id) resetTermWeekForm();
      return `TermWeek deleted: ${week.code}`;
    });
  }

  function neutralizeTerm(term: F3Term) {
    if (!centerId || term.weekCount !== 0 || !window.confirm(`Neutralize Term ${term.displayName}? This succeeds only when no TermWeek or operational reference remains.`)) return;
    void run("Neutralizing Term", async () => {
      await f3DeliveryApi.neutralizeTerm(term.id, { centerId, expectedUpdatedAt: term.updatedAt });
      if (termId === term.id) setTermId("");
      return `Term neutralized: ${term.displayName}`;
    });
  }

  function transitionLearningSpace(item: F3LearningSpace, status: Exclude<DeliveryStatus, "ACTIVE">) {
    if (!window.confirm(`Set Learning Space ${item.displayName} to ${status}? Active Running Classes must be neutralized first.`)) return;
    void run("Neutralizing Learning Space", async () => {
      const updated = await f3DeliveryApi.transitionLearningSpace(item.id, { status, expectedVersion: item.version });
      return `Learning Space ${updated.displayName} is now ${updated.status}.`;    });
  }

  function transitionRunningClass(item: F3RunningClass, status: Exclude<DeliveryStatus, "ACTIVE">) {
    if (!window.confirm(`Set Running Class ${item.operationalName} to ${status}? Existing Sessions remain historical truth.`)) return;
    void run("Neutralizing Running Class", async () => {
      const updated = await f3DeliveryApi.transitionRunningClass(item.id, { status, expectedVersion: item.version });
      return `Running Class ${updated.operationalName} is now ${updated.status}.`;
    });
  }

  function publishPolicy() {
    if (!centerId) return;
    void run("Publishing materialization policy", async () => {
      const now = new Date().toISOString();
      if (centerPolicy?.draftVersionId) {
        await f3DeliveryApi.publishMaterializationPolicy(centerPolicy.draftVersionId, { targetType: "CENTER", targetId: centerId, effectiveFrom: now, expectedRevision: centerPolicy.revision });
        return `Existing CENTER materialization draft published now${centerPolicy.draftValue ? ` at ${centerPolicy.draftValue.horizonDays} days` : ""}.`;
      }
      if (effectivePolicy) return `Materialization policy is already effective at ${effectivePolicy.horizonDays} days; no write required.`;
      const horizon = positive(horizonDays);
      if (horizon === null || horizon > 180) throw new Error("Enter a materialization horizon from 1 to 180 days.");
      const draft = await f3DeliveryApi.createMaterializationPolicyDraft({ targetType: "CENTER", targetId: centerId, value: { horizonDays: horizon }, changeReason: "Founder-approved F3 delivery materialization activation" });
      await f3DeliveryApi.publishMaterializationPolicy(draft.versionId, { targetType: "CENTER", targetId: centerId, effectiveFrom: new Date().toISOString(), expectedRevision: draft.revision });
      return `CENTER materialization policy published now at ${horizon} days.`;
    });
  }

  function activateReviewedSeed() {
    if (!center) return;
    void run("Activating reviewed F3 seed", async () => {
      const result = await applyReviewedF3Seed(center.id, localDateInZone(center.timeZone));
      return `Reviewed F3 seed active: ${result.learningSpaces} spaces, ${result.runningClasses} classes, ${result.blocks} blocks. Sessions: ${result.materialization.materialized} new, ${result.materialization.existing} existing, ${result.materialization.excluded} excluded.`;
    });
  }
  function activateReviewedRoster() {
    if (!center) return;
    void run("Activating reviewed learner roster", async () => {
      const result = await activateReviewedEnrollments(center.id);
      return `Reviewed roster active: ${result.placedSubscriptions} subscriptions / ${result.enrollments} Enrollments (${result.created} created, ${result.reused} reused). ${result.unresolvedSubscriptions} double-session subscriptions remain intentionally pending.`;
    });
  }
  function materialize() {
    if (!canMaterialize) return;
    void run("Materializing Sessions", async () => {
      const result = await f3DeliveryApi.materialize({ centerId, startsOnLocalDate: materializeStart, effectiveAt: new Date().toISOString() });
      return `Materialization complete: ${result.materialized} new, ${result.existing} existing, ${result.excluded} excluded, ${result.noOccurrence} non-occurrence across ${result.attempted} attempts.`;
    });
  }

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <span>PINO CORE · SLICE F3</span><h1>Delivery activation</h1>
        <p>Founder-authenticated production setup. Nothing is inferred from prototypes, marketing schedules, room layout, or subscription counts. Each operational value below becomes canonical only when you explicitly submit it.</p>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>Production truth</h2><p>Read-only snapshot · {data.asOf}</p></div><span className={styles.readOnly}>Read only</span></div>
        <div className={styles.metrics}>
          <Metric label="Learning Spaces" value={spaces.length} /><Metric label="Running Classes" value={classes.length} /><Metric label="Upcoming Sessions" value={data.upcomingSessions.filter((item) => item.centerId === centerId).length} /><Metric label="Term Weeks" value={currentTerm?.weekCount ?? 0} />
        </div>
        <label className={styles.field}>Center<select value={centerId} onChange={(event) => { setCenterId(event.target.value); setTermId(""); resetTermWeekForm(); }}><option value="">Select Center…</option>{data.centers.map((item) => <option value={item.id} key={item.id}>{item.displayName} · {item.timeZone}</option>)}</select></label>
        {currentTerm ? <p>Operating Cycle: <strong>{currentTerm.displayName}</strong> · {currentTerm.startDate} → {currentTerm.endDate} · {currentTerm.weekCount} TermWeek(s). TermWeek rhythm remains a separate operational decision and is not auto-filled here.</p> : <p>No current Term is resolved for this Center.</p>}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>Operating Cycle · Terms / Term Weeks</h2><p>Term và từng TermWeek là quyết định vận hành explicit. Hệ thống không tự suy diễn tuần 7 ngày hay rhythm.</p></div><span className={styles.writePill}>Explicit write</span></div>
        <h3>Create Term</h3>
        <div className={styles.formGrid}>
          <Field label="Term code" value={termCode} onChange={setTermCode} placeholder="2026-Q4" />
          <Field label="Display name" value={termName} onChange={setTermName} placeholder="Q4 2026" />
          <Field label="Start date" type="date" value={termStart} onChange={setTermStart} />
          <Field label="End date" type="date" value={termEnd} onChange={setTermEnd} />
        </div>
        <button className={styles.primaryButton} type="button" disabled={!centerId || action.status === "running" || !termCode.trim() || !termName.trim() || !termStart || !termEnd} onClick={createTerm}>Create Term</button>
        {selectedTerm ? <>
          <hr />
          <label className={styles.field}>Term<select value={selectedTerm.id} onChange={(event) => { setTermId(event.target.value); resetTermWeekForm(); }} >{centerTerms.map((term) => <option key={term.id} value={term.id}>{term.displayName} · {term.startDate} → {term.endDate}</option>)}</select></label>
          <div className={styles.formGrid}>
            <Field label="Week code" value={termWeekCode} onChange={setTermWeekCode} placeholder="W01" />
            <Field label="Ordinal" type="number" value={termWeekOrdinal} onChange={setTermWeekOrdinal} />
            <Field label="Start date" type="date" value={termWeekStart} onChange={setTermWeekStart} />
            <Field label="End date" type="date" value={termWeekEnd} onChange={setTermWeekEnd} />
            <Field label="Rhythm key" value={termWeekRhythm} onChange={setTermWeekRhythm} placeholder="OPENING / BUILD / ..." />
          </div>
          <div>
            {!editingTermWeekId ? <button className={styles.secondaryButton} type="button" disabled={action.status === "running"} onClick={prefillNextTermWeek}>Prefill code + ordinal</button> : <button className={styles.secondaryButton} type="button" disabled={action.status === "running"} onClick={resetTermWeekForm}>Cancel edit</button>}{" "}
            <button className={styles.primaryButton} type="button" disabled={action.status === "running" || !termWeekCode.trim() || !termWeekOrdinal || !termWeekStart || !termWeekEnd || !termWeekRhythm.trim()} onClick={saveTermWeek}>{editingTermWeekId ? "Save TermWeek" : "Create TermWeek"}</button>
          </div>
          {selectedTermWeeks.length ? <div className={styles.tableWrap}><table><thead><tr><th>Week</th><th>Ordinal</th><th>Dates</th><th>Rhythm</th><th>Actions</th></tr></thead><tbody>{selectedTermWeeks.map((week) => <tr key={week.id}><td>{week.code}</td><td>{week.ordinal}</td><td>{week.startDate} → {week.endDate}</td><td>{week.rhythmKey}</td><td><button className={styles.secondaryButton} type="button" disabled={action.status === "running"} onClick={() => startEditTermWeek(week)}>Edit</button>{" "}<button className={styles.secondaryButton} type="button" disabled={action.status === "running"} onClick={() => deleteTermWeek(week)}>Delete</button></td></tr>)}</tbody></table></div> : <p>Term này chưa có TermWeek. Prefill chỉ điền code + ordinal; dates và rhythm phải được operator xác nhận explicit.</p>}
          <p>Neutralize Term chỉ mở khi TermWeek đã được cleanup. Nếu operational history còn tham chiếu, Core sẽ fail closed.</p>
          <button className={styles.secondaryButton} type="button" disabled={action.status === "running" || selectedTerm.weekCount !== 0} onClick={() => neutralizeTerm(selectedTerm)}>Neutralize Term</button>
        </> : <State compact error title="TermWeek blocked" message="Tạo Term đầu tiên ở form phía trên để mở TermWeek." />}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>Reviewed F3 seed</h2><p>Founder-approved production seed: 3 Learning Spaces, 28 topology-aware Running Classes, reviewed blocks for Fixed/Overlapping classes, CENTER materialization policy 14 days, then immediate bounded Session materialization.</p></div><span className={styles.writePill}>One-click governed write</span></div>
        <p>This action is retry-safe and fail-safe: exact existing records are reused, mismatches stop the command, and all writes remain same-origin BO → verified local password session → private Core.</p>
        <button className={styles.primaryButton} type="button" disabled={!centerId || action.status === "running"} onClick={activateReviewedSeed}>Activate reviewed F3 seed · 14 days</button>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>Reviewed learner roster</h2><p>Wave1A + Founder corrections: 31 standard subscriptions resolve deterministically to 62 recurring seats. Two reviewed double-session subscriptions stay pending until their assignment/model gap is resolved.</p></div><span className={styles.writePill}>Governed roster write</span></div>
        <p>The command verifies canonical subscriptions, exact Running Class resolution, aggregate hard-capacity safety, live Core capacity, and existing Enrollment provenance before any missing seat is placed. Retry reuses exact prior seats and rejects unexpected data.</p>
        <button className={styles.primaryButton} type="button" disabled={!centerId || action.status === "running" || activeClasses.length !== 28} onClick={activateReviewedRoster}>Activate reviewed roster · 31 / 33</button>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>1 · Learning Space</h2><p>Enter a real operational space and its concurrency limits.</p></div><span className={styles.writePill}>Explicit write</span></div>
        <div className={styles.formGrid}><Field label="Code" value={spaceCode} onChange={setSpaceCode} placeholder="piano-room" /><Field label="Display name" value={spaceName} onChange={setSpaceName} placeholder="Piano Room" /><Field label="Optimal capacity" type="number" value={spaceOptimal} onChange={setSpaceOptimal} /><Field label="Hard capacity (optional)" type="number" value={spaceHard} onChange={setSpaceHard} /></div>
        <button className={styles.primaryButton} type="button" disabled={!centerId || action.status === "running"} onClick={createSpace}>Create Learning Space</button>
        {activeSpaces.length ? <div className={styles.tableWrap}><table><thead><tr><th>Space</th><th>Capacity</th><th>Actions</th></tr></thead><tbody>{activeSpaces.map((item) => <tr key={item.id}><td>{item.displayName} · {item.code}</td><td>{item.optimalConcurrentCapacity}/{item.hardConcurrentCapacity ?? "—"}</td><td><button className={styles.secondaryButton} type="button" disabled={action.status === "running"} onClick={() => transitionLearningSpace(item, "INACTIVE")}>Inactivate</button>{" "}<button className={styles.secondaryButton} type="button" disabled={action.status === "running"} onClick={() => transitionLearningSpace(item, "ARCHIVED")}>Archive</button></td></tr>)}</tbody></table></div> : <p>No active Learning Spaces.</p>}
        {neutralizedSpaces.length ? <><h3>Neutralized Learning Space history</h3><CompactTable rows={neutralizedSpaces.map((item) => [item.displayName, item.code, item.status])} headers={["Space", "Code", "Status"]} /></> : null}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>2 · Running Class</h2><p>One recurring operational class per submitted weekday/time truth.</p></div><span className={styles.writePill}>Explicit write</span></div>
        <div className={styles.formGrid}>
          <SelectField label="Path" value={classPathId} onChange={setClassPathId} options={data.paths.filter((item) => item.status === "ACTIVE").map((item) => [item.id, item.displayName])} />
          <SelectField label="Learning Space" value={classSpaceId} onChange={setClassSpaceId} options={activeSpaces.map((item) => [item.id, item.displayName])} />
          <Field label="Operational name" value={className} onChange={setClassName} placeholder="PianoHouse · Thu 18:00" />
          <label className={styles.field}>Weekday<select value={weekdayIso} onChange={(event) => setWeekdayIso(event.target.value)}>{weekdayNames.slice(1).map((name, index) => <option value={index + 1} key={name}>{name}</option>)}</select></label>
          <Field label="Starts local" type="time" value={startsLocal} onChange={setStartsLocal} /><Field label="Ends local" type="time" value={endsLocal} onChange={setEndsLocal} />
          <label className={styles.field}>Topology<select value={topology} onChange={(event) => setTopology(event.target.value as DeliveryTopology)}><option value="FIXED_COHORT">Fixed cohort</option><option value="OVERLAPPING_COHORT">Overlapping cohort</option><option value="FLEXIBLE_STUDIO">Flexible studio</option></select></label>
          <Field label="Participation minutes (optional)" type="number" value={participationMinutes} onChange={setParticipationMinutes} />
          <Field label="Optimal capacity" type="number" value={classOptimal} onChange={setClassOptimal} /><Field label="Hard capacity (optional)" type="number" value={classHard} onChange={setClassHard} />
        </div>
        <button className={styles.primaryButton} type="button" disabled={!centerId || !classPathId || !classSpaceId || action.status === "running"} onClick={createClass}>Create Running Class</button>
        {activeClasses.length ? <div className={styles.tableWrap}><table><thead><tr><th>Class</th><th>Path / schedule</th><th>Actions</th></tr></thead><tbody>{activeClasses.map((item) => <tr key={item.id}><td>{item.operationalName}</td><td>{pathName(data, item.pathProgramId)} · {weekdayNames[item.weekdayIso]} {item.windowStartsLocal}–{item.windowEndsLocal}</td><td><button className={styles.secondaryButton} type="button" disabled={action.status === "running"} onClick={() => transitionRunningClass(item, "INACTIVE")}>Inactivate</button>{" "}<button className={styles.secondaryButton} type="button" disabled={action.status === "running"} onClick={() => transitionRunningClass(item, "ARCHIVED")}>Archive</button></td></tr>)}</tbody></table></div> : <p>No active Running Classes.</p>}
        {neutralizedClasses.length ? <><h3>Neutralized Running Class history</h3><CompactTable rows={neutralizedClasses.map((item) => [item.operationalName, pathName(data, item.pathProgramId), item.status])} headers={["Class", "Path", "Status"]} /></> : null}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>3 · Running Class block</h2><p>Materialization stays disabled until every active Fixed/Overlapping class has at least one explicit block. Flexible Studio uses planned learner intervals and does not require class blocks.</p></div><span className={styles.writePill}>Explicit write</span></div>
        <div className={styles.formGrid}>
          <SelectField label="Running Class" value={blockClassId} onChange={setBlockClassId} options={activeClasses.map((item) => [item.id, item.operationalName])} />
          <label className={styles.field}>Block kind<select value={blockKind} onChange={(event) => setBlockKind(event.target.value as typeof blockKind)}><option value="LEARNING">Learning</option><option value="BRIDGE">Bridge</option><option value="TRANSITION">Transition</option></select></label>
          <Field label="Start offset (minutes)" type="number" value={blockStart} onChange={setBlockStart} /><Field label="End offset (minutes)" type="number" value={blockEnd} onChange={setBlockEnd} /><Field label="Label (optional)" value={blockLabel} onChange={setBlockLabel} />
        </div>
        <button className={styles.primaryButton} type="button" disabled={!blockClassId || action.status === "running"} onClick={createBlock}>Create Class Block</button>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>4 · Materialization policy</h2><p>Required by Core; there is no hidden default horizon.</p></div><span className={styles.writePill}>Policy write</span></div>
        {effectivePolicy ? <div className={styles.successCard}><strong>Effective materialization policy</strong><span>{effectivePolicy.horizonDays} days · {centerPolicy?.publishedValue ? "CENTER" : "GLOBAL fallback"}</span></div> : centerPolicy?.draftVersionId ? <div className={styles.card}><strong>Draft awaiting publish</strong><span>{centerPolicy.draftValue?.horizonDays ?? "?"} days · revision {centerPolicy.revision}</span></div> : <Field label="Horizon days (1–180)" type="number" value={horizonDays} onChange={setHorizonDays} />}
        <button className={styles.primaryButton} type="button" disabled={!centerId || action.status === "running" || Boolean(effectivePolicy && !centerPolicy?.draftVersionId)} onClick={publishPolicy}>{centerPolicy?.draftVersionId ? "Publish existing draft now" : effectivePolicy ? "Policy active" : "Create & publish CENTER policy now"}</button>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><h2>5 · Materialize Sessions</h2><p>Creates recurring Sessions only from active Running Classes, their reviewed schedule, Core policy horizon, exclusions, and resolver provenance.</p></div><span className={styles.writePill}>Final F3 write</span></div>
        {classesMissingBlocks.length ? <State compact error title="Materialization blocked" message={`${classesMissingBlocks.length} active Running Class(es) still have no block.`} /> : null}
        {!effectivePolicy ? <State compact error title="Materialization blocked" message="No effective materialization policy is resolved for this Center." /> : null}
        <Field label="Start local date" type="date" value={materializeStart} onChange={setMaterializeStart} />
        <button className={styles.primaryButton} type="button" disabled={!canMaterialize} onClick={materialize}>Materialize reviewed Sessions</button>
      </section>

      {action.status === "running" ? <State compact title={action.label} message="Command is executing through authenticated BO → private Core." /> : null}
      {action.status === "success" ? <div className={styles.successCard}><strong>{action.message}</strong></div> : null}
      {action.status === "error" ? <State compact error title="Command stopped" message={action.message} requestId={action.requestId} /> : null}
    </div>
  );
}

function localDateInZone(timeZone: string) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function currentTermForCenter(data: F3BootstrapState, centerId: string, timeZone: string) {
  const localDate = new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(data.asOf));
  return data.terms.find((term) => term.centerId === centerId && term.startDate <= localDate && term.endDate >= localDate) ?? null;
}
function nextTermWeekIdentityDraft(weeks: F3BootstrapState["termWeeks"]) {
  const ordinal = Math.max(0, ...weeks.map((week) => week.ordinal)) + 1;
  return { code: `W${String(ordinal).padStart(2, "0")}`, ordinal };
}
function pathName(data: F3BootstrapState, id: string) { return data.paths.find((item) => item.id === id)?.displayName ?? id; }
function positive(value: string) { const number = Number(value); return Number.isInteger(number) && number >= 1 ? number : null; }
function nonNegative(value: string) { const number = Number(value); return Number.isInteger(number) && number >= 0 ? number : null; }
function optionalPositive(value: string): number | null | undefined { if (!value.trim()) return null; const number = positive(value); return number === null ? undefined : number; }

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className={styles.field}>{label}<input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label className={styles.field}>{label}<select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select…</option>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className={styles.metric}><span>{label}</span><strong>{value}</strong></div>; }
function CompactTable({ headers, rows }: { headers: string[]; rows: string[][] }) { return <div className={styles.tableWrap}><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={`${cellIndex}-${cell}`}>{cell}</td>)}</tr>)}</tbody></table></div>; }
function State({ title, message, requestId, error = false, compact = false }: { title: string; message: string; requestId?: string | null; error?: boolean; compact?: boolean }) {
  return <section className={`${styles.state} ${compact ? styles.compactState : ""} ${error ? styles.errorState : ""}`}><strong>{title}</strong><span>{message}</span>{requestId ? <code>{requestId}</code> : null}</section>;
}
