"use client";

import { useEffect, useMemo, useState } from "react";
import { boApi, type DeliveryFutureReservationPolicyInspection, type WorkforcePolicyInspection, type WorkforcePolicyKey } from "@/lib/bo-api";
import type { BoCenter } from "@/lib/bo-model";
import styles from "../../bo.module.css";

const POLICIES: Array<{ key: WorkforcePolicyKey; title: string; actions: string[]; description: string }> = [
  { key: "TIMEKEEPING_ELIGIBILITY", title: "Timekeeping", actions: ["CHECK_IN", "CHECK_OUT"], description: "Cho phép Staff check-in / check-out tại Center." },
  { key: "AVAILABILITY_ELIGIBILITY", title: "Availability", actions: ["EDIT", "SUBMIT"], description: "Cho phép Staff sửa và gửi đăng ký ca." },
];

export function WorkforcePoliciesView() {
  const [centers, setCenters] = useState<BoCenter[]>([]);
  const [centerId, setCenterId] = useState("");
  const [states, setStates] = useState<Record<string, WorkforcePolicyInspection | null>>({});
  const [futureReservation, setFutureReservation] = useState<DeliveryFutureReservationPolicyInspection | null>(null);
  const [maxDaysAhead, setMaxDaysAhead] = useState("365");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const center = useMemo(() => centers.find((item) => item.id === centerId) ?? null, [centers, centerId]);

  useEffect(() => { void loadCenters(); }, []);
  useEffect(() => { if (centerId) void loadPolicies(centerId); }, [centerId]);

  async function loadCenters() {
    try {
      setError("");
      const next = await boApi.centers();
      setCenters(next);
      setCenterId((current) => current || next[0]?.id || "");
    } catch (cause) { setError(message(cause)); }
  }

  async function loadPolicies(targetCenterId: string) {
    try {
      setError("");
      const [entries, future] = await Promise.all([
        Promise.all(POLICIES.map(async ({ key }) => [key, await boApi.workforcePolicyStream(key, targetCenterId)] as const)),
        boApi.deliveryFutureReservationPolicyStream(targetCenterId),
      ]);
      setStates(Object.fromEntries(entries));
      setFutureReservation(future);
      const now = Date.now();
      const effective = future?.versions.find((version) => version.storedState === "PUBLISHED" && version.effectiveFrom && Date.parse(version.effectiveFrom) <= now && (!version.effectiveUntil || Date.parse(version.effectiveUntil) > now)) ?? null;
      const draft = future?.versions.find((version) => version.storedState === "DRAFT") ?? null;
      setMaxDaysAhead(String(effective?.value.maxDaysAhead ?? draft?.value.maxDaysAhead ?? 365));
    } catch (cause) { setError(message(cause)); }
  }

  async function enable(key: WorkforcePolicyKey, actions: string[]) {
    if (!centerId) return;
    setBusy(key); setError("");
    try {
      const current = states[key] ?? null;
      const draft = current?.versions.find((version) => version.storedState === "DRAFT") ?? null;
      if (draft) {
        await boApi.publishWorkforcePolicy(key, draft.id, centerId, new Date().toISOString(), current?.stream.revision ?? 0);
      } else {
        const created = await boApi.createWorkforcePolicyDraft(key, centerId, actions, current?.stream.revision ?? 0);
        await boApi.publishWorkforcePolicy(key, created.versionId, centerId, new Date().toISOString(), created.revision);
      }
      await loadPolicies(centerId);
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(""); }
  }

  async function saveFutureReservationPolicy() {
    if (!centerId || busy) return;
    const parsed = Number(maxDaysAhead);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 365) { setError("Future reservation phải từ 0 đến 365 ngày."); return; }
    setBusy("FUTURE_RESERVATION"); setError("");
    try {
      const current = futureReservation;
      const draft = current?.versions.find((version) => version.storedState === "DRAFT") ?? null;
      if (draft) {
        if (draft.value.maxDaysAhead !== parsed) throw new Error("Đã có draft khác giá trị. Hãy xử lý draft hiện hữu trước.");
        await boApi.publishDeliveryFutureReservationPolicy(draft.id, centerId, new Date().toISOString(), current?.stream.revision ?? 0);
      } else {
        const created = await boApi.createDeliveryFutureReservationPolicyDraft(centerId, parsed, current?.stream.revision ?? 0);
        await boApi.publishDeliveryFutureReservationPolicy(created.versionId, centerId, new Date().toISOString(), created.revision);
      }
      await loadPolicies(centerId);
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(""); }
  }

  return <section className={styles.page}>
    <header className={styles.heading}>
      <span>PINO TEAM · SYSTEM</span>
      <h1>Policies</h1>
      <p>Canonical Center-scoped Workforce policies. Missing policy remains fail-closed; there is no hidden default.</p>
    </header>
    {error ? <p className={styles.ownerError}>{error}</p> : null}
    <section className={styles.panel}>
      <label className={styles.field}>Center
        <select value={centerId} onChange={(event) => setCenterId(event.target.value)}>
          {centers.map((item) => <option value={item.id} key={item.id}>{item.displayName}</option>)}
        </select>
      </label>
      <small>{center ? center.displayName + " · " + center.timeZone : "Chưa có Center."}</small>
    </section>
    <div className={styles.osPolicyGrid}>
      <article className={styles.osPolicyCard}>
        <div><strong>Future Reservation</strong><p>Giới hạn số ngày được phép bắt đầu recurring placement trước. Subscription registration fail-closed nếu policy này chưa effective.</p></div>
        <small>delivery.future_reservation.v1</small>
        <label className={styles.field}>Max days ahead
          <input type="number" min="0" max="365" value={maxDaysAhead} onChange={(event) => setMaxDaysAhead(event.target.value)} disabled={!centerId || busy === "FUTURE_RESERVATION"} />
        </label>
        <small>{futureReservation?.versions.some((version) => version.storedState === "PUBLISHED" && version.effectiveFrom && Date.parse(version.effectiveFrom) <= Date.now() && (!version.effectiveUntil || Date.parse(version.effectiveUntil) > Date.now())) ? "Effective policy active" : futureReservation?.versions.some((version) => version.storedState === "DRAFT") ? "Draft awaiting publish" : "No effective policy — recurring placement denied"}</small>
        <button className={styles.primaryButton} disabled={!centerId || busy === "FUTURE_RESERVATION"} onClick={() => void saveFutureReservationPolicy()}>
          {busy === "FUTURE_RESERVATION" ? "Publishing…" : "Save & publish"}
        </button>
      </article>
      {POLICIES.map((policy) => {
        const state = states[policy.key] ?? null;
        const now = Date.now();
        const published = state?.versions.find((version) => version.storedState === "PUBLISHED" && version.effectiveFrom && Date.parse(version.effectiveFrom) <= now && (!version.effectiveUntil || Date.parse(version.effectiveUntil) > now)) ?? null;
        const draft = state?.versions.find((version) => version.storedState === "DRAFT") ?? null;
        const enabled = published?.value.allowedActions ?? [];
        const fullyEnabled = policy.actions.every((action) => enabled.includes(action));
        return <article className={styles.osPolicyCard} key={policy.key}>
          <div><strong>{policy.title}</strong><p>{policy.description}</p></div>
          <small>{policy.key}</small>
          <div>{policy.actions.map((action) => <span className={enabled.includes(action) ? styles.writePill : undefined} key={action}>{action}{enabled.includes(action) ? " ✓" : ""}</span>)}</div>
          <small>{published ? "Published v" + published.version + " · " + (enabled.join(", ") || "no actions") : draft ? "Draft v" + draft.version + " awaiting publish" : "No effective policy — actions denied"}</small>
          <button className={styles.primaryButton} disabled={!centerId || busy === policy.key || fullyEnabled} onClick={() => void enable(policy.key, policy.actions)}>
            {busy === policy.key ? "Publishing…" : fullyEnabled ? "Enabled" : draft ? "Publish draft" : "Enable standard actions"}
          </button>
        </article>;
      })}
    </div>
  </section>;
}

function message(cause: unknown) {
  return cause instanceof Error ? cause.message : "Không thể cập nhật Workforce policy.";
}
