"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useBoCenterSelection } from "./BoCenterSelection";

/** Canonical BO top-left Center control. Only an opted-in scoped adapter
 * activates choices; other BO modules remain disabled, never fake-switching. */
export function BoCenterSwitcher() {
  const selection = useBoCenterSelection();
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const choice = selection?.centers.find(c => c.id === selection.selected);
  const enabled = Boolean(selection && !selection.loading && selection.centers.length);
  const options = () => Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const moveFocus = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const items = options();
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && items.length) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 :
        (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next].focus();
    }
  };
  return <div className="workspace-switcher" ref={root}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}
    onKeyDown={event => { if (event.key === "Escape" && open) { event.stopPropagation(); event.preventDefault(); close(true); } }}>
    <button type="button" ref={trigger} className="nav-workspace"
      aria-haspopup={enabled ? "listbox" : undefined}
      aria-label={enabled ? `Trung tâm hiện tại: ${choice?.displayName ?? "Chưa chọn"}. Chuyển trung tâm` : "PINO House Back Office"}
      aria-expanded={open} aria-controls={id}
      onClick={() => setOpen(value => !value)}
      onKeyDown={event => {
        if (enabled && ["ArrowDown", "ArrowUp"].includes(event.key)) {
          event.preventDefault();
          setOpen(true);
          requestAnimationFrame(() => {
            const items = options();
            (items.find(c => c.getAttribute("aria-selected") === "true") ?? items[0])?.focus();
          });
        }
      }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="nav-workspace-logo" src="https://assets.pinohouse.art/core/Pino%20Logo%20White.png" alt="PINO" />
      <span className="nav-workspace-copy"><strong id="workspace-center-name">{choice?.displayName ?? "PINO House"}</strong><small>Back Office</small></span>
      <span className="workspace-angle" aria-hidden="true">⌄</span>
    </button>
    <div className="workspace-menu" id={id} hidden={!open}>
      <div className="workspace-menu-heading" id={id + "-heading"}>Chuyển trung tâm</div>
      {enabled && selection ? <div id="workspace-centers" role="listbox" aria-labelledby={id + "-heading"}>
        {selection.centers.map((c, index) => <button type="button" role="option"
          key={c.id} className="workspace-center-option" aria-selected={c.id === selection.selected}
          onClick={() => { selection.selectCenter(c.id); close(true); }}
          onKeyDown={event => {
            moveFocus(event, index);
            if (event.key === "Tab") setOpen(false);
          }}>
          <span className="workspace-center-option-name">{c.displayName}</span>
          <span className="workspace-center-check" aria-hidden="true">{c.id === selection.selected ? "✓" : ""}</span>
        </button>)}
      </div> : <button type="button" className="workspace-center-option" disabled>
        <span className="workspace-center-option-name">{selection?.loading ? "Đang tải cơ sở…" : "Chuyển trung tâm chưa khả dụng"}</span>
      </button>}
      {selection?.error ? <p role="alert">{selection.error}</p> : null}
    </div>
  </div>;
}
