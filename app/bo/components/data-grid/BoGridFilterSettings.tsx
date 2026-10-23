"use client";

import { useState } from "react";
import { type BoFilterField, type BoFilterSettings, validateBoFilterSettings } from "@/lib/bo-filter-settings-state";
import { type BoTypedFilter, type BoTypedFilterOperator } from "@/lib/bo-typed-filter";

const operators = (type: BoFilterField["type"]): BoTypedFilterOperator[] =>
  type === "text" ? ["contains", "not_contains", "equals", "not_equals", "is_empty", "is_not_empty"] : ["equals", "not_equals", "is_empty", "is_not_empty"];

function initialRule(field: BoFilterField): BoTypedFilter {
  return { field: field.key, operator: field.type === "text" ? "contains" : "equals", value: field.type === "boolean" ? "false" : field.type === "number" ? "0" : "" };
}

export function BoGridFilterSettings({ fields, value, onChange }: {
  fields: readonly BoFilterField[];
  value: BoFilterSettings;
  onChange: (settings: BoFilterSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const usable = fields.filter((field) => field.filterable);
  const commit = (group: BoFilterSettings["group"]) => {
    const next = { ...value, group };
    if (validateBoFilterSettings(next, fields)) onChange(next);
  };
  const changeRule = (index: number, rule: BoTypedFilter) =>
    commit({ ...value.group, filters: value.group.filters.map((item, at) => at === index ? rule : item) });
  return <div style={{ position: "relative" }}>
    <button type="button" aria-expanded={open} aria-controls="bo-grid-filter-settings" aria-label="Cài đặt bảng" onClick={() => setOpen(!open)}>☷</button>
    {open ? <section id="bo-grid-filter-settings" aria-label="Table filter settings" style={{ position: "absolute", zIndex: 4, right: 0, background: "white", padding: 16, border: "1px solid #ddd", width: "min(405px, calc(100vw - 24px))", maxHeight: "75vh", overflowY: "auto" }}>
      <label>Điều kiện <select aria-label="Kết hợp bộ lọc" value={value.group.combinator} onChange={(event) => commit({ ...value.group, combinator: event.target.value as "and" | "or" })}>
        <option value="and">Tất cả (AND)</option><option value="or">Bất kỳ (OR)</option>
      </select></label>
      {value.group.filters.map((rule, index) => {
        const selected = usable.find((field) => field.key === rule.field);
        return <fieldset key={index} aria-label={`Bộ lọc ${index + 1}`}>
          <legend>Bộ lọc {index + 1}</legend>
          <label>Property <select aria-label={`Filter property ${index + 1}`} value={rule.field} onChange={(event) => {
            const field = usable.find((item) => item.key === event.target.value);
            if (field) changeRule(index, initialRule(field));
          }}>{usable.map((field) => <option key={field.key} value={field.key}>{field.key}</option>)}</select></label>
          {selected ? <><label>Operator <select aria-label={`Filter operator ${index + 1}`} value={rule.operator} onChange={(event) => changeRule(index, { ...rule, operator: event.target.value as BoTypedFilterOperator })}>
            {operators(selected.type).map((op) => <option key={op} value={op}>{op}</option>)}
          </select></label>
          {!["is_empty", "is_not_empty"].includes(rule.operator) ? <label>Value {selected.type === "boolean" ?
            <select aria-label={`Filter value ${index + 1}`} value={rule.value ?? "false"} onChange={(event) => changeRule(index, { ...rule, value: event.target.value })}><option value="true">True</option><option value="false">False</option></select> :
            <input aria-label={`Filter value ${index + 1}`} type={selected.type === "number" ? "number" : selected.type === "date" ? "date" : "text"} value={rule.value ?? ""} onChange={(event) => changeRule(index, { ...rule, value: event.target.value })} />}
          </label> : null}</> : null}
          <button type="button" aria-label={`Xóa bộ lọc ${index + 1}`} onClick={() => commit({ ...value.group, filters: value.group.filters.filter((_, at) => at !== index) })}>Xóa</button>
        </fieldset>;
      })}
      <button type="button" disabled={!usable.length} onClick={() => usable[0] && commit({ ...value.group, filters: [...value.group.filters, initialRule(usable[0])] })}>+ Thêm bộ lọc</button>
      <fieldset aria-label="Hiển thị cột"><legend>Hiển thị cột</legend>{fields.map((field) => <label key={field.key} style={{ display: "block" }}><input type="checkbox" checked={value.visibleKeys.includes(field.key)} onChange={(event) => {
        const next = event.target.checked ? [...value.visibleKeys, field.key] : value.visibleKeys.filter((key) => key !== field.key);
        if (next.length && validateBoFilterSettings({ ...value, visibleKeys: next }, fields)) onChange({ ...value, visibleKeys: next });
      }} />{field.key}</label>)}</fieldset>
      <button type="button" onClick={() => commit({ ...value.group, filters: [] })}>Clear filters</button>
    </section> : null}
  </div>;
}
