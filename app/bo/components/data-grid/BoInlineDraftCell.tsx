"use client";
import { useState } from "react";
import { type BoInlineEditValue } from "@/lib/bo-inline-edit-state";
export function BoInlineDraftCell({ value, rowKey, field, editable, onStage }: { value: BoInlineEditValue; rowKey: string; field: string; editable: boolean; onStage: (edit: {rowKey: string; field: string; before: BoInlineEditValue; after: BoInlineEditValue}) => void }) {
 const [open, setOpen] = useState(false);
 const [draft, setDraft] = useState(String(value ?? ""));
 if (!editable) return <span>{String(value ?? "")}</span>;
 function save() {
  if (typeof value === "number" && (draft.trim() === "" || !Number.isFinite(Number(draft)))) return;
  onStage({ rowKey, field, before: value, after: typeof value === "number" ? Number(draft) : typeof value === "boolean" ? draft === "true" : draft });
  setOpen(false);
 }
 if (!open) return <button type="button" aria-label={`Edit ${field}`} onClick={() => { setDraft(String(value ?? "")); setOpen(true); }}>{String(value ?? "")}</button>;
 return <span><input aria-label={`Draft ${field}`} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); if (event.key === "Enter") save(); }} /><button type="button" onClick={save}>Apply draft</button><button type="button" onClick={() => setOpen(false)}>Cancel</button></span>;
}