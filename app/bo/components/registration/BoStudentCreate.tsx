"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { BoQuickView } from "./BoQuickView";
import { useBoCenterSelection } from "./BoCenterSelection";
import { PropertySections, type CreateDrawerField } from "@/app/components/workspace-renderer/Properties";
import type { BoField, BoModule, BoRecord, BoValue } from "@/lib/bo-registration";
import { BoApiError, type BoStudentIntakeCreateInput } from "@/lib/bo-api";
import { studentIntakeCenterApi } from "@/lib/bo-student-intake-center-client";
import type { BoParentSearchResult } from "@/lib/bo-model";

type ParentResults =
  | { state: "loading" }
  | { state: "ready"; centerId: string; data: BoParentSearchResult[] }
  | { state: "error"; message: string };
type Attempt = { body: BoStudentIntakeCreateInput; idempotencyKey: string; centerId: string };
type StudentBirthDate = Pick<BoStudentIntakeCreateInput, "birthYear" | "birthMonth" | "birthDay" | "birthPrecision">;
type ParsedBirthDate = { ok: true; value: StudentBirthDate } | { ok: false; error: string };

function parseStudentBirthDate(dayInput: string, monthInput: string, yearInput: string): ParsedBirthDate {
  const dayText = dayInput.trim();
  const monthText = monthInput.trim();
  const yearText = yearInput.trim();
  if (!dayText && !monthText && !yearText) {
    return { ok: true, value: { birthYear: null, birthMonth: null, birthDay: null, birthPrecision: "UNKNOWN" } };
  }
  if (!yearText) return { ok: false, error: "Nhập năm sinh trước khi nhập tháng hoặc ngày." };
  if (!/^\d{4}$/.test(yearText) || Number(yearText) < 1900) {
    return { ok: false, error: "Năm sinh cần đủ 4 chữ số và từ năm 1900 trở lên." };
  }
  const birthYear = Number(yearText);
  if (monthText && (!/^\d{1,2}$/.test(monthText) || Number(monthText) < 1 || Number(monthText) > 12)) {
    return { ok: false, error: "Tháng sinh phải từ 1 đến 12." };
  }
  if (dayText && !monthText) return { ok: false, error: "Nhập tháng sinh khi đã nhập ngày." };
  if (!monthText) {
    return { ok: true, value: { birthYear, birthMonth: null, birthDay: null, birthPrecision: "YEAR_ONLY" } };
  }
  const birthMonth = Number(monthText);
  if (!dayText) {
    return { ok: true, value: { birthYear, birthMonth, birthDay: null, birthPrecision: "YEAR_MONTH" } };
  }
  if (!/^\d{1,2}$/.test(dayText)) return { ok: false, error: "Ngày sinh phải từ 1 đến 31." };
  const birthDay = Number(dayText);
  const daysInMonth = new Date(birthYear, birthMonth, 0).getDate();
  if (birthDay < 1 || birthDay > daysInMonth) {
    return { ok: false, error: "Ngày sinh không hợp lệ theo tháng và năm đã nhập." };
  }
  return { ok: true, value: { birthYear, birthMonth, birthDay, birthPrecision: "FULL_DATE" } };
}

function message(cause: unknown) {
  return cause instanceof Error && cause.message ? cause.message : "Không thể tạo học viên. Hãy thử lại.";
}

/** PAP-1908 / SCH-STUDENT-MGMT: changing Center remounts the form, never reuses Parent or replay state. */
export function BoStudentCreate({ onClose, onCreated }: { onClose: () => void; onCreated: (studentId: string) => void }) {
  // A Center selector is only a hint. Core independently authorizes every resource.
  const selectedCenter = useBoCenterSelection();
  const centerId = selectedCenter && !selectedCenter.loading && !selectedCenter.error &&
    selectedCenter.centers.some(center => center.id === selectedCenter.selected)
    ? selectedCenter.selected : "";
  return <BoStudentCreateScoped key={centerId} centerId={centerId} onClose={onClose} onCreated={onCreated} />;
}

