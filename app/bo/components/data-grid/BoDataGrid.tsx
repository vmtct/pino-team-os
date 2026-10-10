"use client";

import { useEffect, useId, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { boDataGridRange, type BoDataGridSortDirection } from "@/lib/bo-data-grid-state";
import styles from "./bo-data-grid.module.css";

export type BoDataGridColumn<Row> = {
  key: string;
  header: ReactNode;
  render: (row: Row) => ReactNode;
  sortable?: boolean;
  minWidth?: number;
  width?: number | string;
  align?: "left" | "center" | "right";
  sticky?: boolean;
};

export type BoDataGridFilterChip = {
  key: string;
  label: string;
  value?: string;
  onClear?: () => void;
};

export type BoDataGridPagination = {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
};

export type BoDataGridLoadState = "ready" | "loading" | "error" | "permission";

export function BoDataGrid<Row>({
  rows,
  columns,
  rowKey,
  caption,
  state = "ready",
  stateMessage,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  sortKey = null,
  sortDirection = "asc",
  onSortChange,
  filterChips = [],
  onOpenFilters,
  onOpenSort,
  onOpenColumns,
  onRefresh,
  resultLabel,
  stale = false,
  toolbarActions,
  pagination,
  selectedRowKey = null,
  onRowOpen,
  emptyTitle = "No records",
  emptyMessage = "There is no canonical data for this view yet.",
}: {
  rows: readonly Row[];
  columns: readonly BoDataGridColumn<Row>[];
  rowKey: (row: Row) => string;
  caption: string;
  state?: BoDataGridLoadState;
  stateMessage?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  sortKey?: string | null;
  sortDirection?: BoDataGridSortDirection;
  onSortChange?: (key: string, direction: BoDataGridSortDirection) => void;
  filterChips?: readonly BoDataGridFilterChip[];
  onOpenFilters?: () => void;
  onOpenSort?: () => void;
  onOpenColumns?: () => void;
  onRefresh?: () => void;
  resultLabel?: string;
  stale?: boolean;
  toolbarActions?: ReactNode;
  pagination?: BoDataGridPagination;
  selectedRowKey?: string | null;
  onRowOpen?: (row: Row) => void;
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  const captionId = useId();
  const range = pagination ? boDataGridRange(pagination.page, pagination.pageSize, pagination.total) : null;
  const interactiveRows = Boolean(onRowOpen);

  function openRow(event: KeyboardEvent<HTMLTableRowElement>, row: Row) {
    if (!onRowOpen || !["Enter", " "].includes(event.key) || isInteractiveDescendant(event.target, event.currentTarget)) return;
    event.preventDefault();
    onRowOpen(row);
  }

  return <section className={styles.surface} aria-busy={state === "loading" || undefined}>
    <div className={styles.toolbar}>
      {onSearchChange ? <label className={styles.searchBox}>
        <span aria-hidden="true">⌕</span>
        <input value={search ?? ""} onChange={(event) => onSearchChange(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
      </label> : null}
      {onOpenFilters ? <button className={styles.toolButton} type="button" onClick={onOpenFilters}>☷ Filter{filterChips.length ? <b>{filterChips.length}</b> : null}</button> : null}
      {onOpenSort ? <button className={styles.toolButton} type="button" onClick={onOpenSort}>↕ Sort</button> : onSortChange ? <span className={styles.sortHint} aria-label={sortKey ? `Sorted by ${sortKey} ${sortDirection}` : "Not sorted"}>↕ Sort</span> : null}
      {onOpenColumns ? <button className={styles.toolButton} type="button" onClick={onOpenColumns}>▥ Columns</button> : null}
      <div className={styles.toolbarSpacer} />
      {resultLabel ? <span className={styles.resultLabel}>{resultLabel}</span> : null}
      {stale ? <span className={styles.staleBadge}>Stale</span> : null}
      {onRefresh ? <button className={styles.iconButton} type="button" onClick={onRefresh} aria-label="Refresh data">↻</button> : null}
      {toolbarActions}
    </div>

    {filterChips.length ? <div className={styles.filterBar} aria-label="Active filters">
      {filterChips.map((chip) => <span className={styles.filterChip} key={chip.key}>
        <span>{chip.label}{chip.value ? ` is ${chip.value}` : ""}</span>
        {chip.onClear ? <button type="button" onClick={chip.onClear} aria-label={`Clear ${chip.label} filter`}>×</button> : null}
      </span>)}
    </div> : null}

    <div className={styles.tableViewport}>
      <table aria-describedby={captionId}>
        <caption id={captionId}>{caption}</caption>
        <thead><tr>{columns.map((column) => {
          const activeSort = sortKey === column.key;
          const ariaSort = activeSort ? (sortDirection === "asc" ? "ascending" : "descending") : column.sortable ? "none" : undefined;
          const style = columnStyle(column);
          return <th key={column.key} scope="col" aria-sort={ariaSort} data-align={column.align ?? "left"} data-sticky={column.sticky || undefined} style={style}>
            {column.sortable && onSortChange ? <button type="button" className={styles.sortButton} onClick={() => onSortChange(column.key, activeSort && sortDirection === "asc" ? "desc" : "asc")}>
              <span>{column.header}</span><i aria-hidden="true">{activeSort ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</i>
            </button> : column.header}
          </th>;
        })}</tr></thead>
        <tbody>
          {state === "loading" ? <SkeletonRows columns={columns.length} /> : null}
          {state === "ready" ? rows.map((row) => {
            const key = rowKey(row);
            return <tr
              key={key}
              data-interactive={interactiveRows || undefined}
              data-selected={selectedRowKey === key || undefined}
              tabIndex={interactiveRows ? 0 : undefined}
              aria-selected={interactiveRows ? selectedRowKey === key : undefined}
              onClick={onRowOpen ? (event) => { if (!isInteractiveDescendant(event.target, event.currentTarget)) onRowOpen(row); } : undefined}
              onKeyDown={interactiveRows ? (event) => openRow(event, row) : undefined}
            >{columns.map((column) => <td key={column.key} data-align={column.align ?? "left"} data-sticky={column.sticky || undefined} style={columnStyle(column)}>{column.render(row)}</td>)}</tr>;
          }) : null}
        </tbody>
      </table>
      {state !== "ready" && state !== "loading" ? <BoDataGridState kind={state} message={stateMessage} /> : null}
      {state === "ready" && !rows.length ? <BoDataGridState kind="empty" title={emptyTitle} message={emptyMessage} /> : null}
    </div>

    {pagination ? <footer className={styles.pagination}>
      <label>Rows per page
        <select value={pagination.pageSize} onChange={(event) => pagination.onPageSizeChange?.(Number(event.target.value))} disabled={!pagination.onPageSizeChange}>
          {(pagination.pageSizeOptions ?? [10, 25, 50, 100]).map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <div className={styles.paginationNav}>
        <span>{range?.from ?? 0}–{range?.to ?? 0} of {range?.total ?? 0}</span>
        <button type="button" onClick={() => pagination.onPageChange(Math.max(1, (range?.page ?? 1) - 1))} disabled={!range || range.page <= 1} aria-label="Previous page">‹</button>
        <button type="button" onClick={() => pagination.onPageChange(Math.min(range?.pageCount ?? 1, (range?.page ?? 1) + 1))} disabled={!range || range.pageCount === 0 || range.page >= range.pageCount} aria-label="Next page">›</button>
      </div>
    </footer> : null}
  </section>;
}

export function BoDataGridState({ kind, title, message }: { kind: BoDataGridLoadState | "empty"; title?: string; message?: string }) {
  const copy = kind === "error"
    ? ["Unable to load this view", message ?? "Canonical data could not be loaded."]
    : kind === "permission"
      ? ["Access required", message ?? "Your current authority does not permit this data view."]
      : kind === "empty"
        ? [title ?? "No records", message ?? "There is no canonical data for this view yet."]
        : ["Loading canonical data…", message ?? "Resolving the current Back Office projection."];
  return <div className={styles.state} data-kind={kind} role={kind === "error" || kind === "permission" ? "alert" : undefined}><strong>{copy[0]}</strong><span>{copy[1]}</span></div>;
}

export function BoDataGridStatus({ value, tone = "neutral" }: { value: string; tone?: "success" | "neutral" | "warning" | "danger" | "info" }) {
  return <span className={styles.statusPill} data-tone={tone}><i aria-hidden="true" />{value.replaceAll("_", " ")}</span>;
}

export function BoDataGridCanonicalId({ value, label = "Copy canonical ID" }: { value: string; label?: string }) {
  return <span className={styles.canonicalId}><code title={value}>{value}</code><button type="button" onClick={(event) => { event.stopPropagation(); if (typeof navigator !== "undefined" && navigator.clipboard) void navigator.clipboard.writeText(value); }} aria-label={label}>⧉</button></span>;
}

export function BoDataGridBadge({ children }: { children: ReactNode }) {
  return <span className={styles.badge}>{children}</span>;
}

export function BoDataGridSidePeek({ title, eyebrow, onClose, children, footer }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const activeDialog = dialog;
    const restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => [...activeDialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((node) => !node.hasAttribute("disabled") && node.getAttribute("aria-hidden") !== "true");
    (focusable()[0] ?? activeDialog).focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        activeDialog.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    activeDialog.addEventListener("keydown", handleKeyDown);
    return () => {
      activeDialog.removeEventListener("keydown", handleKeyDown);
      if (restoreFocus?.isConnected) restoreFocus.focus();
    };
  }, []);

  return <>
    <button type="button" className={styles.peekBackdrop} onClick={onClose} aria-label="Close detail" tabIndex={-1} />
    <aside ref={dialogRef} className={styles.peek} role="dialog" aria-modal="true" aria-label={`${title} detail`} tabIndex={-1}>
      <header className={styles.peekHeader}><div>{eyebrow ? <span>{eyebrow}</span> : null}<h2>{title}</h2></div><button type="button" onClick={onClose} aria-label="Close detail">×</button></header>
      <div className={styles.peekBody}>{children}</div>
      {footer ? <footer className={styles.peekFooter}>{footer}</footer> : null}
    </aside>
  </>;
}

const FOCUSABLE_SELECTOR = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';

function isInteractiveDescendant(target: EventTarget | null, currentTarget: EventTarget | null) {
  return target instanceof Element
    && target !== currentTarget
    && Boolean(target.closest('a[href],button,input,select,textarea,[role="button"],[contenteditable="true"]'));
}

function SkeletonRows({ columns }: { columns: number }) {
  return <>{Array.from({ length: 6 }, (_, rowIndex) => <tr className={styles.skeletonRow} key={rowIndex}>{Array.from({ length: columns }, (_, columnIndex) => <td key={columnIndex}><span /></td>)}</tr>)}</>;
}

function columnStyle<Row>(column: BoDataGridColumn<Row>): CSSProperties {
  return {
    ...(column.minWidth ? { minWidth: column.minWidth } : {}),
    ...(column.width ? { width: column.width } : {}),
  };
}
