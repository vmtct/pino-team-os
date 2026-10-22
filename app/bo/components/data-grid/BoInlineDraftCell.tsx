"use client";
import { useEffect, useId, useRef, useState } from "react";
import { type BoInlineEditValue } from "@/lib/bo-inline-edit-state";
export function BoInlineDraftCell({ value, rowKey, field, editable, onStage }: { value: BoInlineEditValue; rowKey: string; field: string; editable: boolean; onStage: (edit: {rowKey: string; field: string; before: BoInlineEditValue; after: BoInlineEditValue}) => void }) {
 const errorId = `draft-error-${useId()}`;
 const openerRef = useRef<HTMLButtonElement>(null);
 const editorRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
 const [open, setOpen] = useState(false);
 const [draft, setDraft] = useState(String(value ?? ""));
 const [error, setError] = useState("");
 useEffect(() => { if (open) editorRef.current?.focus(); else openerRef.current?.focus(); }, [open]);
 if (!editable) return <span>{String(value ?? "")}</span>;
 function save() {
  if (typeof value === "number" && (draft.trim() === "" || !Number.isFinite(Number(draft)))) { setError("Enter a valid number"); return; }
  setError("");
  onStage({ rowKey, field, before: value, after: typeof value === "number" ? Number(draft) : typeof value === "boolean" ? draft === "true" : value === null && draft === "" ? null : draft });
  setOpen(false);
 }
 if (!open) return <button ref={openerRef} type="button" aria-label={`Edit ${field}`} onClick={() => { setDraft(String(value ?? "")); setError(""); setOpen(true); }}>{String(value ?? "")}</button>;
 return <span>{typeof value === "boolean" ? <select ref={editorRef} aria-label={`Draft ${field}`} value={draft} onChange={(event) => { setDraft(event.target.value); setError(""); }} onKeyDown={(event) => { if (event.key === "Escape") { setError(""); setDraft(String(value ?? "")); setOpen(false); } if (event.key === "Enter") save(); }}><option value="true">True</option><option value="false">False</option></select> : <input ref={editorRef} type={typeof value === "number" ? "number" : "text"} inputMode={typeof value === "number" ? "decimal" : undefined} aria-label={`Draft ${field}`} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} value={draft} onChange={(event) => { setDraft(event.target.value); setError(""); }} onKeyDown={(event) => { if (event.key === "Escape") { setError(""); setDraft(String(value ?? "")); setOpen(false); } if (event.key === "Enter") save(); }} /> }{error && <span id={errorId} role="alert">{error}</span>}<button type="button" onClick={save}>Apply draft</button><button type="button" onClick={() => { setError(""); setDraft(String(value ?? "")); setOpen(false); }}>Cancel</button></span>;
}
