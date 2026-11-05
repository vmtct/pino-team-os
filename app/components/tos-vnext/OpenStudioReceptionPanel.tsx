"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Assignment, TimekeepingSession } from "@/lib/workforce-api";
import {
  walkinPassTosApi, type WalkinLookup,
} from "@/lib/open-studio-walkin-tos-api";
import {
  defaultWalkinStudentSelection, isConsumableWalkinLookup, optionalWalkinAuditShiftId,
} from "@/lib/open-studio-walkin-tos-reception";
import { TosVNextButton, TosVNextCard, TosVNextField, TosVNextStatus } from "../tos-ds";
import { ePassPhotoError, hasRequiredEPassPhoto, readEPassPhotoBase64 } from "@/lib/open-studio-walkin-evidence";
import styles from "./tos-vnext.module.css";

type BusyAction = "lookup" | "upload" | "consume" | null;

/**
 * PAP-1166 TOS Reception — real Core-backed lookup / atomic one-use consume.
 * Deliberately separate from Student Visit and the read-only Reception presentation.
 * No synthetic pass or payment receipt; Consume uses Center permission, not Workforce shift.
 */
export function OpenStudioReceptionPanel({
  centerId, workDate, assignments, session,
}: {
  centerId: string;
  workDate: string;
  assignments: readonly Assignment[];
  session: TimekeepingSession|null;
}) {
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState<WalkinLookup | null>(null);
  const [childSelection, setChildSelection] = useState("__manual__");
  const [manualChild, setManualChild] = useState("");
  const [holderConfirmed, setHolderConfirmed] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [photo,setPhoto]=useState<File|null>(null);
  const [photoPreview,setPhotoPreview]=useState<string|null>(null);
  const [photoConsent,setPhotoConsent]=useState(false);
  const [photoError,setPhotoError]=useState("");
  const photoInput=useRef<HTMLInputElement>(null);
  const photoUrl=useRef<string|null>(null);
  const pending = useRef(false);
  const epoch = useRef(0);

  // Parent keyed this component by Center and work date; on unmount discard all photo data.
  useEffect(() => () => {
    epoch.current+=1;
    if(photoUrl.current)URL.revokeObjectURL(photoUrl.current);
  }, []);
  const normalizedCode = code.trim().toUpperCase();
  const optionalShiftId=optionalWalkinAuditShiftId(assignments,session,centerId,workDate);
  const canConsume = Boolean(lookup && isConsumableWalkinLookup(lookup)
    && lookup.pass.code === normalizedCode
    && holderConfirmed && hasRequiredEPassPhoto(photo,photoConsent)
    && (childSelection === "__manual__" ? manualChild.trim().length > 0
      : lookup.students.some(student => student.id === childSelection)));

  function clearPhoto(){
    if(photoUrl.current){URL.revokeObjectURL(photoUrl.current);photoUrl.current=null;}
    setPhoto(null);setPhotoPreview(null);setPhotoError("");
    if(photoInput.current)photoInput.current.value="";
  }
  function onPhotoSelected(file:File|null){
    const reason=ePassPhotoError(file);
    if(!file||reason){clearPhoto();setPhotoError(reason??"Ảnh e-pass bắt buộc.");return;}
    if(photoUrl.current)URL.revokeObjectURL(photoUrl.current);
    photoUrl.current=URL.createObjectURL(file);
    setPhotoPreview(photoUrl.current);
    setPhoto(file);setPhotoError("");
  }
  function clearResult() {
    epoch.current += 1;
    setLookup(null);
    setChildSelection("__manual__");
    setManualChild("");
    setHolderConfirmed(false);
    setError("");
    setReceipt("");
    clearPhoto();setPhotoConsent(false);
  }

  async function findPass() {
    if (pending.current || !centerId || !normalizedCode) return;
    pending.current = true;
    const currentEpoch = ++epoch.current;
    setBusy("lookup");
    setError("");
    setReceipt("");
    setLookup(null);
    setHolderConfirmed(false);
    clearPhoto();setPhotoConsent(false);
    try {
      const found = await walkinPassTosApi.lookup(centerId, normalizedCode);
      if (epoch.current !== currentEpoch) return;
      if (found.pass.code !== normalizedCode || !found.pass.id) {
        throw new Error("Phản hồi Pass không khớp mã đã tra cứu.");
      }
      setLookup(found);
      setChildSelection(defaultWalkinStudentSelection(found));
      setManualChild("");
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
    if (pending.current || !canConsume || !lookup) return;
    pending.current = true;
    const currentEpoch = ++epoch.current;
    const capturedPhoto=photo;
    if(!capturedPhoto || !hasRequiredEPassPhoto(capturedPhoto,photoConsent))return;
    setBusy("upload");
    setError("");
    setReceipt("");
    let uploaded=false;
    try {
      const base64=await readEPassPhotoBase64(capturedPhoto);
      if(epoch.current!==currentEpoch)return;
      const evidence=await walkinPassTosApi.storeEvidence({
        centerId,code:normalizedCode,mimeType:capturedPhoto.type,base64,capturedWithConsent:true
      });
      if(epoch.current!==currentEpoch)return;
      if(evidence.status!=="STORED"||!evidence.receiptId||
        evidence.passId!==lookup.pass.id||evidence.centerId!==centerId)
        throw new Error("Core không xác nhận receipt ảnh cho đúng Pass/Center.");
      uploaded=true;
      setBusy("consume");
      const result = await walkinPassTosApi.consume({
        evidenceReceiptId:evidence.receiptId,
        centerId, code: normalizedCode, confirmedHolder: true,
        ...(optionalShiftId?{shiftId:optionalShiftId}:{}),
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
      clearPhoto();setPhotoConsent(false);
    } catch (e) {
      if (epoch.current !== currentEpoch) return;
      const message=e instanceof Error?e.message:"Không lưu được ảnh e-pass.";
      if(!uploaded){
        setError(message+" Không sử dụng Pass khi chưa lưu thành công ảnh; hãy thử lại hoặc chụp lại.");
      }else{
        setError(message+" Trạng thái consume chưa rõ; tra cứu lại trước khi thử thao tác khác.");
        setLookup(null); // The Core consume call may have committed. Fail closed.
        setHolderConfirmed(false);
        clearPhoto();setPhotoConsent(false);
      }
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
          <p className={styles.secondary}>Việc xác nhận Pass dựa trên quyền tiếp đón tại trung tâm, không yêu cầu chấm công ca.</p>
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
          <div className={styles.ePassEvidence}>
            <strong>Chụp bằng chứng e-pass · Bắt buộc</strong>
            <p className={styles.secondary}>Yêu cầu PH mở tin nhắn e-pass nhận trực tiếp từ channel PINO trên điện thoại PH. Chỉ chụp phần e-pass, không chụp nội dung chat khác. Ảnh là evidence, không thay thế đối chiếu chính chủ.</p>
            <label>
              <input type="checkbox" checked={photoConsent} disabled={Boolean(busy)}
                onChange={e=>{setPhotoConsent(e.target.checked);if(!e.target.checked)clearPhoto();}}/>
              {" "}PH đã đồng ý cho chụp tin nhắn e-pass.
            </label>
            <input className={styles.ePassPhotoInput} ref={photoInput} type="file"
              accept="image/jpeg,image/png,image/webp" capture="environment"
              aria-label="Ảnh e-pass bắt buộc" disabled={Boolean(busy)}
              onChange={e=>onPhotoSelected(e.target.files?.[0]??null)}/>
            <TosVNextButton variant="secondary" disabled={Boolean(busy)||!photoConsent}
              onClick={()=>photoInput.current?.click()}>{photo?"Chụp lại ảnh e-pass":"Chụp bằng chứng e-pass"}</TosVNextButton>
            {photoPreview && <figure className={styles.ePassPhotoPreview}>
              <Image src={photoPreview} alt="Xem trước ảnh e-pass từ điện thoại PH" width={640} height={480} unoptimized/>
              <figcaption>Ảnh chỉ mới chọn trên thiết bị; Core sẽ lưu riêng tư và trả receipt trước khi consume.</figcaption>
            </figure>}
            {photo && <TosVNextButton variant="quiet" disabled={Boolean(busy)}
              onClick={clearPhoto}>Bỏ ảnh và chụp lại</TosVNextButton>}
            {photoError&&<p role="alert" className={styles.trainingError}>{photoError}</p>}
            {!hasRequiredEPassPhoto(photo,photoConsent)&&
              <p role="status" className={styles.secondary}>Chưa đủ bằng chứng ảnh và sự đồng ý của PH — không thể sử dụng Pass.</p>}
          </div>
          <label>
            <input type="checkbox" checked={holderConfirmed} disabled={Boolean(busy)}
              onChange={e => setHolderConfirmed(e.target.checked)}/>
            {" "}Tôi đã kiểm tra mã Pass, Path, phụ huynh và trẻ thực tế tại quầy.
          </label>
          <TosVNextButton onClick={() => void consumePass()} disabled={Boolean(busy) || !canConsume}>
            {busy === "upload" ? "Đang lưu ảnh e-pass…" : busy === "consume" ? "Đang xác minh…" : "Xác nhận sử dụng Pass"}
          </TosVNextButton>
        </>}
    </>}
  </TosVNextCard>;
}
