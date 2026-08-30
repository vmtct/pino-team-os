"use client";

import { useEffect, useMemo, useState } from "react";
import {
  boApi,
  BoApiError,
  type OpenStudioPolicyInspection,
  type OpenStudioPolicyKey,
  type OpenStudioPolicyTarget,
} from "@/lib/bo-api";
import styles from "../bo.module.css";

type Experience = "KHAM_PHA" | "CAO_CAP" | "CHUYEN_DE";
type MonthlyPolicy = { quantityPerPath: number; periodKind: "CALENDAR_MONTH"; carryForwardPeriods: number; allowedParticipantModes: ("OWNER" | "SIBLING")[]; allowedExperienceTypes: Experience[] };
type FriendPolicy = { enabled: boolean; allowedExperienceTypes: Experience[]; cadence: "MONTHLY"; quantityPerPeriod: number; validityMode: "CALENDAR_PERIOD"; carryUnused: false };
type PublicPolicy = { enabled: boolean; allowedExperienceTypes: Experience[]; maxActiveRegistrationsPerContact: number; maxActiveRegistrationsPerSession: number; activeWindowDays: number };
type CancellationPolicy = { passReleaseCutoffMinutesBeforeStart: number };
type PolicyValue = MonthlyPolicy | FriendPolicy | PublicPolicy | CancellationPolicy;
type PolicyState = { inspection: OpenStudioPolicyInspection<PolicyValue> | null; baseline: OpenStudioPolicyInspection<PolicyValue> | null; value: PolicyValue; reason: string; effectiveFrom: string; loading: boolean; busy: boolean; error: string; notice: string };

const EXPERIENCES: Experience[] = ["KHAM_PHA", "CAO_CAP", "CHUYEN_DE"];
const DEFAULTS: Record<OpenStudioPolicyKey, PolicyValue> = {
  "monthly_path_pass.v1": { quantityPerPath: 1, periodKind: "CALENDAR_MONTH", carryForwardPeriods: 0, allowedParticipantModes: ["OWNER"], allowedExperienceTypes: ["KHAM_PHA"] },
  "bring_a_friend.v1": { enabled: true, allowedExperienceTypes: ["KHAM_PHA"], cadence: "MONTHLY", quantityPerPeriod: 1, validityMode: "CALENDAR_PERIOD", carryUnused: false },
  "public_acquisition.v1": { enabled: true, allowedExperienceTypes: ["KHAM_PHA"], maxActiveRegistrationsPerContact: 2, maxActiveRegistrationsPerSession: 1, activeWindowDays: 30 },
  "cancellation.v1": { passReleaseCutoffMinutesBeforeStart: 120 },
};

const LABELS: Record<OpenStudioPolicyKey, { title: string; note: string }> = {
  "monthly_path_pass.v1": { title: "Monthly Path Pass", note: "Số pass theo Path, carry-forward và loại trải nghiệm được dùng." },
  "bring_a_friend.v1": { title: "Bring-a-Friend", note: "Cadence guest pass theo household và loại trải nghiệm được phép." },
  "public_acquisition.v1": { title: "Public Acquisition", note: "Giới hạn lead/public registration cho Open Studio." },
  "cancellation.v1": { title: "Cancellation", note: "Mốc cutoff để hủy reservation và trả pass." },
};

const POLICY_KEYS = Object.keys(DEFAULTS) as OpenStudioPolicyKey[];

