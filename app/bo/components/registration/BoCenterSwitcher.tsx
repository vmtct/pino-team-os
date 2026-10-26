"use client";
import { useEffect, useId, useRef, useState } from "react";
/** Presentation only: no fabricated center identity or scope transition. */
export function BoCenterSwitcher() {
  const [open, setOpen] = useState(false), id = useId(), root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div className="workspace-switcher" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }} onKeyDown={event => { if (event.key === "Escape" && open) { event.stopPropagation(); event.preventDefault(); setOpen(false); trigger.current?.focus(); } }}><button type="button" ref={trigger} className="nav-workspace" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="nav-workspace-logo" src="https://assets.pinohouse.art/core/Pino%20Logo%20White.png" alt="PINO" /><span className="nav-workspace-copy"><strong>PINO House</strong><small>Back Office</small></span><span className="workspace-angle" aria-hidden="true">⌄</span></button><div className="workspace-menu" id={id} hidden={!open}><div className="workspace-menu-heading">Chuyển trung tâm</div><button type="button" className="workspace-center-option" disabled><span className="workspace-center-option-name">Chuyển trung tâm chưa khả dụng</span></button></div></div>;
}
