"use client";
import { useEffect, useState } from "react";
import type { BoRecord } from "@/lib/bo-registration";
import { workforceRead } from "@/app/bo/architecture/workforce-read-client";
import { workforceAssignmentNote } from "@/app/bo/architecture/workforce-shift-note";

type EditorState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; note: string | null; updatedAt: string; editable: boolean; reason: string };

export function BoWorkforceAssignmentNoteEditor({ record, onSaved }: { record: BoRecord; onSaved: () => void }) {
  const centerId = typeof record.centerId === "string" ? record.centerId : "";
  const weekId = typeof record.termWeekId === "string" ? record.termWeekId : "";
  const [state, setState] = useState<EditorState>({ kind: "loading" });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ kind: "loading" });
    setError("");
    if (!centerId || !weekId) {
      setState({ kind: "error", message: "Assignment thiếu Center hoặc Term Week hợp lệ." });
      return () => { alive = false; };
    }
    void Promise.all([workforceRead.bootstrap(), workforceRead.weekly(centerId, weekId)])
      .then(([bootstrap, week]) => {
        if (!alive) return;
        const assignment = week.assignments.find(item => item.id === record.id);
        if (!assignment || assignment.centerId !== centerId || assignment.termWeekId !== weekId) {
          setState({ kind: "error", message: "Assignment không còn trong tuần được cấp quyền." });
          return;
        }
        const note = workforceAssignmentNote(assignment);
        const canEdit = bootstrap.centers.some(c => c.id === centerId && c.canEditPlanning);
        const open = week.windows?.planning.state === "OPEN";
        const active = assignment.status === "ACTIVE";
        setDraft(note ?? "");
        setState({
          kind: "ready", note, updatedAt: assignment.updatedAt,
          editable: canEdit && open && active,
          reason: !canEdit ? "Tài khoản không có quyền sửa phân công tại Center này."
            : !active ? "Chỉ chỉnh sửa Note của ca ACTIVE."
            : !open ? "Cửa sổ lập lịch đã đóng." : "",
        });
      }).catch((reason: unknown) => {
        if (alive) setState({ kind: "error", message: reason instanceof Error ? reason.message : "Không tải được ca làm." });
      });
    return () => { alive = false; };
  }, [record.id, centerId, weekId, retry]);

  async function save() {
    if (state.kind !== "ready" || !state.editable || saving) return;
    const note = draft.trim() || null;
    if (note === state.note) return;
    setSaving(true);
    setError("");
    try {
      const result = await fetch("/api/bo/workforce/planning/assignment/note", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ assignmentId: record.id, expectedUpdatedAt: state.updatedAt, note }),
      });
      const body = await result.json().catch(() => null) as { data?: { id?: string }; error?: { message?: string } } | null;
      if (!result.ok || body?.data?.id !== record.id) {
        throw new Error(body?.error?.message || "Không lưu được Note ca làm (HTTP " + result.status + ").");
      }
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không lưu được Note ca làm.");
    } finally {
      setSaving(false);
    }
  }

  const changed = state.kind === "ready" && (draft.trim() || null) !== state.note;
  return <section className="property-section" aria-label="Chỉnh sửa Note ca làm" data-workforce-assignment-note-editor>
    <h3>Note ca làm</h3>
    {state.kind === "loading" ? <p role="status" className="settings-hint">Đang tải ca làm…</p>
      : state.kind === "error" ? <p role="alert" className="edit-error">{state.message} <button type="button" onClick={() => setRetry(n => n + 1)}>Thử lại</button></p>
      : <>
        <div className="property-row">
          <label className="property-label" htmlFor="workforce-assignment-note-input">Ghi chú</label>
          <div className="property-control">
            <textarea id="workforce-assignment-note-input" rows={3} maxLength={500} value={draft}
              placeholder="Ghi chú ca làm (không thay đổi lịch hoặc vai trò)"
              onChange={event => setDraft(event.target.value)} disabled={!state.editable || saving} />
          </div>
        </div>
        <p className="settings-hint">{draft.length}/500 ký tự · Chỉ cập nhật Note.</p>
        {!state.editable ? <p role="status" className="settings-hint">{state.reason}</p> : null}
        {error ? <p role="alert" className="edit-error">{error}</p> : null}
        <button type="button" className="primary-btn" onClick={() => void save()}
          disabled={!state.editable || !changed || saving}>{saving ? "Đang lưu…" : "Lưu Note"}</button>
      </>}
  </section>;
}