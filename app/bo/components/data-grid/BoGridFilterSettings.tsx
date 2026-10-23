"use client";

import { useState } from "react";
import { type BoFilterField, type BoFilterSettings, validateBoFilterSettings } from "@/lib/bo-filter-settings-state";
import { type BoTypedFilterOperator } from "@/lib/bo-typed-filter";

export function BoGridFilterSettings({ fields, value, onChange }: {
  fields: readonly BoFilterField[];
  value: BoFilterSettings;
  onChange: (settings: BoFilterSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const usable = fields.filter((field) => field.filterable);
  const filter = value.group.filters[0];
  const selected = usable.find((field) => field.key === filter?.field) ?? usable[0];
  const operator: BoTypedFilterOperator = filter?.operator ?? (selected?.type === "text" ? "contains" : "equals");
  function update(field: string, op: BoTypedFilterOperator, text: string) {
    const next: BoFilterSettings = { ...value, group: { combinator: "and", filters: [{ field, operator: op, value: text }] } };
    if (validateBoFilterSettings(next, fields)) onChange(next);
  }
  return <div style={{ position: "relative" }}>
    <button type="button" aria-expanded={open} aria-controls="bo-grid-filter-settings" aria-label="Cài đặt bảng" onClick={() => setOpen(!open)}>☷</button>
    {open ? <section id="bo-grid-filter-settings" aria-label="Table filter settings" style={{ position: "absolute", zIndex: 4, right: 0, background: "white", padding: 12, border: "1px solid #ddd", minWidth: 240 }}>
      <label>Property <select aria-label="Filter property" value={selected?.key ?? ""} onChange={(event) => update(event.target.value, usable.find((item) => item.key === event.target.value)?.type === "text" ? "contains" : "equals", "")}>
        {usable.map((field) => <option key={field.key} value={field.key}>{field.key}</option>)}
      </select></label>
      {selected ? <><label>Operator <select aria-label="Filter operator" value={operator} onChange={(event) => update(selected.key, event.target.value as BoTypedFilterOperator, filter?.value ?? "")}>
        {(["contains", "not_contains", "equals", "not_equals", "is_empty", "is_not_empty"] as const).filter((op) => selected.type === "text" || !["contains", "not_contains"].includes(op)).map((op) => <option key={op} value={op}>{op}</option>)}
      </select></label>
      {!["is_empty", "is_not_empty"].includes(operator) ? <label>Value <input aria-label="Filter value" value={filter?.value ?? ""} onChange={(event) => update(selected.key, operator, event.target.value)} /></label> : null}</> : <p>No filterable properties.</p>}
      <fieldset aria-label="Hiển thị cột"><legend>Hiển thị cột</legend>{fields.map((field) => <label key={field.key} style={{ display: "block" }}><input type="checkbox" checked={value.visibleKeys.includes(field.key)} onChange={(event) => { const next = event.target.checked ? [...value.visibleKeys, field.key] : value.visibleKeys.filter((key) => key !== field.key); if (next.length) onChange({ ...value, visibleKeys: next }); }} />{field.key}</label>)}</fieldset>
      <button type="button" onClick={() => onChange({ ...value, group: { combinator: "and", filters: [] } })}>Clear filters</button>
    </section> : null}
  </div>;
}