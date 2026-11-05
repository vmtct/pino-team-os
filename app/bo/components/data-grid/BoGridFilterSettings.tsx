"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type BoFilterField, type BoFilterSettings, validateBoFilterSettings } from "@/lib/bo-filter-settings-state";
import { type BoTypedFilter, type BoTypedFilterOperator } from "@/lib/bo-typed-filter";
import styles from "./bo-grid-filter-settings.module.css";

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
  const [anchor, setAnchor] = useState({ left: 12, top: 68, width: 405, mobile: false });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const id = useId();
  const usable = fields.filter((field) => field.filterable);
  const commit = (group: BoFilterSettings["group"]) => {
    const next = { ...value, group };
    if (validateBoFilterSettings(next, fields)) onChange(next);
  };
  const changeRule = (index: number, rule: BoTypedFilter) =>
    commit({ ...value.group, filters: value.group.filters.map((item, at) => at === index ? rule : item) });
  const close = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    const position = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const mobile = window.innerWidth <= 640;
      const width = Math.min(405, window.innerWidth - 24);
      const left = mobile ? 12 : Math.max(12, Math.min(r.left, window.innerWidth - width - 12));
      const top = mobile ? 0 : Math.max(12, Math.min(r.bottom + 6, window.innerHeight - Math.min(540, window.innerHeight * 0.72) - 12));
      setAnchor({ left, top, width, mobile });
    };
    const outside = (event: PointerEvent) => {
      if (dialogRef.current?.contains(event.target as Node) || triggerRef.current?.contains(event.target as Node)) return;
      close();
    };
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
    };
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keys);
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keys);
    };
  }, [open]);

  return <>
    <button ref={triggerRef} type="button" className={styles.trigger} aria-expanded={open}
      aria-controls={id} aria-haspopup="dialog" aria-label="Cài đặt bảng" onClick={() => setOpen((current) => !current)}>☷</button>
    {open && typeof document !== "undefined" && createPortal(
      <>
        {anchor.mobile ? <button type="button" className={styles.backdrop} tabIndex={-1} aria-label="Đóng cài đặt bảng" onClick={close} /> : null}
        <section ref={dialogRef} id={id} role="dialog" tabIndex={-1} aria-modal={anchor.mobile}
          aria-label="Cài đặt bộ lọc và cột" className={styles.panel}
          data-mobile={anchor.mobile || undefined}
          style={anchor.mobile ? undefined : { left: anchor.left, top: anchor.top, width: anchor.width }}>
          <header className={styles.header}><strong>Cài đặt bảng</strong><button type="button" aria-label="Đóng cài đặt bảng" onClick={close}>×</button></header>
          <div className={styles.content}>
            <label className={styles.field}>Điều kiện
              <select aria-label="Kết hợp bộ lọc" value={value.group.combinator} onChange={(event) => commit({ ...value.group, combinator: event.target.value as "and" | "or" })}>
                <option value="and">Tất cả (AND)</option><option value="or">Bất kỳ (OR)</option>
              </select>
            </label>
            {value.group.filters.map((rule, index) => {
              const selected = usable.find((field) => field.key === rule.field);
              return <fieldset className={styles.rule} key={index} aria-label={`Bộ lọc ${index + 1}`}>
                <legend>Bộ lọc {index + 1}</legend>
                <label className={styles.field}>Thuộc tính
                  <select aria-label={`Filter property ${index + 1}`} value={rule.field} onChange={(event) => {
                    const field = usable.find((item) => item.key === event.target.value);
                    if (field) changeRule(index, initialRule(field));
                  }}>{usable.map((field) => <option key={field.key} value={field.key}>{field.key}</option>)}</select>
                </label>
                {selected && <><label className={styles.field}>Điều kiện
                  <select aria-label={`Filter operator ${index + 1}`} value={rule.operator} onChange={(event) => changeRule(index, { ...rule, operator: event.target.value as BoTypedFilterOperator })}>
                    {operators(selected.type).map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                </label>
                  {!["is_empty", "is_not_empty"].includes(rule.operator) && <label className={styles.field}>Giá trị
                    {selected.type === "boolean" ?
                      <select aria-label={`Filter value ${index + 1}`} value={rule.value ?? "false"} onChange={(event) => changeRule(index, { ...rule, value: event.target.value })}><option value="true">Có</option><option value="false">Không</option></select> :
                      <input aria-label={`Filter value ${index + 1}`} type={selected.type === "number" ? "number" : selected.type === "date" ? "date" : "text"} value={rule.value ?? ""} onChange={(event) => changeRule(index, { ...rule, value: event.target.value })} />}
                  </label>}</>}
                <button type="button" onClick={() => commit({ ...value.group, filters: value.group.filters.filter((_, at) => at !== index) })}>Xóa bộ lọc</button>
              </fieldset>;
            })}
            <button type="button" disabled={!usable.length} onClick={() => usable[0] && commit({ ...value.group, filters: [...value.group.filters, initialRule(usable[0])] })}>＋ Thêm bộ lọc</button>
            <fieldset className={styles.rule} aria-label="Hiển thị cột"><legend>Hiển thị cột</legend>{fields.map((field) =>
              <label key={field.key} className={styles.checkbox}><input type="checkbox" checked={value.visibleKeys.includes(field.key)} onChange={(event) => {
                const next = event.target.checked ? [...value.visibleKeys, field.key] : value.visibleKeys.filter((key) => key !== field.key);
                if (next.length && validateBoFilterSettings({ ...value, visibleKeys: next }, fields)) onChange({ ...value, visibleKeys: next });
              }} />{field.key}</label>)}
            </fieldset>
            <button type="button" onClick={() => commit({ ...value.group, filters: [] })}>Xóa điều kiện lọc</button>
          </div>
        </section>
      </>, document.body)}
  </>;
}
