"use client";
/** PAP-1385 / Epic PAP-650 PNR-TV. Founder-only, Core-backed, native PINO DSA inline. */
import { useEffect, useRef, useState } from "react";
import type { BoField, BoRecord, BoValue } from "@/lib/bo-registration";
import { PropertySections } from "@/app/components/workspace-renderer/Properties";
import { BoTypedEditor } from "@/app/bo/components/registration/BoTypedEditor";
import {
  selectedTvCenter, readTvVisibility, saveTvVisibility, TvVisibilityClientError,
  type TvVisibilityCenter, type TvVisibilityDraft, type TvLiveVisibility,
} from "@/lib/ho-tv-visibility-client";

export type { TvVisibilityCenter };
const sections = [{
  id: "tv-logical-visibility",
  label: "Hiển thị trên TOS",
  fields: ["name", "visibilityScope", "centerIds"],
}];
type Editor = { field: BoField; anchor: HTMLButtonElement };
type State = "loading" | "ready" | "denied" | "unavailable";
function statusMessage(err: unknown): string {
  if (err instanceof TvVisibilityClientError) {
    switch (err.code) {
      case "LOGIN": return "Phiên Founder đã hết hạn. Vui lòng đăng nhập lại HO.";
      case "DENIED": return "Không có quyền Founder với Center đang chọn hoặc Center được gán.";
      case "MISSING": return "Không tìm thấy Policy đang hoạt động ở Center này.";
      case "CONFLICT": return "Cấu hình vừa được người khác cập nhật. Đã tải lại phiên bản Core; hãy xem và chỉnh sửa lại.";
      case "INVALID": return "Giá trị không hợp lệ. Kiểm tra tên (1–200 ký tự), Scope và danh sách Center.";
      case "VERIFY": return "Không xác minh được dữ liệu sau khi ghi. Tải lại từ Core trước khi tiếp tục.";
      default: return "Không thể xác minh cấu hình từ Core. Vui lòng thử lại.";
    }
  }
  return "Không thể kết nối Core. Cần tải lại để xác minh trạng thái trước khi chỉnh sửa.";
}
export function TvPolicyVisibilityEditor({
  policy, centers,
}: { policy: BoRecord; centers: readonly TvVisibilityCenter[] }) {
  const selectedCenterId = selectedTvCenter(policy.id, centers);
  const [state, setState] = useState<State>("loading");
  const [current, setCurrent] = useState<TvLiveVisibility | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const saving = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const attempt = new AbortController();
    let live = true;
    queueMicrotask(() => { if (live) {
      setState("loading"); setCurrent(null); setEditor(null); setMessage(""); setError("");
    }});
    if (!selectedCenterId) {
      queueMicrotask(() => { if (live) setState("unavailable"); });
      return () => { live = false; };
    }
    void readTvVisibility(policy.id, selectedCenterId, centers, fetch, attempt.signal)
      .then(data => { if (live) { setCurrent(data); setState("ready"); } })
      .catch(cause => { if (live && !attempt.signal.aborted) {
        setState(cause instanceof TvVisibilityClientError &&
          (cause.code === "DENIED" || cause.code === "LOGIN" || cause.code === "MISSING") ?
          "denied" : "unavailable");
        setError(statusMessage(cause));
      }});
    return () => { live = false; attempt.abort(); controller.current?.abort(); };
  }, [policy.id, selectedCenterId, centers, retry]);

  const options = centers.map(c => ({ id: c.id, label: c.name + " · " + c.id.slice(-6) }));
  const labels = new Map(options.map(o => [o.id, o.label]));
  const ids = new Map(options.map(o => [o.label, o.id]));
  const fields: BoField[] = [
    { key: "name", label: "Tên TV", type: "text", icon: "Aa", w: 220 },
    { key: "visibilityScope", label: "Scope hiển thị", type: "select", icon: "", w: 155,
      options: ["DEFAULT", "CENTER"] },
    { key: "centerIds", label: "Center hiển thị", type: "multiselect", icon: "", w: 240,
      options: options.map(o => o.label) },
  ];
  const record: BoRecord = current ? {
    id: current.id, name: current.name, visibilityScope: current.scope,
    centerIds: current.assignedCenterIds.map(id => labels.get(id) ?? id),
  } : { id: policy.id, name: "—", visibilityScope: "—", centerIds: [] };
  // Keep the original DSA trigger mounted during async CAS/readback so the
  // shared editor can restore focus to the same real button after unmount.
  const editable = (field: BoField) =>
    state === "ready" && !!current &&
    (field.key !== "centerIds" || current.scope === "CENTER");

  const returnFocus = (fieldKey: string, anchor?: HTMLButtonElement) => {
    window.requestAnimationFrame(() => {
      const active = document.activeElement;
      // Do not steal focus from a new intentional target.
      if (active && active !== document.body && active !== document.documentElement &&
          active !== anchor && active.isConnected) return;
      const replacement = document.querySelector<HTMLButtonElement>(
        '[data-pnr-tv-visibility-editor] button.v24-prop-value.writable[data-detail-edit="' + fieldKey + '"]',
      );
      (anchor?.isConnected ? anchor : replacement)?.focus();
    });
  };
  const close = () => {
    if (!saving.current) {
      const previous = editor;
      setEditor(null);
      setError("");
      if (previous) returnFocus(previous.field.key, previous.anchor);
    }
  };
  async function commit(field: BoField, value: BoValue) {
    if (saving.current || !current || !selectedCenterId || state !== "ready") return;
    let next: TvVisibilityDraft = {
      name: current.name, scope: current.scope, assignedCenterIds: [...current.assignedCenterIds],
    };
    if (field.key === "name" && typeof value === "string") {
      next = { ...next, name: value.trim() };
    } else if (field.key === "visibilityScope" && (value === "DEFAULT" || value === "CENTER")) {
      next = { ...next, scope: value,
        assignedCenterIds: value === "DEFAULT" ? [] : [...current.assignedCenterIds] };
    } else if (field.key === "centerIds" && current.scope === "CENTER" && Array.isArray(value)) {
      const selected = value.map(label => ids.get(String(label)));
      if (selected.some(id => !id)) { setError(statusMessage(new TvVisibilityClientError("INVALID"))); return; }
      next = { ...next, assignedCenterIds: selected as string[] };
    } else { setError(statusMessage(new TvVisibilityClientError("INVALID"))); return; }
    saving.current = true; setBusy(true); setMessage(""); setError("");
    const attempt = new AbortController();
    controller.current = attempt;
    try {
      const verified = await saveTvVisibility(
        current, selectedCenterId, next, centers, fetch, attempt.signal,
      );
      if (!attempt.signal.aborted) {
        setCurrent(verified);
        setMessage(verified === current ? "Không có thay đổi để lưu; đã đọc cấu hình từ Core." :
          "Đã lưu và xác minh readback từ Core · revision " + verified.revision + ".");
        setEditor(null);
        returnFocus(field.key, editor?.anchor);
      }
    } catch (cause) {
      if (attempt.signal.aborted) return;
      if (cause instanceof TvVisibilityClientError && cause.code === "CONFLICT") {
        try {
          const refreshed = await readTvVisibility(policy.id, selectedCenterId, centers, fetch, attempt.signal);
          if (!attempt.signal.aborted) { setCurrent(refreshed); setEditor(null); returnFocus(field.key, editor?.anchor); }
        } catch { if (!attempt.signal.aborted) { setState("unavailable"); setCurrent(null); setEditor(null); } }
        if (!attempt.signal.aborted) setError(statusMessage(cause));
      } else if (cause instanceof TvVisibilityClientError && cause.code === "INVALID") {
        setError(statusMessage(cause));
      } else {
        // A failed readback may follow a committed PATCH: never retry an ambiguous write.
        setState("unavailable"); setCurrent(null); setEditor(null); setError(statusMessage(cause));
      }
    } finally {
      if (controller.current === attempt) controller.current = null;
      saving.current = false; setBusy(false);
    }
  }
  return <section data-pnr-tv-visibility-editor="" aria-busy={busy}
    data-pnr-tv-core-verified={state === "ready" ? "true" : "false"}
    data-pnr-tv-persisted={state === "ready" && (current?.revision ?? 0) > 0 ? "true" : "false"}
    aria-label="Hiển thị TV trên TOS — dữ liệu Core">
    {state === "loading" ? <p role="status">Đang xác minh cấu hình TV từ Core…</p>
      : state !== "ready" ? <p role="alert">{error || "Không có Center đã xác thực cho Policy. Không thể chỉnh sửa."}
          {" "}<button type="button" onClick={() => setRetry(n => n + 1)}>Thử lại</button></p>
      : current ? <>
        <PropertySections variant="detail" fields={fields} record={record} sections={sections}
          canEdit={editable} onEdit={(field, anchor) => { if (busy) return; setError(""); setEditor({field, anchor}); }} />
        {editor ? <BoTypedEditor key={editor.field.key + ":" + current.revision}
          field={editor.field} value={record[editor.field.key]} anchor={editor.anchor}
          closeOnSave={false} onSave={value => { void commit(editor.field, value); }} onClose={close} /> : null}
        <p role="status" data-pnr-tv-core-revision={current.revision}>
          Core revision {current.revision} · {current.scope === "DEFAULT" ?
            "DEFAULT: hiển thị ở mọi Center được phép" :
            "CENTER: " + current.assignedCenterIds.length + " Center được chọn"}.
          {" "}Thay đổi Scope có thể mở rộng hoặc thu hẹp phạm vi hiển thị.
          Viewer chưa được kích hoạt.
        </p>
        {busy ? <p role="status">Đang ghi và xác minh readback…</p> : null}
        {message ? <p role="status" data-pnr-tv-write-verified="">{message}</p> : null}
        {error ? <p role="alert" className="edit-error">{error}</p> : null}
      </> : null}
  </section>;
}
