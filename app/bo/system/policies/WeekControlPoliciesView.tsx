"use client";

import { useEffect, useMemo, useState } from "react";
import { boApi, type WorkforceWindowPolicyInspection, type WorkforcePolicyTarget, type WorkforceWindowPolicyKey, type WorkforceWindowPolicyValue } from "@/lib/bo-api";
import type { BoWorkforcePlanningBootstrap } from "@/lib/bo-model";
import styles from "../../bo.module.css";

type State = { inspection: WorkforceWindowPolicyInspection | null; effective: WorkforceWindowPolicyValue | null; inherited: boolean; value: WorkforceWindowPolicyValue; reason: string; busy: boolean; error: string };
const KEYS: WorkforceWindowPolicyKey[] = ["AVAILABILITY_WINDOW_V1", "PLANNING_WINDOW_V1"];
const DEFAULTS: Record<WorkforceWindowPolicyKey, WorkforceWindowPolicyValue> = {
  AVAILABILITY_WINDOW_V1: { autoLock: { enabled: true, timeLocal: "20:00", daysBeforeWeekStart: 2 } },
  PLANNING_WINDOW_V1: { autoLock: { enabled: true, timeLocal: "20:00", daysBeforeWeekStart: 1 } },
};

export function WeekControlPoliciesView() {
  const [bootstrap, setBootstrap] = useState<BoWorkforcePlanningBootstrap | null>(null);
  const [centerId, setCenterId] = useState("");
  const [scope, setScope] = useState<"GLOBAL" | "CENTER">("CENTER");
  const [states, setStates] = useState<Record<WorkforceWindowPolicyKey, State>>(() => initialStates());
  const center = bootstrap?.centers.find((item) => item.id === centerId) ?? null;
  const target = useMemo<WorkforcePolicyTarget>(() => scope === "GLOBAL" ? { targetType: "GLOBAL", targetId: null } : { targetType: "CENTER", targetId: centerId }, [scope, centerId]);

  useEffect(() => {
    void boApi.workforcePlanningBootstrap().then((data) => {
      setBootstrap(data);
      if (data.centers[0]) setCenterId(data.centers[0].id);
      if (data.canManageGlobalPolicy) setScope("GLOBAL");
    }).catch((error: unknown) => setStates((current) => mapStates(current, (state) => ({ ...state, error: message(error) }))));
  }, []);

  useEffect(() => { if (scope === "GLOBAL" || centerId) void Promise.all(KEYS.map((key) => reload(key, target))); }, [target, scope, centerId]);

  async function reload(key: WorkforceWindowPolicyKey, nextTarget: WorkforcePolicyTarget) {
    setStates((current) => ({ ...current, [key]: { ...current[key], busy: true, error: "" } }));
    try {
      const inspection = await boApi.workforceWindowPolicyStream(key, nextTarget);
      let effective: WorkforceWindowPolicyValue | null = null;
      try { effective = (await boApi.workforceWindowPolicyEffective(key, nextTarget, new Date().toISOString())).value; } catch {}
      setStates((current) => ({ ...current, [key]: { ...current[key], inspection, effective, inherited: nextTarget.targetType === "CENTER" && !inspection && Boolean(effective), value: latestValue(inspection) ?? effective ?? DEFAULTS[key], busy: false, error: "" } }));
    } catch (error) { setStates((current) => ({ ...current, [key]: { ...current[key], busy: false, error: message(error) } })); }
  }

  function patch(key: WorkforceWindowPolicyKey, value: Partial<WorkforceWindowPolicyValue["autoLock"]>) {
    setStates((current) => ({ ...current, [key]: { ...current[key], value: { autoLock: { ...current[key].value.autoLock, ...value } }, error: "" } }));
  }

  async function save(key: WorkforceWindowPolicyKey) {
    const state = states[key]; if (!state.reason.trim()) return;
    setStates((current) => ({ ...current, [key]: { ...current[key], busy: true, error: "" } }));
    try {
      const draft = await boApi.createWorkforceWindowPolicyDraft(key, target, state.value, state.reason.trim(), state.inspection?.stream.revision ?? 0);
      await boApi.publishWorkforceWindowPolicy(key, draft.versionId, target, new Date().toISOString(), draft.revision);
      setStates((current) => ({ ...current, [key]: { ...current[key], reason: "" } }));
      await reload(key, target);
    } catch (error) { setStates((current) => ({ ...current, [key]: { ...current[key], busy: false, error: message(error) } })); }
  }

  const canEdit = scope === "GLOBAL" ? Boolean(bootstrap?.canManageGlobalPolicy) : Boolean(center?.canManageCenterPolicy);
  return <section className={styles.page}>
    <header className={styles.heading}><span>Back Office · System</span><h1>Policies</h1><p>Cấu hình cửa sổ đăng ký Staff và chốt xếp ca. CENTER override ưu tiên GLOBAL default.</p></header>
    <section className={styles.panel}><div className={styles.plannerFilters}>
      {bootstrap?.canManageGlobalPolicy ? <label className={styles.field}>Scope<select value={scope} onChange={(event) => setScope(event.target.value as "GLOBAL" | "CENTER")}><option value="GLOBAL">GLOBAL default</option><option value="CENTER">CENTER override</option></select></label> : null}
      {scope === "CENTER" ? <label className={styles.field}>Center<select value={centerId} onChange={(event) => setCenterId(event.target.value)}>{bootstrap?.centers.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label> : null}
    </div></section>
    <div className={styles.osPolicyGrid}>{KEYS.map((key) => {
      const state = states[key], label = key === "AVAILABILITY_WINDOW_V1" ? "Đăng ký ca" : "Xếp ca tuần";
      return <article className={styles.osPolicyCard} key={key}>
        <div className={styles.panelHeading}><div><h2>{label}</h2><p>{state.inherited ? "Đang dùng GLOBAL default" : scope === "GLOBAL" ? "GLOBAL default" : "CENTER override"}</p></div><span className={styles.readOnly}>{state.effective ? "Effective" : "Chưa cấu hình"}</span></div>
        {state.error ? <div className={styles.errorCard}>{state.error}</div> : null}
        <div className={styles.osPolicyFields}>
          <label className={styles.field}>Tự động khóa<select disabled={!canEdit || state.busy} value={state.value.autoLock.enabled ? "YES" : "NO"} onChange={(event) => patch(key, { enabled: event.target.value === "YES" })}><option value="YES">Bật</option><option value="NO">Tắt</option></select></label>
          <label className={styles.field}>Giờ<input type="time" disabled={!canEdit || state.busy} value={state.value.autoLock.timeLocal} onChange={(event) => patch(key, { timeLocal: event.target.value })} /></label>
          <label className={styles.field}>Trước tuần mới<input type="number" min={0} max={14} disabled={!canEdit || state.busy} value={state.value.autoLock.daysBeforeWeekStart} onChange={(event) => patch(key, { daysBeforeWeekStart: Number(event.target.value) })} /></label>
        </div>
        <div className={styles.card}><strong>Preview</strong><span>{preview(state.value, bootstrap, centerId)}</span></div>
        {canEdit ? <><label className={styles.field}>Lý do thay đổi<input value={state.reason} disabled={state.busy} onChange={(event) => setStates((current) => ({ ...current, [key]: { ...current[key], reason: event.target.value } }))} placeholder="Bắt buộc để publish policy" /></label><button className={styles.primaryButton} disabled={state.busy || !state.reason.trim()} onClick={() => void save(key)}>{state.busy ? "Đang lưu…" : state.inspection ? "Tạo version & publish" : scope === "CENTER" ? "Tạo Center override" : "Tạo Global default"}</button></> : <p className={styles.readOnly}>Bạn chỉ có quyền xem effective policy trong scope này.</p>}
      </article>;
    })}</div>
  </section>;
}

function initialStates(): Record<WorkforceWindowPolicyKey, State> { return Object.fromEntries(KEYS.map((key) => [key, { inspection: null, effective: null, inherited: false, value: structuredClone(DEFAULTS[key]), reason: "", busy: false, error: "" }])) as Record<WorkforceWindowPolicyKey, State>; }
function mapStates(states: Record<WorkforceWindowPolicyKey, State>, mapper: (state: State) => State) { return Object.fromEntries(KEYS.map((key) => [key, mapper(states[key])])) as Record<WorkforceWindowPolicyKey, State>; }
function latestValue(inspection: WorkforceWindowPolicyInspection | null): WorkforceWindowPolicyValue | null { if (!inspection) return null; return [...inspection.versions].reverse().find((version) => version.storedState === "DRAFT")?.value ?? [...inspection.versions].reverse().find((version) => version.storedState === "PUBLISHED")?.value ?? null; }
function preview(value: WorkforceWindowPolicyValue, bootstrap: BoWorkforcePlanningBootstrap | null, centerId: string) { if (!value.autoLock.enabled) return "Không tự động khóa."; const termIds = new Set((bootstrap?.terms ?? []).filter((term) => !centerId || term.centerId === centerId).map((term) => term.id)); const week = (bootstrap?.termWeeks ?? []).filter((item) => termIds.has(item.termId)).sort((a,b) => a.startDate.localeCompare(b.startDate))[0]; if (!week) return `${value.autoLock.timeLocal} · trước tuần mới ${value.autoLock.daysBeforeWeekStart} ngày`; const date = new Date(`${week.startDate}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - value.autoLock.daysBeforeWeekStart); return `Tuần ${week.code}: ${date.toISOString().slice(0,10)} · ${value.autoLock.timeLocal} theo múi giờ Center`; }
function message(error: unknown) { return error instanceof Error ? error.message : "Không thể tải Policy Center."; }