function BoStudentCreateScoped({ centerId, onClose, onCreated }: {
  centerId: string; onClose: () => void; onCreated: (studentId: string) => void;
}) {
  // An in-flight request can finish at the old Center; never publish the old result after remount.
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const busyRef = useRef(false);
  const attemptRef = useRef<Attempt | null>(null);
  const [studentName, setStudentName] = useState("");
  const [birthDayInput, setBirthDayInput] = useState("");
  const [birthMonthInput, setBirthMonthInput] = useState("");
  const [birthYearInput, setBirthYearInput] = useState("");
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
    if (!centerId) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setParentResults({ state: "loading" });
      void studentIntakeCenterApi.parentsInCenter(centerId, parentQuery, 20).then(data => {
        if (!active) return;
        setParentResults({ state: "ready", centerId, data });
        setSelectedParentId(current => current && data.some(item => item.parent.id === current) ? current : null);
      }).catch((cause: unknown) => { if (active) setParentResults({ state: "error", message: message(cause) }); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [centerId, locked, parentMode, parentQuery]);

  const selectedParent = parentResults.state === "ready" && parentResults.centerId === centerId
    ? parentResults.data.find(item => item.parent.id === selectedParentId) : null;
  function closeIfSafe() { if (!busyRef.current && !uncertainAttempt) onClose(); }
  function resetAttempt() { attemptRef.current = null; setAttempt(null); setCanResetAttempt(false); setError(""); }
  function switchMode(next: "EXISTING" | "NEW") {
    if (locked) return;
    setParentMode(next); setSelectedParentId(null); setError("");
  }

  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busyRef.current) return;
    if (!centerId) {
      setError("Chọn cơ sở được cấp quyền trước khi tạo học viên.");
      return;
    }
    if (attemptRef.current && attemptRef.current.centerId !== centerId) {
      setError("Cơ sở đã thay đổi. Đóng và mở lại thao tác để tránh tạo học viên sai cơ sở.");
      return;
    }
    const selectedParentReady = parentResults.state === "ready" && parentResults.centerId === centerId &&
      selectedParentId !== null && parentResults.data.some(item => item.parent.id === selectedParentId);
    if (!attemptRef.current && parentMode === "EXISTING" && !selectedParentReady) {
      setError("Chọn phụ huynh từ kết quả tìm kiếm hiện tại trước khi tạo học viên.");
      return;
    }
    if (!attemptRef.current && (!studentName.trim() || (parentMode === "NEW" && !contactValue.trim()))) {
      setError("Hãy nhập tên học viên và thông tin liên hệ bắt buộc.");
      return;
    }
    let currentAttempt = attemptRef.current;
    if (!currentAttempt) {
      const parsedBirthDate = parseStudentBirthDate(birthDayInput, birthMonthInput, birthYearInput);
      if (!parsedBirthDate.ok) {
        setError(parsedBirthDate.error);
        return;
      }
      const common = {
        displayName: studentName.trim(), ...parsedBirthDate.value,
        relationshipType, effectiveFrom: new Date().toISOString(),
      };
      currentAttempt = {
        idempotencyKey: crypto.randomUUID(),
        centerId,
        body: parentMode === "EXISTING"
          ? { ...common, existingParentUserId: selectedParentId! }
          : { ...common, guardianDisplayName: guardianName.trim() || null, contactType, contactValue: contactValue.trim() },
      };
    }
    attemptRef.current = currentAttempt;
    setAttempt(currentAttempt);
    busyRef.current = true; setBusy(true); setError(""); setCanResetAttempt(false);
    try {
      const result = await studentIntakeCenterApi.createStudentIntakeInCenter(currentAttempt.centerId, currentAttempt.body, currentAttempt.idempotencyKey);
      if (mountedRef.current) onCreated(result.studentProfileId);
    } catch (cause) {
      if (mountedRef.current) {
        setError(message(cause));
        setCanResetAttempt(cause instanceof BoApiError && cause.structuredResponse && cause.status >= 400 && cause.status < 500);
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }

  const parentFieldKeys = parentMode === "EXISTING"
    ? ["parentMode", "parentQuery", "selectedParentId"]
    : ["parentMode", "guardianName", "contactType", "contactValue"];
  const schema: BoField[] = [
    { key: "name", label: "Học viên", type: "text", icon: "Aa", w: 180 },
    { key: "birthDate", label: "Sinh Nhật", type: "date", icon: "▦", w: 140 },
    { key: "relationshipType", label: "Quan hệ", type: "select", icon: "▣", w: 130 },
    { key: "parentMode", label: "Liên kết phụ huynh", type: "select", icon: "▣", w: 160 },
    { key: "parentQuery", label: "Tìm phụ huynh", type: "text", icon: "⌕", w: 160 },
    { key: "selectedParentId", label: "Kết quả", type: "relation", icon: "↗", w: 180 },
    { key: "guardianName", label: "Tên phụ huynh", type: "text", icon: "Aa", w: 180 },
    { key: "contactType", label: "Liên hệ", type: "select", icon: "▣", w: 130 },
    { key: "contactValue", label: "Số điện thoại / Email", type: "text", icon: "Aa", w: 180 },
  ];
  const studentKeys = ["name", "birthDate", "relationshipType"];
  const studentFields = schema.filter(field => studentKeys.includes(field.key));
  const parentFields = schema.filter(field => parentFieldKeys.includes(field.key));
  const relationshipLabels = { PARENT: "Cha/Mẹ", GUARDIAN: "Người giám hộ", OTHER: "Khác" } as const;
  const record: BoRecord = {
    id: "", name: studentName, birthDate: null, relationshipType: relationshipLabels[relationshipType],
    parentMode, parentQuery, selectedParentId: selectedParent?.parent.displayName ?? null,
    guardianName, contactType, contactValue,
  };
  const studentCreateFields: Record<string, CreateDrawerField> = {
    birthDate: {
      id: "student-create-birth-day", label: "Sinh Nhật", value: birthDayInput, disabled: locked,
      onChange: value => { setBirthDayInput(value.replace(/\D/g, "").slice(0, 2)); setError(""); },
      control: <div data-student-create-birthday="" role="group" aria-label="Sinh Nhật">
        <input id="student-create-birth-day" className="edit-input" data-student-create-birth-part="day"
          type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} aria-label="Sinh Nhật - ngày"
          placeholder="dd" value={birthDayInput} disabled={locked}
          onChange={event => { setBirthDayInput(event.target.value.replace(/\D/g, "").slice(0, 2)); setError(""); }} />
        <input id="student-create-birth-month" className="edit-input" data-student-create-birth-part="month"
          type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} aria-label="Sinh Nhật - tháng"
          placeholder="mm" value={birthMonthInput} disabled={locked}
          onChange={event => { setBirthMonthInput(event.target.value.replace(/\D/g, "").slice(0, 2)); setError(""); }} />
        <input id="student-create-birth-year" className="edit-input" data-student-create-birth-part="year"
          type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} aria-label="Sinh Nhật - năm"
          placeholder="yyyy" value={birthYearInput} disabled={locked}
          onChange={event => { setBirthYearInput(event.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }} />
      </div>,
    },
  };
  const createFields: Record<string, CreateDrawerField> = {
    parentMode: {
      id: "student-create-parent-mode", value: parentMode, onChange: v => switchMode(v as typeof parentMode),
      control: <div id="student-create-parent-mode" className="option-list" aria-label="Cách liên kết phụ huynh">
        <button type="button" className="option-item" aria-pressed={parentMode === "EXISTING"}
          disabled={locked} onClick={() => switchMode("EXISTING")}>Chọn phụ huynh hiện có</button>
        <button type="button" className="option-item" aria-pressed={parentMode === "NEW"}
          disabled={locked} onClick={() => switchMode("NEW")}>Tạo phụ huynh mới</button>
      </div>,
    },
    parentQuery: {
      id: "student-create-parent-query", value: parentQuery,
      onChange: v => { setParentQuery(v); setSelectedParentId(null); setParentResults({ state: "loading" }); setError(""); },
      control: <input id="student-create-parent-query" className="edit-input"
        aria-label="Tìm theo tên, SĐT hoặc email" type="search" placeholder="Tên, SĐT hoặc email"
        value={parentQuery} disabled={locked}
        onChange={e => { setParentQuery(e.target.value); setSelectedParentId(null); setParentResults({ state: "loading" }); setError(""); }} />,
    },
    selectedParentId: {
      id: "student-create-parent-result", value: selectedParentId ?? "", onChange: setSelectedParentId,
      control: <div id="student-create-parent-result" className="option-list" aria-label="Kết quả tìm phụ huynh" aria-live="polite">
        {parentResults.state === "loading" ? <span>Đang tìm phụ huynh…</span> : null}
        {parentResults.state === "error" ? <span className="edit-error" role="alert">{parentResults.message}</span> : null}
        {parentResults.state === "ready" && !parentResults.data.length ? <span>Không tìm thấy Parent phù hợp.</span> : null}
        {parentResults.state === "ready" ? parentResults.data.map(item =>
          <button type="button" className="option-item" key={item.parent.id}
            aria-pressed={item.parent.id === selectedParentId} disabled={locked}
            onClick={() => { setSelectedParentId(item.parent.id); setError(""); }}>
            <span className="option-check" aria-hidden="true">{item.parent.id === selectedParentId ? "✓" : "＋"}</span>
            {item.parent.displayName || "Parent chưa đặt tên"}
            <small>{item.contacts.map(contact =>
              (contact.identifierType === "PHONE" ? "SĐT" : "Email") + " · " + contact.normalizedValue
            ).join(" · ") || "Chưa có contact active"}</small>
          </button>) : null}
      </div>,
    },
    guardianName: {
      id: "student-create-guardian-name", value: guardianName, disabled: locked,
      onChange: setGuardianName,
    },
    contactType: {
      id: "student-create-contact-type", value: contactType, onChange: v => setContactType(v as typeof contactType),
      control: <select id="student-create-contact-type" className="edit-input"
        aria-label="Loại liên hệ" value={contactType} disabled={locked}
        onChange={e => { setContactType(e.target.value as typeof contactType); setContactValue(""); }}>
        <option value="PHONE">Số điện thoại</option><option value="EMAIL">Email</option>
      </select>,
    },
    contactValue: {
      id: "student-create-contact-value", value: contactValue, required: true, onChange: setContactValue,
      control: <input id="student-create-contact-value" className="edit-input"
        type={contactType === "PHONE" ? "tel" : "email"}
        aria-label={contactType === "PHONE" ? "Số điện thoại phụ huynh" : "Email phụ huynh"}
        value={contactValue} disabled={locked} required
        onChange={e => { setContactValue(e.target.value); setError(""); }}
        placeholder={contactType === "PHONE" ? "Số điện thoại" : "Email"} />,
    },
  };
  const studentModule: BoModule = { label: "học viên", group: "School", fields: studentFields };
  return <BoQuickView moduleKey="students" module={studentModule} record={null}
    onClose={closeIfSafe}
    create={{
      draft: record, fields: studentFields, createFields: studentCreateFields, busy: busy || !centerId, error, title: "Tạo học viên", path: "Students",
      editable: field => !locked && studentKeys.includes(field.key),
      editorField: field => field.key === "relationshipType"
        ? { ...field, readonly: false, options: Object.values(relationshipLabels) }
        : { ...field, readonly: false },
      onChange: (key: string, value: BoValue) => {
        if (key === "name") setStudentName(String(value ?? ""));
        if (key === "relationshipType") {
          const match = (Object.keys(relationshipLabels) as (keyof typeof relationshipLabels)[])
            .find(k => relationshipLabels[k] === value);
          if (match) setRelationshipType(match);
        }
        setError("");
      },
      onCreate: () => submit(),
    }}
    extraSection={<>
      {!centerId ? <p className="edit-error" role="alert">Chọn cơ sở được cấp quyền để tạo học viên.</p> : null}
      <PropertySections variant="drawer" fields={parentFields} record={record}
        sections={[{ id: "guardian", label: "Phụ huynh / người giám hộ", fields: parentFieldKeys }]}
        createFields={createFields} />
      {selectedParent ? <p className="settings-hint">Đã chọn: {selectedParent.parent.displayName || selectedParent.parent.id}</p> : null}
      {uncertainAttempt ? <p className="settings-hint" role="status">Kết quả chưa xác định. Thử lại cùng yêu cầu để đối soát an toàn.</p> : null}
      {locked && error && canResetAttempt ? <button type="button" className="secondary-btn"
        disabled={busy} onClick={resetAttempt}>Sửa dữ liệu</button> : null}
    </>} />;
}
