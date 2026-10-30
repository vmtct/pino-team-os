"use client";

import { useEffect, useRef, useState } from "react";
import type { Assignment, TimekeepingSession } from "@/lib/workforce-api";
import { workforceApi } from "@/lib/workforce-api";
import {
  walkinPassTosApi, type WalkinLookup,
} from "@/lib/open-studio-walkin-tos-api";
import {
  currentReceptionSession, defaultWalkinStudentSelection, isConsumableWalkinLookup,
} from "@/lib/open-studio-walkin-tos-reception";
import { TosVNextButton, TosVNextCard, TosVNextField, TosVNextStatus } from "../tos-ds";
import styles from "./tos-vnext.module.css";

type BusyAction = "lookup" | "consume" | null;

/**
 * PAP-1166 TOS Reception — real Core-backed lookup / atomic one-use consume.
 * Deliberately separate from Student Visit and the read-only Reception presentation.
 * No synthetic pass or payment receipt, no bypass of a live shift or Center.
 */
export function OpenStudioReceptionPanel({
  centerId, workDate, assignments,
}: {
  centerId: string;
  workDate: string;
  assignments: readonly Assignment[];
}) {
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState<WalkinLookup | null>(null);
  const [session, setSession] = useState<TimekeepingSession | null>(null);
  const [childSelection, setChildSelection] = useState("__manual__");
  const [manualChild, setManualChild] = useState("");
  const [holderConfirmed, setHolderConfirmed] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const pending = useRef(false);
  const epoch = useRef(0);

  // Invalidate delayed responses on unmount/Center switch.
  useEffect(() => () => { epoch.current += 1; }, []);
  const verifiedSession = currentReceptionSession(assignments, session, centerId, workDate);
  const normalizedCode = code.trim().toUpperCase();
  const canConsume = Boolean(lookup && isConsumableWalkinLookup(lookup)
    && lookup.pass.code === normalizedCode && verifiedSession
    && holderConfirmed && (childSelection === "__manual__" ? manualChild.trim().length > 0
      : lookup.students.some(student => student.id === childSelection)));

  function clearResult() {
    epoch.current += 1;
    setLookup(null);
    setSession(null);
    setChildSelection("__manual__");
    setManualChild("");
    setHolderConfirmed(false);
    setError("");
    setReceipt("");
  }

  async function findPass() {
    if (pending.current || !centerId || !normalizedCode) return;
    pending.current = true;
    const currentEpoch = ++epoch.current;
    setBusy("lookup");
    setError("");
    setReceipt("");
    setLookup(null);
    setSession(null);
    setHolderConfirmed(false);
    try {
      const [found, sessionResponse] = await Promise.all([
        walkinPassTosApi.lookup(centerId, normalizedCode),
        workforceApi.currentTimekeeping(centerId),
      ]);
      if (epoch.current !== currentEpoch) return;
      if (found.pass.code !== normalizedCode || !found.pass.id) {
        throw new Error("Phản hồi Pass không khớp mã đã tra cứu.");
      }
      setLookup(found);
      setChildSelection(defaultWalkinStudentSelection(found));
      setManualChild("");
      setSession(sessionResponse.data ?? null);
    } catch (e) {
      if (epoch.current === currentEpoch) setError(
        e instanceof Error ? e.message : "Không tra cứu được Pass ở trung tâm này.",
      );
    } finally {
      if (epoch.current === currentEpoch) {
        pending.current = false;
        setBusy(null);
      }
    }
  }

  async function consumePass() {
    if (pending.current || !canConsume || !lookup || !verifiedSession) return;
    pending.current = true;
    const currentEpoch = ++epoch.current;
    setBusy("consume");
    setError("");
    setReceipt("");
    try {
      // Re-read the actual timekeeping session immediately before the mutation.
      const live = await workforceApi.currentTimekeeping(centerId);
      if (!currentReceptionSession(assignments, live.data ?? null, centerId, workDate)
        || live.data?.id !== verifiedSession.id) {
        throw new Error("Ca tiếp tân đã thay đổi. Hãy chấm công và tra cứu Pass lại.");
      }
      const result = await walkinPassTosApi.consume({
        centerId, code: normalizedCode, shiftId: verifiedSession.id, confirmedHolder: true,
        ...(childSelection === "__manual__"
          ? { manualChildName: manualChild.trim() }
          : { studentId: childSelection }),
      });
      if (epoch.current !== currentEpoch) return;
      if (result.status !== "CONSUMED" || result.id !== lookup.pass.id) {
        throw new Error("Chưa xác minh được kết quả consume từ Core.");
      }
      setReceipt("Đã sử dụng Pass thành công. Core xác nhận trạng thái CONSUMED.");
      // Lock the old Pass; never allow another consume based on an earlier lookup.
      setLookup(null);
      setHolderConfirmed(false);
    } catch (e) {
      if (epoch.current !== currentEpoch) return;
      setError((e instanceof Error ? e.message : "Chưa xác minh được thao tác.")
        + " Tra cứu lại trạng thái Pass trước khi thử thao tác khác.");
      setLookup(null); // Failure might have committed. Fail closed, do not retry blindly.
      setHolderConfirmed(false);
    } finally {
      if (epoch.current === currentEpoch) {
        pending.current = false;
        setBusy(null);
      }
    }
  }

  return <TosVNextCard>
    <h3>Trạm Nghệ Thuật · Kiểm tra Pass</h3>
    <p className={styles.secondary}>Tra mã một lần và xác minh phụ huynh tại quầy. Không dùng để thu tiền walk-in.</p>
    <TosVNextField label="Mã Pass">
      <input aria-label="Mã Pass Trạm Nghệ Thuật" value={code} maxLength={30}
        disabled={Boolean(busy)} placeholder="Nhập mã trên e-pass"
        onChange={e => { setCode(e.target.value.toUpperCase()); clearResult(); }}
        onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault(); void findPass();
        } }}/>
    </TosVNextField>
    <TosVNextButton onClick={() => void findPass()} disabled={Boolean(busy) || !centerId || !normalizedCode}>
      {busy === "lookup" ? "Đang tra cứu…" : "Tra cứu Pass"}
    </TosVNextButton>
    {error && <p role="alert" className={styles.trainingError}>{error}</p>}
    {receipt && <p role="status">{receipt}</p>}
    {lookup && <>
      <p><strong>Trạng thái:</strong> <TosVNextStatus>{lookup.pass.status}</TosVNextStatus></p>
      <p><strong>Path:</strong> {lookup.pass.path_code || "Chưa gắn Path"}</p>
      <p><strong>Phụ huynh:</strong> {lookup.parentName || lookup.pass.parent_user_id || "Chưa gắn"}</p>
      {!isConsumableWalkinLookup(lookup)
        ? <p role="status" className={styles.secondary}>Pass không ở trạng thái ASSIGNED hợp lệ tại trung tâm này. Không thể sử dụng.</p>
        : <>
          {verifiedSession
            ? <p className={styles.secondary}>Ca đang OPEN tại đúng Center. Phiên: {verifiedSession.id}</p>
            : <p role="status" className={styles.trainingError}>Không có ca tiếp tân đang chấm công hợp lệ. Cần check-in đúng ca trước khi consume.</p>}
          <TosVNextField label="Học viên sử dụng Pass">
            <select aria-label="Học viên sử dụng Pass" value={childSelection} disabled={Boolean(busy)}
              onChange={e => { setChildSelection(e.target.value); setHolderConfirmed(false); }}>
              {lookup.students.map(student =>
                <option key={student.id} value={student.id}>{student.name}</option>)}
              <option value="__manual__">Trẻ chưa có trong danh sách · nhập tên thủ công</option>
            </select>
          </TosVNextField>
          {childSelection === "__manual__" &&
            <TosVNextField label="Tên trẻ (fallback thủ công)">
              <input aria-label="Tên trẻ nhập thủ công" value={manualChild} maxLength={120}
                disabled={Boolean(busy)} onChange={e => { setManualChild(e.target.value); setHolderConfirmed(false); }}
                placeholder="Họ tên trẻ đã xác minh tại quầy"/>
            </TosVNextField>}
          <label>
            <input type="checkbox" checked={holderConfirmed} disabled={Boolean(busy) || !verifiedSession}
              onChange={e => setHolderConfirmed(e.target.checked)}/>
            {" "}Tôi đã kiểm tra mã Pass, Path, phụ huynh và trẻ thực tế tại quầy.
          </label>
          <TosVNextButton onClick={() => void consumePass()} disabled={Boolean(busy) || !canConsume}>
            {busy === "consume" ? "Đang xác minh…" : "Xác nhận sử dụng Pass"}
          </TosVNextButton>
        </>}
    </>}
  </TosVNextCard>;
}
