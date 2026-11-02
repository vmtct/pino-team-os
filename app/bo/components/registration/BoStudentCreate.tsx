"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { boApi, BoApiError, type BoStudentIntakeCreateInput } from "@/lib/bo-api";
import type { BoParentSearchResult } from "@/lib/bo-model";
import { useBoDialog } from "./useBoDialog";

type ParentResults =
  | { state: "loading" }
  | { state: "ready"; data: BoParentSearchResult[] }
  | { state: "error"; message: string };
type Attempt = { body: BoStudentIntakeCreateInput; idempotencyKey: string };

function message(cause: unknown) {
  return cause instanceof Error && cause.message ? cause.message : "Không thể tạo học viên. Hãy thử lại.";
}

function Property({ label, icon, children }: { label: string; icon: string; children: ReactNode }) {
  return <div className="property-row"><div className="property-label"><small aria-hidden="true">{icon}</small>{label}</div><div className="property-control">{children}</div></div>;
}

/** Student Intake uses the same BO drawer/property primitives and the existing canonical command. */
export function BoStudentCreate({ onClose, onCreated }: { onClose: () => void; onCreated: (studentId: string) => void }) {
  const panel = useRef<HTMLElement>(null);
  const busyRef = useRef(false);
  const attemptRef = useRef<Attempt | null>(null);
  const [studentName, setStudentName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [relationshipType, setRelationshipType] = useState<"PARENT" | "GUARDIAN" | "OTHER">("PARENT");
  const [parentMode, setParentMode] = useState<"EXISTING" | "NEW">("EXISTING");
  const [parentQuery, setParentQuery] = useState("");
  const [parentResults, setParentResults] = useState<ParentResults>({ state: "loading" });
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [guardianName, setGuardianName] = useState("");
  const [contactType, setContactType] = useState<"PHONE" | "EMAIL">("PHONE");
  const [contactValue, setContactValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [canResetAttempt, setCanResetAttempt] = useState(false);
  const uncertainAttempt = attempt !== null && Boolean(error) && !canResetAttempt;
  const locked = attempt !== null;

  useEffect(() => {
    if (parentMode !== "EXISTING" || locked) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setParentResults({ state: "loading" });
      void boApi.parents(parentQuery, 20).then(data => {
        if (!active) return;
        setParentResults({ state: "ready", data });
        setSelectedParentId(current => current && data.some(item => item.parent.id === current) ? current : null);
      }).catch((cause: unknown) => { if (active) setParentResults({ state: "error", message: message(cause) }); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [locked, parentMode, parentQuery]);

  const selectedParent = parentResults.state === "ready" ? parentResults.data.find(item => item.parent.id === selectedParentId) : null;
  function closeIfSafe() { if (!busyRef.current && !uncertainAttempt) onClose(); }
  useBoDialog(true, closeIfSafe, panel);
  function resetAttempt() { attemptRef.current = null; setAttempt(null); setCanResetAttempt(false); setError(""); }
  function switchMode(next: "EXISTING" | "NEW") {
    if (locked) return;
    setParentMode(next); setSelectedParentId(null); setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    const selectedParentReady = parentResults.state === "ready" && selectedParentId !== null && parentResults.data.some(item => item.parent.id === selectedParentId);
    if (!attemptRef.current && parentMode === "EXISTING" && !selectedParentReady) {
      setError("Chọn phụ huynh từ kết quả tìm kiếm hiện tại trước khi tạo học viên.");
      return;
    }
    if (!attemptRef.current && (!studentName.trim() || (parentMode === "NEW" && !contactValue.trim()))) {
      setError("Hãy nhập tên học viên và thông tin liên hệ bắt buộc.");
      return;
    }
    const currentAttempt = attemptRef.current ?? (() => {
      const [birthYear, birthMonth, birthDay] = birthDate ? birthDate.split("-").map(Number) : [null, null, null];
      const common = {
        displayName: studentName.trim(), birthYear, birthMonth, birthDay,
        birthPrecision: birthDate ? "FULL_DATE" as const : "UNKNOWN" as const,
        relationshipType, effectiveFrom: new Date().toISOString(),
      };
      return {
        idempotencyKey: crypto.randomUUID(),
        body: parentMode === "EXISTING"
          ? { ...common, existingParentUserId: selectedParentId! }
          : { ...common, guardianDisplayName: guardianName.trim() || null, contactType, contactValue: contactValue.trim() },
      };
    })();
    attemptRef.current = currentAttempt;
    setAttempt(currentAttempt);
    busyRef.current = true; setBusy(true); setError(""); setCanResetAttempt(false);
    try {
      const result = await boApi.createStudentIntake(currentAttempt.body, currentAttempt.idempotencyKey);
      onCreated(result.studentProfileId);
    } catch (cause) {
      setError(message(cause));
      setCanResetAttempt(cause instanceof BoApiError && cause.structuredResponse && cause.status >= 400 && cause.status < 500);
    } finally { busyRef.current = false; setBusy(false); }
  }

  return <><div className="drawer-scrim visible" id="drawer-scrim" onClick={closeIfSafe} aria-hidden="true" />
    <aside ref={panel} id="drawer" className="drawer open" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="drawer-top"><div className="drawer-header-copy"><span id="drawer-path" className="drawer-path">Students</span><h2 id="drawer-title" className="drawer-record-title">Tạo học viên</h2></div><button id="drawer-close" className="drawer-close" type="button" aria-label="Đóng" disabled={busy || uncertainAttempt} onClick={closeIfSafe}>×</button></div>
      <div id="drawer-content" className="drawer-content">
        <form id="student-create-form" onSubmit={event => void submit(event)}>
          <section className="property-section"><h3>Học viên</h3>
            <Property label="Học viên" icon="Aa"><input className="edit-input" aria-label="Tên học viên" required disabled={locked} value={studentName} onChange={event => { setStudentName(event.target.value); setError(""); }} placeholder="Tên học viên" /></Property>
            <Property label="Ngày sinh" icon="▦"><input className="edit-input" aria-label="Ngày sinh" type="date" disabled={locked} value={birthDate} onChange={event => setBirthDate(event.target.value)} /></Property>
            <Property label="Quan hệ" icon="▣"><select className="edit-input" aria-label="Quan hệ" disabled={locked} value={relationshipType} onChange={event => setRelationshipType(event.target.value as typeof relationshipType)}><option value="PARENT">Cha/Mẹ</option><option value="GUARDIAN">Người giám hộ</option><option value="OTHER">Khác</option></select></Property>
          </section>
          <section className="property-section"><h3>Phụ huynh / người giám hộ</h3>
            <div className="option-list" aria-label="Cách liên kết phụ huynh"><button type="button" className="option-item" aria-pressed={parentMode === "EXISTING"} disabled={locked} onClick={() => switchMode("EXISTING")}>Chọn phụ huynh hiện có</button><button type="button" className="option-item" aria-pressed={parentMode === "NEW"} disabled={locked} onClick={() => switchMode("NEW")}>Tạo phụ huynh mới</button></div>
            {parentMode === "EXISTING" ? <>
              <Property label="Tìm phụ huynh" icon="⌕"><input className="edit-input" aria-label="Tìm theo tên, SĐT hoặc email" type="search" disabled={locked} value={parentQuery} onChange={event => { setParentQuery(event.target.value); setSelectedParentId(null); setParentResults({ state: "loading" }); setError(""); }} placeholder="Tên, SĐT hoặc email" /></Property>
              <Property label="Kết quả" icon="↗"><div className="option-list" aria-live="polite">
                {parentResults.state === "loading" ? <span>Đang tìm phụ huynh…</span> : null}
                {parentResults.state === "error" ? <span className="edit-error" role="alert">{parentResults.message}</span> : null}
                {parentResults.state === "ready" && !parentResults.data.length ? <span>Không tìm thấy Parent phù hợp.</span> : null}
                {parentResults.state === "ready" ? parentResults.data.map(item => <button type="button" className="option-item" key={item.parent.id} aria-pressed={item.parent.id === selectedParentId} disabled={locked} onClick={() => { setSelectedParentId(item.parent.id); setError(""); }}><span className="option-check" aria-hidden="true">{item.parent.id === selectedParentId ? "✓" : "＋"}</span>{item.parent.displayName || "Parent chưa đặt tên"}<small>{item.contacts.map(contact => `${contact.identifierType === "PHONE" ? "SĐT" : "Email"} · ${contact.normalizedValue}`).join(" · ") || "Chưa có contact active"}</small></button>) : null}
              </div></Property>
              {selectedParent ? <p className="settings-hint">Đã chọn: {selectedParent.parent.displayName || selectedParent.parent.id}</p> : null}
            </> : <>
              <Property label="Tên phụ huynh" icon="Aa"><input className="edit-input" aria-label="Tên phụ huynh / người giám hộ" disabled={locked} value={guardianName} onChange={event => setGuardianName(event.target.value)} placeholder="Tên phụ huynh" /></Property>
              <Property label="Liên hệ" icon="▣"><select className="edit-input" aria-label="Loại liên hệ" disabled={locked} value={contactType} onChange={event => { setContactType(event.target.value as typeof contactType); setContactValue(""); }}><option value="PHONE">Số điện thoại</option><option value="EMAIL">Email</option></select></Property>
              <Property label={contactType === "PHONE" ? "Số điện thoại" : "Email"} icon="Aa"><input className="edit-input" aria-label={contactType === "PHONE" ? "Số điện thoại phụ huynh" : "Email phụ huynh"} type={contactType === "PHONE" ? "tel" : "email"} required disabled={locked} value={contactValue} onChange={event => { setContactValue(event.target.value); setError(""); }} placeholder={contactType === "PHONE" ? "Số điện thoại" : "Email"} /></Property>
            </>}
          </section>
          {error ? <div className="edit-error" role="alert">{error}{uncertainAttempt ? <p>Kết quả chưa xác định. Hãy thử lại cùng yêu cầu để đối soát an toàn.</p> : null}</div> : null}
        </form>
      </div>
      <div id="drawer-footer" className="drawer-footer"><div className="lab-bottom">{locked && error && canResetAttempt ? <button type="button" className="secondary-btn" disabled={busy} onClick={resetAttempt}>Sửa dữ liệu</button> : null}<button type="button" className="secondary-btn" disabled={busy || uncertainAttempt} onClick={closeIfSafe}>Hủy</button><button type="submit" form="student-create-form" className="primary-btn" id="create-save" disabled={busy}>{busy ? "Đang tạo…" : locked ? "Thử lại cùng yêu cầu" : "＋ Tạo học viên"}</button></div></div>
    </aside>
  </>;
}
