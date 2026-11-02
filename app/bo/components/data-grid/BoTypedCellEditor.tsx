"use client";

/** Shared mutation-capable inline editing controls. Domain owns validation, ACL and persistence. */
export function BoTypedCellEditor({ label, value, type = "text", min, saving, error, onChange, onCommit, onCancel, commitLabel = "Lưu", cancelLabel = "Hủy" }: {
  label: string;
  value: string;
  type?: "text" | "number";
  min?: number;
  saving: boolean;
  error: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  commitLabel?: string;
  cancelLabel?: string;
}) {
  return <span onClick={(event) => event.stopPropagation()}>
    <input aria-label={label} type={type} min={min} value={value} disabled={saving}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => { if (event.key === "Escape" && !saving) onCancel(); if (event.key === "Enter") { event.preventDefault(); onCommit(); } }} />
    <button type="button" disabled={saving} onClick={onCommit}>{saving ? "Đang lưu…" : commitLabel}</button>
    <button type="button" disabled={saving} onClick={onCancel}>{cancelLabel}</button>
    {error ? <span role="alert">{error}</span> : null}
  </span>;
}