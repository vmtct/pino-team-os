"use client";

import { useEffect, useRef, useState } from "react";
import { studentCenterApi } from "@/lib/bo-student-center-api";
import { studentBirthProfilePatch } from "@/lib/bo-student-birth-profile";
import { BoApiError } from "@/lib/bo-api-error";
import styles from "./BoStudentDetailLocalField.module.css";
import { BoTypedEditor } from "./BoTypedEditor";
import { BoValue } from "./BoValue";
import type { BoField, BoRecord, BoValue as BoFieldValue } from "@/lib/bo-registration";

type EditableKind = "status" | "birthDay" | "birthMonth" | "birthYear";

export function studentEditableKind(field: BoField): EditableKind | null {
  const key = field.key.toLowerCase();
  const label = field.label.trim().toLocaleLowerCase("vi");
  if (label === "trạng thái hồ sơ" || ["status", "studentstatus", "profilestatus"].includes(key)) return "status";
  if (key === "birthday" || label === "ngày sinh") return "birthDay";
  if (key === "birthmonth" || label === "tháng sinh") return "birthMonth";
  if (key === "birthyear" || label === "năm sinh") return "birthYear";
  return null;
}

export function BoStudentBirthDateLocalField({ record, centerId }: { record: BoRecord; centerId: string }) {
  const [parts, setParts] = useState({
    birthDay: record.birthDay ?? "",
    birthMonth: record.birthMonth ?? "",
    birthYear: record.birthYear ?? "",
  });
  const [version, setVersion] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);

  function showBirth(student: Awaited<ReturnType<typeof studentCenterApi.learnerLifecycle>>["student"]) {
    setParts({ birthDay: student.birthDay ?? "", birthMonth: student.birthMonth ?? "", birthYear: student.birthYear ?? "" });
  }

  useEffect(() => {
    if (!centerId) return;
    let active = true;
    void Promise.all([
      studentCenterApi.birthEditCapability(centerId),
      studentCenterApi.learnerLifecycle(record.id, centerId),
    ]).then(([allowed, {student}]) => {
      if (!active || student.id !== record.id) return;
      showBirth(student);
      setVersion(allowed && student.status !== "ARCHIVED" ? student.version : null);
    }).catch(() => {
      if (active) setMessage("Không thể tải quyền sửa hoặc ngày sinh.");
    });
    return () => { active = false; };
  }, [centerId, record.id]);

  async function saveBirth() {
    if (!centerId || version === null || busy.current) return;
    busy.current = true;
    setSaving(true);
    setMessage("");
    try {
      const payload = studentBirthProfilePatch({
        birthDay: String(parts.birthDay),
        birthMonth: String(parts.birthMonth),
        birthYear: String(parts.birthYear),
      }, version);
      await studentCenterApi.updateBirthProfile(record.id, payload, centerId);
      setVersion(null);
      const {student} = await studentCenterApi.learnerLifecycle(record.id, centerId);
      if (student.id !== record.id || student.version !== version + 1) {
        setMessage("Hồ sơ đã thay đổi. Vui lòng mở lại hồ sơ.");
        return;
      }
      showBirth(student);
      setVersion(student.status === "ARCHIVED" ? null : student.version);
      setMessage("Đã lưu ngày sinh.");
    } catch (error) {
      if (error instanceof BoApiError && (error.status === 409 || error.status === 403)) {
        setVersion(null);
        setMessage("Không thể sửa hồ sơ hiện tại. Vui lòng mở lại hồ sơ.");
      } else {
        setMessage(error instanceof Error ? error.message : "Không thể lưu ngày sinh.");
      }
    } finally {
      setSaving(false);
      busy.current = false;
    }
  }
  const fields = [
    { key: "birthDay" as const, placeholder: "dd", label: "Ngày" },
    { key: "birthMonth" as const, placeholder: "mm", label: "Tháng" },
    { key: "birthYear" as const, placeholder: "yyyy", label: "Năm" },
  ];

  return <div className="v24-prop-item" data-student-detail-field="birthDate">
    <div className="v24-prop-key"><span className="v24-field-glyph">#</span>Sinh Nhật</div>
    <div className={styles.studentBirthDateValue} role="group" aria-label="Sinh Nhật">
      {fields.map(part => <input className={"edit-input " + styles.studentBirthDateInput} key={part.key}
        type="text" inputMode="numeric" maxLength={part.key === "birthYear" ? 4 : 2} aria-label={part.label} readOnly={Boolean(centerId) && (version === null || saving)}
        placeholder={part.placeholder} value={parts[part.key]}
        onChange={event => setParts(current => ({ ...current, [part.key]: event.target.value }))} />)}
      {version !== null && <button type="button" className="secondary-btn" disabled={saving} onClick={() => void saveBirth()}>Lưu</button>}
    </div>
    {message && <span role="status">{message}</span>}
  </div>;
}

export function BoStudentDetailLocalField({ field, value }: { field: BoField; value: BoFieldValue }) {
  const [draft, setDraft] = useState<BoFieldValue>(value ?? null);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [error, setError] = useState("");
  const kind = studentEditableKind(field);
  if (!kind || kind !== "status") return null;

  const editorField: BoField = { ...field, type: "select", readonly: false, options: field.options?.length ? field.options : ["ACTIVE", "INACTIVE"] };
  const label = "Trạng thái hồ sơ";

  function save(next: BoFieldValue) {
    setDraft(next === "" ? null : next);
    setError("");
    setAnchor(null);
  }

  return <div className="v24-prop-item" data-student-detail-field={kind}>
    <div className="v24-prop-key"><span className="v24-field-glyph">{field.icon}</span>{label}</div>
    <button type="button" className="v24-prop-value" data-detail-edit={kind} aria-label={"Sửa " + label}
      onClick={event => { setError(""); setAnchor(event.currentTarget); }}>
      <BoValue field={field} value={draft} full />
      <span className="v24-edit-glyph" aria-hidden="true">✎</span>
    </button>
    {error ? <div className="edit-error" role="alert">{error}</div> : null}
    {anchor ? <BoTypedEditor field={editorField} value={draft} anchor={anchor}
      onClose={() => setAnchor(null)} onSave={save} /> : null}
  </div>;
}

export function isStudentHouseMemberField(field: BoField): boolean {
  const key = field.key.toLowerCase();
  const label = field.label.trim().toLocaleLowerCase("en");
  return ["membership", "housemember", "housemembership"].includes(key) || label === "house member";
}
