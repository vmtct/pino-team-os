"use client";
import { useEffect, useState } from "react";
import { readActiveMissionChoices, readCenterStudents, type MissionChoice, type StudentChoice } from "@/lib/bo-mission-assignment-options";

export type AssignmentDraft = Readonly<{
  studentId: string; missionId: string; contextLabel: string; cancelReason: string;
}>;
export const emptyAssignmentDraft: AssignmentDraft =
  { studentId: "", missionId: "", contextLabel: "", cancelReason: "" };
export function assignmentFormError(mode: "create" | "edit" | "cancel", value: AssignmentDraft): string | null {
  if (mode === "create" && (!value.studentId || !value.missionId)) return "Chọn học viên và Mission ACTIVE từ nguồn Core.";
  if (mode === "cancel" && (!value.cancelReason.trim() || value.cancelReason.trim().length > 500))
    return "Lý do hủy phải từ 1 đến 500 ký tự.";
  if (mode !== "cancel" && value.contextLabel.trim().length > 200) return "Bối cảnh tối đa 200 ký tự.";
  return null;
}
export function AssignmentFields({ centerId, mode, value, setValue, disabled, target }: {
  centerId: string; mode: "create" | "edit" | "cancel"; value: AssignmentDraft;
  setValue: (next: AssignmentDraft) => void; disabled: boolean;
  target?: { studentId: string; missionName: string; status: string } | null;
}) {
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<readonly StudentChoice[]>([]);
  const [missions, setMissions] = useState<readonly MissionChoice[]>([]);
  const [studentError, setStudentError] = useState("");
  const [missionError, setMissionError] = useState("");
  const [studentLoading, setStudentLoading] = useState(false);
  const [missionLoading, setMissionLoading] = useState(mode === "create");
  const [refine, setRefine] = useState(false);
  useEffect(() => {
    if (mode !== "create") return;
    const abort = new AbortController();
    // Searching the Center directory is opt-in; no bulk/global Student enumeration.
    if (query.trim().length < 2) return;
    const timer = setTimeout(() => {
      setStudentLoading(true);setStudentError("");
      void readCenterStudents(fetch, centerId, query, abort.signal)
        .then(result => {
          if (abort.signal.aborted) return;
          setStudents(result.items);setRefineSearch(result.refineSearch);
        })
        .catch(() => { if (!abort.signal.aborted) { setStudents([]);setStudentError("Không đọc được học viên thuộc Center này."); } })
        .finally(() => { if (!abort.signal.aborted) setStudentLoading(false); });
    }, 200);
    return () => { clearTimeout(timer);abort.abort(); };
    function setRefineSearch(next: boolean) { setRefine(next); }
  }, [centerId, mode, query]);
  useEffect(() => {
    if (mode !== "create") return;
    const abort = new AbortController();
    // Core enforces GLOBAL catalog view and the ACTIVE status predicate.
    void readActiveMissionChoices(fetch, abort.signal)
      .then(items => { if (!abort.signal.aborted) setMissions(items); })
      .catch(() => { if (!abort.signal.aborted) { setMissions([]);setMissionError("Không đọc được danh mục Mission ACTIVE."); } })
      .finally(() => { if (!abort.signal.aborted) setMissionLoading(false); });
    return () => abort.abort();
  }, [centerId, mode]);

  const set = (field: keyof AssignmentDraft, entry: string) => setValue({ ...value, [field]: entry });
  if (mode === "cancel") return <section aria-label="Hủy giao Nhiệm vụ" className="v25-form-fields">
    <p role="note">Thao tác hủy giữ lại bản ghi lịch sử, không xóa Mission hoặc Nhật Ký.</p>
    <p>{target?.missionName ?? "Nhiệm vụ đang giao"}</p>
    <label className="v25-form-field"><span>Lý do hủy *</span>
      <textarea autoFocus required maxLength={500} rows={3} disabled={disabled}
        value={value.cancelReason} onChange={e => set("cancelReason", e.target.value)} /></label>
  </section>;
  if (mode === "edit") return <section aria-label="Sửa bối cảnh Nhiệm vụ" className="v25-form-fields">
    <p role="note">Chỉ sửa bối cảnh. Học viên, Mission gốc và Center không được thay đổi tại đây.</p>
    <p>{target?.missionName ?? "Nhiệm vụ đang giao"}</p>
    <label className="v25-form-field"><span>Bối cảnh</span>
      <textarea autoFocus maxLength={200} rows={3} disabled={disabled}
        value={value.contextLabel} onChange={e => set("contextLabel", e.target.value)} /></label>
  </section>;
  return <section aria-label="Giao Nhiệm vụ mới" className="v25-form-fields">
    <label className="v25-form-field"><span>Tìm học viên trong Center *</span>
      <input autoFocus type="search" maxLength={100} disabled={disabled} value={query}
        placeholder="Nhập ít nhất 2 ký tự tên học viên"
        onChange={e => { setQuery(e.target.value);setStudents([]);setRefine(false);setValue({ ...value, studentId: "" }); }} />
    </label>
    {studentLoading ? <p role="status">Đang tìm học viên…</p> : null}
    {studentError ? <p role="alert">{studentError}</p> : null}
    {refine ? <p role="note">Có nhiều kết quả. Thu hẹp từ khóa để tìm đúng học viên.</p> : null}
    <label className="v25-form-field"><span>Học viên *</span>
      <select required disabled={disabled || !students.length} value={value.studentId}
        onChange={e => set("studentId", e.target.value)}>
        <option value="">Chọn học viên được cấp quyền</option>
        {students.map(s => <option key={s.id} value={s.id}>{s.name} · {s.status}</option>)}
      </select>
    </label>
    {missionLoading ? <p role="status">Đang đọc danh mục Mission ACTIVE…</p> : null}
    {missionError ? <p role="alert">{missionError}</p> : null}
    <label className="v25-form-field"><span>Mission ACTIVE *</span>
      <select required disabled={disabled || !missions.length} value={value.missionId}
        onChange={e => set("missionId", e.target.value)}>
        <option value="">Chọn Mission đang hoạt động</option>
        {missions.map(m => <option key={m.id} value={m.id}>{m.code} · {m.name} · Cấp {m.level}</option>)}
      </select>
    </label>
    {!missions.length && !missionLoading && !missionError ? <p role="note">Chưa có Mission ACTIVE được cấp quyền để giao.</p> : null}
    <label className="v25-form-field"><span>Bối cảnh / mục tiêu</span>
      <textarea maxLength={200} rows={3} disabled={disabled} value={value.contextLabel}
        onChange={e => set("contextLabel", e.target.value)} /></label>
  </section>;
}