export function OpenStudioPolicyControl({ centerId }: { centerId: string }) {
  const target = useMemo<OpenStudioPolicyTarget>(() => centerId ? { targetType: "CENTER", targetId: centerId } : { targetType: "GLOBAL", targetId: null }, [centerId]);
  const [states, setStates] = useState<Record<OpenStudioPolicyKey, PolicyState>>(() => initialStates());
  useEffect(() => {
    let active = true;
    setStates(initialStates(true));
    void Promise.all(POLICY_KEYS.map(async (key) => {
      const inspection = await boApi.openStudioPolicyStream<PolicyValue>(key, target);
      const baseline = !inspection && target.targetType === "CENTER"
        ? await boApi.openStudioPolicyStream<PolicyValue>(key, { targetType: "GLOBAL", targetId: null })
        : null;
      return [key, inspection, baseline] as const;
    }))
      .then((rows) => {
        if (!active) return;
        const next = initialStates();
        for (const [key, inspection, baseline] of rows) {
          const source = inspection ?? baseline;
          const draft = inspection?.versions.find((item) => item.storedState === "DRAFT") ?? null;
          const published = source?.versions.filter((item) => item.storedState === "PUBLISHED").at(-1) ?? null;
          next[key] = { ...next[key], inspection, baseline, value: structuredClone(draft?.value ?? published?.value ?? DEFAULTS[key]), loading: false };
        }
        setStates(next);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStates((current) => mapStates(current, (state) => ({ ...state, loading: false, error: apiMessage(error) })));
      });
    return () => { active = false; };
  }, [target]);

  function patchValue<T extends PolicyValue>(key: OpenStudioPolicyKey, patch: Partial<T>) {
    setStates((current) => ({ ...current, [key]: { ...current[key], value: { ...current[key].value, ...patch } as PolicyValue, notice: "", error: "" } }));
  }
  function patchState(key: OpenStudioPolicyKey, patch: Partial<PolicyState>) {
    setStates((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  async function reload(key: OpenStudioPolicyKey) {
    const inspection = await boApi.openStudioPolicyStream<PolicyValue>(key, target);
    const baseline = !inspection && target.targetType === "CENTER"
      ? await boApi.openStudioPolicyStream<PolicyValue>(key, { targetType: "GLOBAL", targetId: null })
      : null;
    const source = inspection ?? baseline;
    const draft = inspection?.versions.find((item) => item.storedState === "DRAFT") ?? null;
    const published = source?.versions.filter((item) => item.storedState === "PUBLISHED").at(-1) ?? null;
    setStates((current) => ({ ...current, [key]: { ...current[key], inspection, baseline, value: structuredClone(draft?.value ?? published?.value ?? DEFAULTS[key]), loading: false, busy: false } }));
  }

  async function createDraft(key: OpenStudioPolicyKey) {
    const state = states[key];
    if (!state.reason.trim()) { patchState(key, { error: "Nhập change reason trước khi tạo Draft." }); return; }
    patchState(key, { busy: true, error: "", notice: "" });
    try {
      await boApi.createOpenStudioPolicyDraft(key, target, state.value, state.reason.trim(), state.inspection?.stream.revision ?? 0);
      await reload(key);
      patchState(key, { notice: "Draft canonical đã được tạo. Review rồi Publish." });
    } catch (error) { patchState(key, { busy: false, error: apiMessage(error) }); }
  }

  async function publishDraft(key: OpenStudioPolicyKey) {
    const state = states[key], draft = state.inspection?.versions.find((item) => item.storedState === "DRAFT");
    if (!draft) return;
    const effectiveFrom = state.effectiveFrom ? new Date(state.effectiveFrom).toISOString() : new Date().toISOString();
    patchState(key, { busy: true, error: "", notice: "" });
    try {
      await boApi.publishOpenStudioPolicy(key, draft.id, target, effectiveFrom, state.inspection?.stream.revision ?? 0);
      await reload(key);
      patchState(key, { notice: `Published từ ${new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(effectiveFrom))}.`, reason: "" });
    } catch (error) { patchState(key, { busy: false, error: apiMessage(error) }); }
  }

  return <section className={styles.panel}>
    <div className={styles.panelHeading}>
      <div><h2>Policy Control</h2><p>Config canonical điều khiển issuance, eligibility, public acquisition và cancellation.</p></div>
      <span className={styles.writePill}>{target.targetType === "GLOBAL" ? "GLOBAL default" : "CENTER override"}</span>
    </div>
    <p className={styles.muted}>{target.targetType === "GLOBAL" ? "Chọn “Tất cả Center” để quản lý default toàn House." : `Override cho Center ${centerId.slice(0, 8)}. Core vẫn giữ published history immutable.`}</p>
    <div className={styles.osPolicyGrid}>
      {POLICY_KEYS.map((key) => <PolicyCard key={key} policyKey={key} state={states[key]} onPatch={patchValue} onState={patchState} onDraft={createDraft} onPublish={publishDraft} />)}
    </div>
  </section>;
}

function PolicyCard({ policyKey, state, onPatch, onState, onDraft, onPublish }: {
  policyKey: OpenStudioPolicyKey; state: PolicyState;
  onPatch: <T extends PolicyValue>(key: OpenStudioPolicyKey, patch: Partial<T>) => void;
  onState: (key: OpenStudioPolicyKey, patch: Partial<PolicyState>) => void;
  onDraft: (key: OpenStudioPolicyKey) => Promise<void>;
  onPublish: (key: OpenStudioPolicyKey) => Promise<void>;
}) {
  const draft = state.inspection?.versions.find((item) => item.storedState === "DRAFT") ?? null;
  const source = state.inspection ?? state.baseline;
  const published = source?.versions.filter((item) => item.storedState === "PUBLISHED").at(-1) ?? null;
  const inherited = !state.inspection && Boolean(state.baseline && published);
  const locked = Boolean(draft);
  return <article className={styles.osPolicyCard}>
    <div className={styles.osCardHead}>
      <div><strong>{LABELS[policyKey].title}</strong><span>{LABELS[policyKey].note}</span></div>
      <span className={styles.statusPill}>{state.loading ? "LOADING" : draft ? `DRAFT v${draft.version}` : inherited ? `INHERIT GLOBAL v${published?.version}` : published ? `LIVE v${published.version}` : "UNSET"}</span>
    </div>
    {policyKey === "monthly_path_pass.v1" ? <MonthlyFields value={state.value as MonthlyPolicy} disabled={locked || state.busy} onChange={(patch) => onPatch<MonthlyPolicy>(policyKey, patch)} /> : null}
    {policyKey === "bring_a_friend.v1" ? <FriendFields value={state.value as FriendPolicy} disabled={locked || state.busy} onChange={(patch) => onPatch<FriendPolicy>(policyKey, patch)} /> : null}
    {policyKey === "public_acquisition.v1" ? <PublicFields value={state.value as PublicPolicy} disabled={locked || state.busy} onChange={(patch) => onPatch<PublicPolicy>(policyKey, patch)} /> : null}
    {policyKey === "cancellation.v1" ? <CancellationFields value={state.value as CancellationPolicy} disabled={locked || state.busy} onChange={(patch) => onPatch<CancellationPolicy>(policyKey, patch)} /> : null}
    <label className={styles.field}>Change reason<input value={state.reason} disabled={locked || state.busy} onChange={(event) => onState(policyKey, { reason: event.target.value, error: "", notice: "" })} placeholder="Vì sao thay đổi policy này?" /></label>
    {draft ? <label className={styles.field}>Effective from<input type="datetime-local" value={state.effectiveFrom} disabled={state.busy} onChange={(event) => onState(policyKey, { effectiveFrom: event.target.value, error: "", notice: "" })} /></label> : null}
    {state.error ? <div className={styles.errorState}>{state.error}</div> : null}
    {state.notice ? <div className={styles.successCard}><span>Policy</span><strong>{state.notice}</strong></div> : null}
    <div className={styles.osPolicyActions}>
      {!draft ? <button className={styles.secondaryButton} disabled={state.loading || state.busy} onClick={() => void onDraft(policyKey)}>{state.busy ? "Đang tạo…" : "Create Draft"}</button> : null}
      {draft ? <button className={styles.primaryButton} disabled={state.busy} onClick={() => void onPublish(policyKey)}>{state.busy ? "Đang publish…" : "Publish Draft"}</button> : null}
    </div>
    <small className={styles.muted}>{draft ? "Draft đang khóa payload để tránh UI giả lập edit-in-place. Publish xong mới tạo version kế tiếp." : inherited ? `Đang inherit GLOBAL từ ${shortDateTime(published?.effectiveFrom ?? null)}; Create Draft sẽ clone baseline này thành Center override.` : published ? `Live từ ${shortDateTime(published.effectiveFrom)}` : "Chưa có stream ở scope này."}</small>
  </article>;
}

function MonthlyFields({ value, disabled, onChange }: { value: MonthlyPolicy; disabled: boolean; onChange: (patch: Partial<MonthlyPolicy>) => void }) {
  return <div className={styles.osPolicyFields}>
    <NumberField label="Pass / Path / tháng" value={value.quantityPerPath} min={0} max={12} disabled={disabled} onChange={(quantityPerPath) => onChange({ quantityPerPath })} />
    <NumberField label="Carry forward (tháng)" value={value.carryForwardPeriods} min={0} max={12} disabled={disabled} onChange={(carryForwardPeriods) => onChange({ carryForwardPeriods })} />
    <div className={styles.osCheckGroup}><span>Participant</span><Check label="Owner" checked={value.allowedParticipantModes.includes("OWNER")} disabled={disabled} onChange={(checked) => onChange({ allowedParticipantModes: toggle(value.allowedParticipantModes, "OWNER", checked) })} /><Check label="Sibling" checked={value.allowedParticipantModes.includes("SIBLING")} disabled={disabled} onChange={(checked) => onChange({ allowedParticipantModes: toggle(value.allowedParticipantModes, "SIBLING", checked) })} /></div>
    <ExperienceChecks value={value.allowedExperienceTypes} disabled={disabled} onChange={(allowedExperienceTypes) => onChange({ allowedExperienceTypes })} />
  </div>;
}
function FriendFields({ value, disabled, onChange }: { value: FriendPolicy; disabled: boolean; onChange: (patch: Partial<FriendPolicy>) => void }) {
  return <div className={styles.osPolicyFields}>
    <div className={styles.osCheckGroup}><span>Availability</span><Check label="Enabled" checked={value.enabled} disabled={disabled} onChange={(enabled) => onChange({ enabled })} /></div>
    <NumberField label="Pass / tháng" value={value.quantityPerPeriod} min={value.enabled ? 1 : 0} max={12} disabled={disabled} onChange={(quantityPerPeriod) => onChange({ quantityPerPeriod })} />
    <ExperienceChecks value={value.allowedExperienceTypes} disabled={disabled} onChange={(allowedExperienceTypes) => onChange({ allowedExperienceTypes })} />
  </div>;
}

function PublicFields({ value, disabled, onChange }: { value: PublicPolicy; disabled: boolean; onChange: (patch: Partial<PublicPolicy>) => void }) {
  return <div className={styles.osPolicyFields}>
    <div className={styles.osCheckGroup}><span>Availability</span><Check label="Enabled" checked={value.enabled} disabled={disabled} onChange={(enabled) => onChange({ enabled })} /></div>
    <NumberField label="Active / contact" value={value.maxActiveRegistrationsPerContact} min={1} max={20} disabled={disabled} onChange={(maxActiveRegistrationsPerContact) => onChange({ maxActiveRegistrationsPerContact })} />
    <NumberField label="Active / session" value={value.maxActiveRegistrationsPerSession} min={1} max={200} disabled={disabled} onChange={(maxActiveRegistrationsPerSession) => onChange({ maxActiveRegistrationsPerSession })} />
    <NumberField label="Window (ngày)" value={value.activeWindowDays} min={1} max={90} disabled={disabled} onChange={(activeWindowDays) => onChange({ activeWindowDays })} />
    <ExperienceChecks value={value.allowedExperienceTypes} disabled={disabled} onChange={(allowedExperienceTypes) => onChange({ allowedExperienceTypes })} />
  </div>;
}

function CancellationFields({ value, disabled, onChange }: { value: CancellationPolicy; disabled: boolean; onChange: (patch: Partial<CancellationPolicy>) => void }) {
  return <div className={styles.osPolicyFields}><NumberField label="Release cutoff (phút)" value={value.passReleaseCutoffMinutesBeforeStart} min={0} max={10080} disabled={disabled} onChange={(passReleaseCutoffMinutesBeforeStart) => onChange({ passReleaseCutoffMinutesBeforeStart })} /></div>;
}
function ExperienceChecks({ value, disabled, onChange }: { value: Experience[]; disabled: boolean; onChange: (value: Experience[]) => void }) {
  return <div className={styles.osCheckGroup}>
    <span>Experience</span>
    {EXPERIENCES.map((experience) => <Check key={experience} label={experienceLabel(experience)} checked={value.includes(experience)} disabled={disabled} onChange={(checked) => onChange(toggle(value, experience, checked))} />)}
  </div>;
}

function Check({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }) {
  return <label className={styles.osCheck}><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function NumberField({ label, value, min, max, disabled, onChange }: { label: string; value: number; min: number; max: number; disabled: boolean; onChange: (value: number) => void }) {
  return <label className={styles.field}>{label}<input type="number" value={value} min={min} max={max} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function toggle<T extends string>(values: T[], value: T, checked: boolean): T[] {
  return checked ? [...new Set([...values, value])] : values.filter((item) => item !== value);
}
function initialStates(loading = false): Record<OpenStudioPolicyKey, PolicyState> {
  const effectiveFrom = localDateTimeInput(new Date());
  return Object.fromEntries(POLICY_KEYS.map((key) => [key, { inspection: null, baseline: null, value: structuredClone(DEFAULTS[key]), reason: "", effectiveFrom, loading, busy: false, error: "", notice: "" }])) as Record<OpenStudioPolicyKey, PolicyState>;
}

function mapStates(states: Record<OpenStudioPolicyKey, PolicyState>, mapper: (state: PolicyState) => PolicyState) {
  return Object.fromEntries(POLICY_KEYS.map((key) => [key, mapper(states[key])])) as Record<OpenStudioPolicyKey, PolicyState>;
}

function localDateTimeInput(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function shortDateTime(value: string | null) { return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—"; }
function experienceLabel(value: Experience) { return value === "KHAM_PHA" ? "Khám phá" : value === "CAO_CAP" ? "Cao cấp" : "Chuyên đề"; }
function apiMessage(error: unknown) {
  if (error instanceof BoApiError) return error.requestId ? `${error.message} · ${error.requestId}` : error.message;
  return error instanceof Error ? error.message : "Không thể hoàn tất Open Studio policy command.";
}
