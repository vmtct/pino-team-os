"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { boDataGridRange, type BoDataGridSortDirection } from "@/lib/bo-data-grid-state";
import styles from "./bo-data-grid.module.css";
import { BoInlineDraftCell } from "./BoInlineDraftCell";
import { type BoInlineEdit, type BoInlineEditValue } from "@/lib/bo-inline-edit-state";
import { BoGridFilterSettings } from "./BoGridFilterSettings";
import { BoSharedViewTabs } from "./BoSharedViewTabs";
import type { BoPublicViewRuntime } from "@/lib/bo-public-view-runtime";
import { applyBoFilterSettings, type BoFilterField, type BoFilterSettings } from "@/lib/bo-filter-settings-state";

export type BoDataGridColumn<Row> = {
  key: string;
  header: ReactNode;
  render: (row: Row) => ReactNode;
  draftValue?: (row: Row) => BoInlineEditValue;
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
  typedFilterSettings,
  publicViewRuntime,
  typedFilterFields,
  onTypedFilterSettingsChange,
  onOpenFilters,
  onOpenSort,
  onOpenColumns,
  onRefresh,
  resultLabel,
  stale = false,
  toolbarActions,
  showToolbar = true,
  pagination,
  selectedRowKey = null,
  editableFieldKeys,
  onStageCellEdit,
  onRowOpen,
  quickViewOpener = false,
  rowsAlreadyFiltered = false,
  columnOrder,
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
  typedFilterSettings?: BoFilterSettings;
  publicViewRuntime?: BoPublicViewRuntime;
  typedFilterFields?: readonly BoFilterField[];
  onTypedFilterSettingsChange?: (settings: BoFilterSettings) => void;
  onOpenFilters?: () => void;
  onOpenSort?: () => void;
  onOpenColumns?: () => void;
  onRefresh?: () => void;
  resultLabel?: string;
  stale?: boolean;
  toolbarActions?: ReactNode;
  /** PAP-1129: explicitly suppress toolbar DOM for embedded read-only tables; default preserves BO behavior. */
  showToolbar?: boolean;
  pagination?: BoDataGridPagination;
  selectedRowKey?: string | null;
  editableFieldKeys?: ReadonlySet<string>;
  onStageCellEdit?: (edit: BoInlineEdit) => void;
  onRowOpen?: (row: Row) => void;
  /** Opt-in V2.3 first-cell Quick View control; no behavior without onRowOpen. */
  quickViewOpener?: boolean;
  /** Domain filtering runs before pagination; do not filter nested or paged rows twice. */
  rowsAlreadyFiltered?: boolean;
  columnOrder?: readonly string[];
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  const captionId = useId();
  const range = pagination ? boDataGridRange(pagination.page, pagination.pageSize, pagination.total) : null;
  // V2.3: only the explicit opener opens the drawer; legacy rows retain click-to-open.
  const interactiveRows = Boolean(onRowOpen) && !quickViewOpener;
  const showQuickViewOpener = quickViewOpener && Boolean(onRowOpen);
  const visibleColumns = (typedFilterSettings && typedFilterFields && typedFilterSettings.visibleKeys.length
    ? columns.filter((column) => typedFilterSettings.visibleKeys.includes(column.key))
    : columns).slice().sort((a, b) => (columnOrder?.includes(a.key) ? columnOrder.indexOf(a.key) : 10000 + columns.indexOf(a)) - (columnOrder?.includes(b.key) ? columnOrder.indexOf(b.key) : 10000 + columns.indexOf(b)));
  const visibleRows = !rowsAlreadyFiltered && typedFilterSettings && typedFilterFields
    ? applyBoFilterSettings(rows as readonly Record<string, unknown>[], typedFilterSettings, typedFilterFields) as readonly Row[]
    : rows;

  function openRow(event: KeyboardEvent<HTMLTableRowElement>, row: Row) {
    if (!onRowOpen || !["Enter", " "].includes(event.key) || isInteractiveDescendant(event.target, event.currentTarget)) return;
    event.preventDefault();
    onRowOpen(row);
  }

  return <section className={styles.surface} aria-busy={state === "loading" || undefined}>
    {publicViewRuntime ? <BoSharedViewTabs runtime={publicViewRuntime} /> : null}
    {showToolbar ? <div className={styles.toolbar}>
      {onSearchChange ? <label className={styles.searchBox}>
        <span aria-hidden="true">⌕</span>
        <input value={search ?? ""} onChange={(event) => onSearchChange(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
      </label> : null}
      {typedFilterSettings && typedFilterFields && onTypedFilterSettingsChange ? <BoGridFilterSettings fields={typedFilterFields} value={typedFilterSettings} onChange={onTypedFilterSettingsChange} /> : null}
      {onOpenFilters ? <button className={styles.toolButton} type="button" onClick={onOpenFilters}>☷ Filter{filterChips.length ? <b>{filterChips.length}</b> : null}</button> : null}
      {onOpenSort ? <button className={styles.toolButton} type="button" onClick={onOpenSort}>↕ Sort</button> : null}
      {onOpenColumns ? <button className={styles.toolButton} type="button" onClick={onOpenColumns}>▥ Columns</button> : null}
      <div className={styles.toolbarSpacer} />
      {resultLabel ? <span className={styles.resultLabel}>{resultLabel}</span> : null}
      {stale ? <span className={styles.staleBadge}>Stale</span> : null}
      {onRefresh ? <button className={styles.iconButton} type="button" onClick={onRefresh} aria-label="Refresh data">↻</button> : null}
      {toolbarActions}
    </div> : null}

    {filterChips.length ? <div className={styles.filterBar} aria-label="Active filters">
      {filterChips.map((chip) => <span className={styles.filterChip} key={chip.key}>
        <span>{chip.label}{chip.value ? ` is ${chip.value}` : ""}</span>
        {chip.onClear ? <button type="button" onClick={chip.onClear} aria-label={`Clear ${chip.label} filter`}>×</button> : null}
      </span>)}
    </div> : null}

    <div className={styles.tableViewport}>
      <table aria-describedby={captionId}>
        <caption id={captionId}>{caption}</caption>
        <thead><tr>{showQuickViewOpener ? <th scope="col" className={styles.quickViewOpenerCell}><span className={styles.visuallyHidden}>Quick View</span></th> : null}{visibleColumns.map((column) => {
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
          {state === "loading" ? <SkeletonRows columns={visibleColumns.length + (showQuickViewOpener ? 1 : 0)} /> : null}
          {state === "ready" ? visibleRows.map((row) => {
            const key = rowKey(row);
            return <tr
              key={key}
              data-interactive={interactiveRows || undefined}
              data-selected={selectedRowKey === key || undefined}
              tabIndex={interactiveRows ? 0 : undefined}
              aria-selected={interactiveRows ? selectedRowKey === key : undefined}
              onClick={interactiveRows ? (event) => { if (!isInteractiveDescendant(event.target, event.currentTarget)) onRowOpen?.(row); } : undefined}
              onKeyDown={interactiveRows ? (event) => openRow(event, row) : undefined}
            >{showQuickViewOpener ? <td className={styles.quickViewOpenerCell}><button type="button" className={styles.quickViewOpenerButton} onClick={() => onRowOpen?.(row)} aria-label={`Open Quick View for ${key}`} title="Quick View">↗</button></td> : null}{visibleColumns.map((column) => <td key={column.key} data-align={column.align ?? "left"} data-sticky={column.sticky || undefined} style={columnStyle(column)}>{onStageCellEdit && editableFieldKeys?.has(column.key) && column.draftValue ? <BoInlineDraftCell rowKey={key} field={column.key} value={column.draftValue(row)} editable={true} onStage={onStageCellEdit} /> : column.render(row)}</td>)}</tr>;
          }) : null}
        </tbody>
      </table>
      {state !== "ready" && state !== "loading" ? <BoDataGridState kind={state} message={stateMessage} /> : null}
      {state === "ready" && !visibleRows.length ? <BoDataGridState kind="empty" title={emptyTitle} message={emptyMessage} /> : null}
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
  const [feedback, setFeedback] = useState("");
  async function copyId(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setFeedback("Copied");
    } catch {
      setFeedback("Copy failed");
    }
  }
  return <span className={styles.canonicalId}><code title={value}>{value}</code><button type="button" onClick={(event) => void copyId(event)} aria-label={label}>⧉</button><span className={styles.copyFeedback} role="status" aria-live="polite">{feedback}</span></span>;
}
export function BoDataGridBadge({ children }: { children: ReactNode }) {
  return <span className={styles.badge}>{children}</span>;
}

export type BoDrawerMode = "view" | "create" | "edit";
export type BoDrawerSize = "sm" | "md" | "lg";
export type BoDrawerProps = {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  mode?: BoDrawerMode;
  size?: BoDrawerSize;
  busy?: boolean;
  /** Domain-owned guard: return false to keep unsaved work open. */
  canClose?: () => boolean;
};

/**
 * Canonical BO drawer shell. Owns interaction/accessibility/layout only.
 * Each module owns fields, validation, authorization and mutations.
 */
export function BoDrawer({ title, eyebrow, onClose, children, footer, mode = "view", size = "md", busy = false, canClose }: BoDrawerProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const labelId = useId();
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const canCloseRef = useRef(canClose);
  onCloseRef.current = onClose;
  busyRef.current = busy;
  canCloseRef.current = canClose;

  function requestClose() {
    if (busyRef.current || (canCloseRef.current && !canCloseRef.current())) return;
    onCloseRef.current();
  }
  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const activeDialog = dialog;
    const restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((node) =>
      !node.hasAttribute("disabled") && node.getAttribute("aria-hidden") !== "true" && node.getAttribute("tabindex") !== "-1"
    );
    (focusable()[0] ?? dialog).focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
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
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    dialog.addEventListener("keydown", handleKeyDown);
    return () => {
      dialog.removeEventListener("keydown", handleKeyDown);
      if (restoreFocus?.isConnected) restoreFocus.focus();
    };
  }, []);

  return <>
    <button type="button" className={styles.peekBackdrop} onClick={requestClose} aria-label="Close detail" tabIndex={-1} />
    <aside
      ref={dialogRef}
      className={styles.peek}
      data-mode={mode}
      data-size={size}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      aria-busy={busy || undefined}
      tabIndex={-1}
    >
      <header className={styles.peekHeader}>
        <div>{eyebrow ? <span>{eyebrow}</span> : null}<h2 id={labelId}>{title}</h2></div>
        <button type="button" disabled={busy} onClick={requestClose} aria-label="Close detail">×</button>
      </header>
      <div className={styles.peekBody}>{children}</div>
      {footer ? <footer className={styles.peekFooter}>{footer}</footer> : null}
    </aside>
  </>;
}

/** Kept for already-migrated BO views; uses the same single drawer implementation. */
export function BoDataGridSidePeek(props: Pick<BoDrawerProps, "title" | "eyebrow" | "onClose" | "children" | "footer">) {
  return <BoDrawer {...props} />;
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
