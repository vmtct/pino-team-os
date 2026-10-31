"use client";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { frozenPrefix, normalizeFreezeBoundary } from "@/lib/tdd-column-freeze";
import { BoViewTabs } from "./BoViewTabs";
import { BoValue } from "./BoValue";
import { BoFilters, type BoSavedView, type BoTableUpdate } from "./BoTableSettings";
import { display, opLabels, tableRows, type BoModule, type BoRecord, type BoTableState } from "@/lib/bo-registration";
import type { TablePolicy } from "@/app/components/workspace-renderer/TablePolicy";
import { registeredTableRows } from "@/app/components/workspace-renderer/tableRows";
export function BoDataTable({ module, rows, loadState, value, update, page, setPage, onOpen, onPrimaryCellOpen, selected, onSettings, filterOpen, setFilterOpen, views, changeViews, activeView, applyView, reset, undo, canUndo, minimal = false, legacyStyles = false, showChrome = true, policy, serverTotal, onCellEdit, builtInViews, freezeEnabled = false }: { freezeEnabled?: boolean; policy?: TablePolicy; serverTotal?: number; onCellEdit?: (record: BoRecord, field: string, anchor: HTMLButtonElement) => void; builtInViews?: ReactNode; legacyStyles?: boolean; minimal?: boolean; showChrome?: boolean; module: BoModule; rows: BoRecord[]; loadState: string; value: BoTableState; update: BoTableUpdate; page: number; setPage: (p: number) => void; onOpen: (r: BoRecord) => void; onPrimaryCellOpen?: (r: BoRecord) => void; selected?: string; onSettings: (s: string) => void; filterOpen: boolean; setFilterOpen: (v: boolean) => void; views: BoSavedView[]; changeViews: (v: BoSavedView[]) => void; activeView: string | null; applyView: (v: BoSavedView | null) => void; reset: () => void; undo: () => void; canUndo: boolean }) {
  const fields = useMemo(() => value.order.filter(key => value.visible.includes(key)).map(key => module.fields.find(f => f.key === key)!), [value.order, value.visible, module.fields]);
  const found = serverTotal !== undefined ? rows : policy ? registeredTableRows(rows, module.fields, value, policy) : tableRows(rows, module.fields, value);
  const total = serverTotal ?? found.length, pages = Math.max(1, Math.ceil(total / value.pageSize)), current = Math.min(page, pages), offset = (current - 1) * value.pageSize, visible = serverTotal !== undefined ? found : found.slice(offset, offset + value.pageSize);
  const identity = policy?.identity ?? "name";
  const scrollRef = useRef<HTMLDivElement>(null);
  const [freezeMenu, setFreezeMenu] = useState<{ key: string; x: number; y: number } | null>(null);
  const freezeTrigger = useRef<HTMLElement | null>(null);
  const [freezeNotice, setFreezeNotice] = useState("");
  const frozenThrough = freezeEnabled ? normalizeFreezeBoundary(value.frozenThrough, value.order, value.visible) : null;
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!freezeEnabled || !scroll) return;
    const table = scroll.querySelector<HTMLTableElement>("#typed-table");
    if (!table) return;
    function measure() {
      if (!table) return;
      const widths: Record<string, number> = {};
      const headers = [...table.querySelectorAll<HTMLTableCellElement>("thead th[data-column]")];
      for (const header of headers) widths[header.dataset.column!] = header.getBoundingClientRect().width;
      const opener = table.querySelector<HTMLElement>("thead th.quick-open-th")?.getBoundingClientRect().width ?? 37;
      const prefix = frozenPrefix(fields.map(f => f.key), frozenThrough, widths, opener, scroll!.clientWidth);
      const offsets = new Map(prefix.map(v => [v.key, v.left]));
      for (const cell of table.querySelectorAll<HTMLElement>("th[data-column],td[data-freeze-column]")) {
        const left = offsets.get(cell.dataset.column ?? cell.dataset.freezeColumn ?? "");
        if (left === undefined) { delete cell.dataset.tddFreezeCell; cell.style.removeProperty("--tdd-freeze-left"); }
        else { cell.dataset.tddFreezeCell = ""; cell.style.setProperty("--tdd-freeze-left", left + "px"); }
      }
      scroll!.dataset.tddFreeze = "";
      scroll!.dataset.tddFreezeLimit = prefix.at(-1)?.key ?? "";
      setFreezeNotice(frozenThrough && prefix.at(-1)?.key !== frozenThrough ? "Màn hình quá hẹp: đã giảm số cột cố định để giữ vùng cuộn." : "");
    }
    measure();
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resize?.observe(scroll);
    for (const header of table.querySelectorAll("thead th")) resize?.observe(header);
    window.addEventListener("resize", measure);
    return () => { resize?.disconnect(); window.removeEventListener("resize", measure); };
  }, [freezeEnabled, frozenThrough, fields, rows, loadState, value]);
  useEffect(() => {
    if (!freezeMenu) return;
    const dismiss = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("#tdd-freeze-menu,[data-freeze-trigger]")) setFreezeMenu(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setFreezeMenu(null); freezeTrigger.current?.focus({ preventScroll: true }); } };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    document.querySelector<HTMLButtonElement>("#tdd-freeze-menu [role=menuitem]")?.focus();
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [freezeMenu]);
  const openFreeze = (key: string, anchor: HTMLElement) => {
    freezeTrigger.current = anchor.matches("[data-freeze-trigger]") ? anchor : anchor.querySelector<HTMLElement>("[data-freeze-trigger]");
    const box = anchor.getBoundingClientRect();
    setFreezeMenu({ key, x: Math.min(box.left, window.innerWidth - 215), y: Math.min(box.bottom, window.innerHeight - 95) });
  };
  const commitFreeze = (boundary: string | null) => {
    setFreezeMenu(null);
    update({ frozenThrough: boundary });
    freezeTrigger.current?.focus({ preventScroll: true });
  };

  const candidates = [...new Set([...found.map(r => display(r[value.group])), ...(module.fields.find(f => f.key === value.group)?.options ?? [])])].sort((a, b) => a.localeCompare(b, "vi"));
  if (value.groupDesc) candidates.reverse();
  function row(record: BoRecord) {
    return <tr key={record.id} data-record={record.id} className={selected === record.id ? "selected" : ""}><td className="first-quick-cell"><button type="button" className="row-open" data-open={record.id} aria-label={"Quick View " + record.name} onClick={() => onOpen(record)}>↗</button></td>{fields.map(f => <td key={f.key} data-freeze-column={freezeEnabled ? f.key : undefined} className={legacyStyles ? undefined : "schema-column"} style={legacyStyles ? { width: f.w, minWidth: f.w } : { "--bo-column-width": f.w + "px" } as CSSProperties}><button type="button" className={"typed-cell" + (["id", "formula"].includes(f.type) ? " readonly" : "")} data-edit={f.key} aria-disabled={!(onCellEdit && policy?.edit.includes(f.key))} title={onCellEdit && policy?.edit.includes(f.key) ? "Sửa " + f.label : "Chỉ đọc"} onClick={onCellEdit && policy?.edit.includes(f.key) ? e => onCellEdit(record, f.key, e.currentTarget) : f.key === identity && onPrimaryCellOpen ? () => onPrimaryCellOpen(record) : undefined}><BoValue field={f} value={record[f.key]} /></button></td>)}</tr>;
  }
  return <div className="grid-card">{showChrome ? <><div className="view-tabs"><BoViewTabs builtIn={builtInViews} actions={policy?.viewActions} minimal={minimal} views={views} changeViews={changeViews} active={activeView} apply={applyView} onAdd={() => onSettings("views")} /><div className="tabs-right"><span id="table-count" className="table-meta">{total} bản ghi</span></div></div>
    <div className="toolbar"><label className="search-field"><span>⌕</span><input id="search" type="search" aria-label="Tìm bất kỳ giá trị nào" placeholder="Tìm bất kỳ giá trị nào..." disabled={policy?.search.length === 0} value={value.search} onChange={e => update({ search: e.target.value })} /></label><button id="filter-toggle" type="button" className="toolbar-button" aria-expanded={filterOpen} onClick={() => setFilterOpen(!filterOpen)}>☷ <span>Bộ lọc</span>{value.rules.length ? <b id="rules-count" className="filter-count">{value.rules.length}</b> : null}</button><button id="visible-columns" type="button" className="toolbar-button" onClick={() => onSettings("properties")}>▥ <span>Hiển thị thuộc tính</span></button><button id="reset-all" type="button" className="toolbar-button" onClick={reset}>↻ Đặt lại</button><button id="group-shortcut" type="button" className="toolbar-button" onClick={() => onSettings("group")}>▤ Nhóm</button><div className="toolbar-spacer" /><button id="undo-v22" type="button" className="toolbar-button" disabled={!canUndo} aria-label="Hoàn tác" title="Hoàn tác (Ctrl+Z)" onClick={undo}>↶</button></div>
    {filterOpen ? <><BoFilters fields={policy ? module.fields.filter(f => policy.filter.includes(f.key)) : module.fields} value={value} update={update} /><div className="rules-actions"><button type="button" id="save-view" className="save-view-btn" onClick={() => onSettings("views")}>＋ Lưu thành Quick View</button></div></> : null}
    <div id="active-chips" className={"filter-chips " + (value.rules.length ? "active" : "")}>{value.rules.map((rule, i) => <button type="button" className="chip" key={i} onClick={() => update({ rules: value.rules.filter((_, n) => n !== i) })}>{module.fields.find(f => f.key === rule.field)?.label} {opLabels[rule.op]} {rule.value} ×</button>)}</div>
    </> : null}
    <div className="table-scroll" data-tdd-freeze-viewport={freezeEnabled ? "" : undefined} id="table-scroll" ref={scrollRef}><table id="typed-table"><caption>{module.label}</caption><thead id="table-head"><tr><th className="quick-open-th" aria-label="Quick View" />{fields.map(f => <th key={f.key} data-column={f.key} onContextMenu={freezeEnabled && f.key !== identity && f.key !== "id" ? event => { event.preventDefault(); openFreeze(f.key, event.currentTarget); } : undefined} className={(legacyStyles ? "" : "schema-column ") + (f.key === identity ? "" : "column-draggable")} draggable={f.key !== identity} onDragStart={e => e.dataTransfer.setData("text/plain", f.key)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const key = e.dataTransfer.getData("text/plain"); if (key === identity || f.key === identity || !value.order.includes(key) || key === f.key) return; const order = value.order.filter(k => k !== key); order.splice(order.indexOf(f.key), 0, key); update({ order }); }} style={legacyStyles ? { width: f.w, minWidth: f.w } : { "--bo-column-width": f.w + "px" } as CSSProperties}><button type="button" data-sort={f.key} disabled={policy && !policy.sort.includes(f.key)} title={"Sắp xếp theo " + f.label} onClick={() => update({ sort: f.key, desc: value.sort === f.key ? !value.desc : false })}>{f.label} <span className="column-type">{f.icon}</span> <span className="sort-icon">{value.sort === f.key ? value.desc ? "↓" : "↑" : "↕"}</span></button>{freezeEnabled && f.key !== identity && f.key !== "id" ? <button type="button" className="row-open" data-freeze-trigger={f.key} aria-label={"Tùy chọn cố định cột " + f.label} aria-haspopup="menu" aria-expanded={freezeMenu?.key === f.key} onClick={event => openFreeze(f.key, event.currentTarget)} onKeyDown={event => { if ((event.key === "F10" && event.shiftKey) || event.key === "ArrowDown") { event.preventDefault(); openFreeze(f.key, event.currentTarget); } }}>⋯</button> : null}</th>)}</tr></thead><tbody id="table-body">{loadState !== "ready" ? <tr><td colSpan={fields.length + 1}><div className="empty-table" role={loadState === "loading" ? "status" : "alert"}>{loadState === "loading" ? "Đang tải dữ liệu…" : loadState}</div></td></tr> : !found.length ? <tr><td colSpan={fields.length + 1}><div className="empty-table"><strong>Không có bản ghi phù hợp</strong>Thử chỉnh điều kiện hoặc xóa bộ lọc.</div></td></tr> : value.group ? candidates.filter(group => !value.hiddenGroups.includes(group) && (!value.hideEmpty || visible.some(r => display(r[value.group]) === group))).map(group => <Fragment key={group}><tr className="group-heading-row"><td colSpan={fields.length + 1}><button type="button" className="group-toggle" aria-expanded={!value.collapsed.includes(group)} onClick={() => update({ collapsed: value.collapsed.includes(group) ? value.collapsed.filter(g => g !== group) : [...value.collapsed, group] })}><span className="group-caret">{value.collapsed.includes(group) ? "▸" : "▾"}</span><span className="group-pill">{group}</span><small>{found.filter(r => display(r[value.group]) === group).length} bản ghi</small></button></td></tr>{!value.collapsed.includes(group) ? visible.filter(r => display(r[value.group]) === group).map(row) : null}</Fragment>) : visible.map(row)}</tbody></table></div>
    {freezeNotice ? <p role="status" data-tdd-freeze-notice="" className="table-meta">{freezeNotice}</p> : null}
    <footer className="table-footer"><div><span id="result-count" className="result-label">{total} / {serverTotal ?? rows.length} bản ghi</span><span className="footer-dot">·</span></div><div className="pagination"><label>Hiển thị <select id="page-size" value={value.pageSize} onChange={e => update({ pageSize: Number(e.target.value) })}>{[8, 15, 30].map(n => <option key={n} value={n}>{n} dòng</option>)}</select></label><span id="page-range" className="page-counter">{found.length ? offset + 1 + "–" + Math.min(total, offset + value.pageSize) + " / " + total : "0 / 0"}</span><button type="button" id="prev-page" className="pager" aria-label="Trang trước" disabled={current <= 1} onClick={() => setPage(current - 1)}>‹</button><button type="button" id="next-page" className="pager" aria-label="Trang sau" disabled={current >= pages} onClick={() => setPage(current + 1)}>›</button></div></footer>
    {freezeMenu && freezeEnabled ? createPortal(<div id="tdd-freeze-menu" className="view-context" role="menu" aria-label={"Cố định cột " + (module.fields.find(f => f.key === freezeMenu.key)?.label ?? "")} data-tdd-freeze-menu="" onKeyDown={event => {
      const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')];
      if (!items.length || !["ArrowDown", "ArrowUp", "Home", "End", "Tab"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
        : (index + (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey) ? -1 : 1) + items.length) % items.length;
      items[next].focus();
    }} style={{ left: Math.max(8, freezeMenu.x), top: Math.max(8, freezeMenu.y) }}>
      <button role="menuitem" type="button" onClick={() => commitFreeze(freezeMenu.key)}>Cố định đến cột này</button>
      <button role="menuitem" type="button" disabled={fields.findIndex(f => f.key === freezeMenu.key) > fields.findIndex(f => f.key === frozenThrough)} onClick={() => {
        const visible = fields.map(f => f.key);
        const index = visible.indexOf(freezeMenu.key);
        commitFreeze(visible.slice(1, index).filter(key => key !== "id").at(-1) ?? null);
      }}>Bỏ cố định từ cột này</button>
    </div>, document.body) : null}
  </div>;
}
