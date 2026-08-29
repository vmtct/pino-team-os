"use client";

import { useMemo, useRef, useState } from "react";
import {
  toppiStagingApi,
  type ToppiDeliverySlot,
  type ToppiEnrollment,
} from "@/lib/toppi-staging-api";
import styles from "../toppi-bo.module.css";

type Props = {
  enrollment: ToppiEnrollment;
  slots: ToppiDeliverySlot[];
  onChanged: (message: string) => Promise<void> | void;
  onError: (message: string) => void;
};

export function EnrollmentActions({ enrollment, slots, onChanged, onError }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState("");
  const [destinationSlotId, setDestinationSlotId] = useState("");
  const [reason, setReason] = useState("Schedule change");
  const [transferLocalDate, setTransferLocalDate] = useState(localDateOffset(1));
  const alternatives = useMemo(() => slots.filter((slot) =>
    slot.status === "ACTIVE" && slot.id !== enrollment.currentPlacement?.slot.id && slot.available > 0
  ), [enrollment.currentPlacement?.slot.id, slots]);

  async function run(label: string, task: () => Promise<unknown>, message: string) {
    setBusy(label); onError("");
    try { await task(); await onChanged(message); return true; }
    catch (cause) { onError(cause instanceof Error ? cause.message : "Toppi operation failed."); return false; }
    finally { setBusy(""); }
  }

  function openTransfer() {
    if (!enrollment.currentPlacement || !alternatives[0]) return;
    setDestinationSlotId(alternatives[0].id);
    setReason("Schedule change");
    setTransferLocalDate(localDateOffset(1));
    dialogRef.current?.showModal();
  }

  async function transfer() {
    const source = enrollment.currentPlacement;
    if (!source || !destinationSlotId || !reason.trim()) return;
    const changed = await run("transfer", () => toppiStagingApi.transferEnrollment({
      enrollmentId: enrollment.id,
      sourcePlacementId: source.id,
      sourceExpectedRevision: source.revision,
      destinationSlotId,
      transferLocalDate,
      reason: reason.trim(),
    }), "Schedule placement transferred in canonical Core staging.");
    if (changed) dialogRef.current?.close();
  }

  const successorActivationLocked = enrollment.lifecycle === "DRAFT" && Boolean(enrollment.predecessorEnrollmentId);
  const renewalPrepared = enrollment.renewalState === "DRAFT_PREPARED";

  return (
    <>
      <div className={styles.actionRow}>
        {enrollment.lifecycle === "DRAFT" ? (
          <button
            className={styles.primaryButton}
            disabled={Boolean(busy) || successorActivationLocked}
            title={successorActivationLocked ? "Successor activation is fail-closed until mandatory-break resolution lands" : undefined}
            onClick={() => void run("activate", () => toppiStagingApi.activateEnrollment(enrollment.id, enrollment.revision, localToday()), "Enrollment activated in canonical Core staging.")}
          >
            {busy === "activate" ? "Activating…" : successorActivationLocked ? "Activation locked" : "Activate"}
          </button>
        ) : null}
        <button
          className={styles.secondaryButton}
          disabled={Boolean(busy) || !enrollment.currentPlacement || alternatives.length === 0}
          onClick={openTransfer}
        >
          {busy === "transfer" ? "Transferring…" : "Change schedule"}
        </button>
        <button
          className={styles.primaryButton}
          disabled={Boolean(busy) || enrollment.renewalState !== "ELIGIBLE" || enrollment.level >= 10}
          title={renewalPrepared ? "Successor package already prepared" : undefined}
          onClick={() => void run("renewal", () => toppiStagingApi.prepareRenewal(enrollment.id, enrollment.revision), "Successor Level package prepared as DRAFT in canonical Core staging.")}
        >
          {busy === "renewal" ? "Preparing…" : renewalPrepared ? "Renewal prepared" : "Prepare renewal"}
        </button>
      </div>

      <dialog ref={dialogRef} className={styles.dialog}>
        <div className={styles.dialogHead}>
          <div><h2>Change schedule</h2><p>Transfer the effective placement without rewriting enrollment history.</p></div>
          <button onClick={() => dialogRef.current?.close()} aria-label="Close">×</button>
        </div>
        <div className={styles.dialogBody}>
          <div className={styles.formGrid}>
            <label className={styles.field}>Destination slot
              <select value={destinationSlotId} onChange={(event) => setDestinationSlotId(event.target.value)}>
                {alternatives.map((slot) => <option value={slot.id} key={slot.id}>{slotLabel(slot)} · {slot.available} open</option>)}
              </select>
            </label>
            <label className={styles.field}>Effective date
              <input type="date" min={localDateOffset(1)} value={transferLocalDate} onChange={(event) => setTransferLocalDate(event.target.value)} />
            </label>
            <label className={styles.field}>Reason
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
            </label>
          </div>
          <div className={styles.wizardFooter}>
            <button className={styles.secondaryButton} disabled={Boolean(busy)} onClick={() => dialogRef.current?.close()}>Cancel</button>
            <button className={styles.primaryButton} disabled={Boolean(busy) || !destinationSlotId || !transferLocalDate || !reason.trim()} onClick={() => void transfer()}>
              {busy === "transfer" ? "Transferring…" : "Confirm transfer"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

function slotLabel(slot: ToppiDeliverySlot) {
  const weekday = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"][slot.weekdayIso] ?? `D${slot.weekdayIso}`;
  return `${weekday} · ${slot.startsLocal}–${slot.endsLocal}`;
}

function localToday() { return localDateOffset(0); }
function localDateOffset(days: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(Date.now() + days * 86_400_000));
}
