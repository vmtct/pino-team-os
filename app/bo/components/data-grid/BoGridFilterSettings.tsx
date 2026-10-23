"use client";

import { useState } from "react";
import { type BoFilterField, type BoFilterSettings, validateBoFilterSettings } from "@/lib/bo-filter-settings-state";
import { type BoTypedFilterOperator } from "@/lib/bo-typed-filter";

const operators: Record<BoFilterField["type"], readonly BoTypedFilterOperator[]> = {
  text: ["contains", "not_contains", "equals", "not_equals", "is_empty", "is_not_empty"],
  number: ["equals", "not_equals", "is_empty", "is_not_empty"],
  boolean: ["equals", "not_equals", "is_empty", "is_not_empty"],
  date: ["equals", "not_equals", "is_empty", "is_not_empty"],
};
type Rule = BoFilterSettings["group"]["filters"][number];
function initialRule(field: BoFilterField): Rule {
  return { field: field.key, operator: field.type === "text" ? "contains" : "is_empty", value: "" };
}
export function BoGridFilterSettings({ fields, value, onChange }: {
  fields: readonly BoFilterField[];
  value: BoFilterSettings;
  onChange: (settings: BoFilterSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const usable = fields.filter(field => field.filterable);
  function commit(next: BoFilterSettings) {
    if (validateBoFilterSettings(next, fields)) onChange(next);
  }
  function changeRules(filters: Rule[], combinator = value.group.combinator) {
    commit({ ...value, group: { combinator, filters } });
  }
  function changeRule(index: number, replacement: Rule) {
    changeRules(value.group.filters.map((rule, i) => i === index ? replacement : rule));
  }
  return <div style={{ position: "relative" }}>
    <button type="button" aria-expanded={open} aria-controls="bo-grid-filter-settings" aria-label="Cài đặt bảng" onClick={() => setOpen(!open)}>☷</button>
    {open ? <section id="bo-grid-filter-settings" aria-label="Table filter settings" style={{ position: "absolute", zIndex: 4, right: 0, background: "white", padding: 16, border: "1px solid #ddd", minWidth: 405, maxWidth: "min(95vw, 480px)" }}>
      <label>Kết hợp điều kiện <select aria-label="Filter combinator" value={value.group.combinator} onChange={event => changeRules([...value.group.filters], event.target.value as "and" | "or")}><option value="and">AND · Tất cả</option><option value="or">OR · Bất kỳ</option></select></label>
      {value.group.filters.map((rule, index) => {
        const field = usable.find(item => item.key === rule.field) ?? usable[0];
        const allowed = field ? operators[field.type] : [];
        return <fieldset key={index} aria-label={`Filter rule ${index + 1}`} style={{ marginBlock: 8 }}>
          <legend>Điều kiện {index + 1}</legend>
          <label>Property <select aria-label={`Filter property ${index + 1}`} value={rule.field} onChange={event => { const nextField = usable.find(item => item.key === event.target.value); if (nextField) changeRule(index, initialRule(nextField)); }}>{usable.map(item => <option key={item.key} value={item.key}>{item.key}</option>)}</select></label>
          <label>Operator <select aria-label={`Filter operator ${index + 1}`} value={rule.operator} onChange={event => changeRule(index, { ...rule, operator: event.target.value as BoTypedFilterOperator })}>{allowed.map(op => <option key={op} value={op}>{op}</option>)}</select></label>
          {!["is_empty", "is_not_empty"].includes(rule.operator) ? <label>Value <input aria-label={`Filter value ${index + 1}`} value={rule.value ?? ""} onChange={event => changeRule(index, { ...rule, value: event.target.value })} /></label> : null}
          <button type="button" onClick={() => changeRules(value.group.filters.filter((_, i) => i !== index))} aria-label={`Remove filter rule ${index + 1}`}>Xóa điều kiện</button>
        </fieldset>;
      })}
      {usable.length ? <button type="button" onClick={() => changeRules([...value.group.filters, initialRule(usable[0])])}>+ Thêm điều kiện</button> : <p>No filterable properties.</p>}
      <fieldset aria-label="Hiển thị cột"><legend>Hiển thị cột</legend>{fields.map(field => <label key={field.key} style={{ display: "block" }}><input type="checkbox" checked={value.visibleKeys.includes(field.key)} onChange={event => { const next = event.target.checked ? [...value.visibleKeys, field.key] : value.visibleKeys.filter(key => key !== field.key); if (next.length) commit({ ...value, visibleKeys: next }); }} />{field.key}</label>)}</fieldset>
      <button type="button" onClick={() => changeRules([])}>Clear filters</button>
    </section> : null}
  </div>;
}
