"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { editorPosition, norm, type BoField, type BoValue } from "@/lib/bo-registration";
/** Existing typed controls: legacy draft edits by default; the TDD adapter owns gated async commits. */
export function BoTypedEditor({ field, value, anchor, onClose, onSave, closeOnSave = true }: { closeOnSave?: boolean; field: BoField; value: BoValue; anchor: HTMLElement; onClose: () => void; onSave: (value: BoValue) => void }) {
  const panel = useRef<HTMLDivElement>(null), control = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);
  const [draft, setDraft] = useState<BoValue>(value ?? ""), [query, setQuery] = useState(""), [error, setError] = useState("");
  const multi = ["multirelation", "multiselect"].includes(field.type), choice = multi || ["person", "relation"].includes(field.type);
  useLayoutEffect(() => {
    const node = panel.current!;
    const position = () => { if (!anchor.isConnected) { onClose(); return; } const p = editorPosition(anchor.getBoundingClientRect(), node.getBoundingClientRect(), { width: document.documentElement.clientWidth, height: innerHeight }); Object.assign(node.style, { left: p.left + "px", top: p.top + "px", bottom: "auto", maxHeight: p.maxHeight + "px" }); };
    position(); control.current?.focus(); const resize = new ResizeObserver(position); resize.observe(node);
    const click = (e: PointerEvent) => { if (!node.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose(); };
    window.addEventListener("resize", position); window.addEventListener("scroll", position, true); document.addEventListener("pointerdown", click);
    return () => { resize.disconnect(); window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true); document.removeEventListener("pointerdown", click); if (anchor.isConnected) anchor.focus(); };
  }, [anchor, onClose]);
  function save() {
    if (field.readonly || ["id", "formula"].includes(field.type)) return;
    if (field.key === "name" && !String(draft).trim()) { setError("Hãy nhập tên hồ sơ."); return; }
    if (control.current && !control.current.checkValidity()) { setError(control.current.validationMessage); return; }
    if (["number", "currency"].includes(field.type) && draft !== "" && (!Number.isFinite(Number(draft)) || Number(draft) < 0)) { setError("Nhập số không âm hợp lệ."); return; }
    onSave(["number", "currency"].includes(field.type) ? draft === "" ? null : Number(draft) : draft); if (closeOnSave) onClose();
  }
  const selected = Array.isArray(draft) ? draft : [String(draft)];
  return <div ref={panel} id="popover" className="edit-popover" role="dialog" aria-label={"Sửa " + field.label} aria-modal="false" onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); e.stopPropagation(); save(); } }}>
    <div className="edit-group">{field.type === "boolean" ? <label className="option-item"><input ref={control} id="editor-bool" type="checkbox" aria-label={field.label} checked={Boolean(draft)} onChange={e => setDraft(e.target.checked)} /> Có / Đã duyệt</label> : field.type === "select" ? <select ref={control} id="editor-value" className="edit-input" aria-label={field.label} value={String(draft)} onChange={e => setDraft(e.target.value)}><option value="">— Chưa chọn —</option>{field.options?.map(v => <option key={v}>{v}</option>)}</select> : choice ? <><input ref={control} className="edit-input edit-search" id="editor-search" type="search" aria-label={"Tìm " + field.label} placeholder={"Tìm " + field.label.toLowerCase() + "..."} value={query} onChange={e => setQuery(e.target.value)} /><div className="option-list" id="editor-options">{field.options?.filter(v => norm(v).includes(norm(query))).map(v => <button type="button" className="option-item" key={v} aria-pressed={selected.includes(v)} onClick={() => setDraft(multi ? selected.includes(v) ? selected.filter(x => x !== v) : [...selected.filter(Boolean), v] : v)}><span className="option-check">{selected.includes(v) ? "✓" : "＋"}</span>{v}</button>)}</div></> : field.type === "textarea" ? <textarea ref={control} className="edit-input" id="editor-value" aria-label={field.label} aria-describedby="edit-error" aria-invalid={Boolean(error)} placeholder="Ghi chú..." value={String(draft)} onChange={e => setDraft(e.target.value)} /> : <input ref={control} id="editor-value" className="edit-input" aria-label={field.label} aria-describedby="edit-error" aria-invalid={Boolean(error)} placeholder={"Nhập " + field.label} type={({ number: "number", currency: "number", date: "date", datetime: "datetime-local", email: "email", url: "url" } as Record<string, string>)[field.type] ?? "text"} min={["number", "currency"].includes(field.type) ? 0 : undefined} step={field.type === "currency" ? 1000 : 1} value={String(draft)} onChange={e => setDraft(e.target.value)} />}</div>
    <div id="edit-error" className="edit-error" role={error ? "alert" : undefined}>{error}</div><div className="editor-actions"><button type="button" id="edit-cancel" onClick={onClose}>Hủy</button><button type="button" id="edit-save" className="save" disabled={field.readonly || ["id", "formula"].includes(field.type)} onClick={save}>Lưu</button></div>
  </div>;
}
