"use client";
import { useEffect, useRef, type RefObject } from "react";
/** One dialog policy for Quick View/settings. Restore the actual invoker. */
export function useBoDialog(open: boolean, close: () => void, panel: RefObject<HTMLElement | null>) {
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; }, [close]);
  useEffect(() => {
    if (!open || !panel.current) return;
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => [...panel.current!.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(e => e.tabIndex >= 0 && e.getClientRects().length);
    focusables()[0]?.focus();
    const handler = (e: KeyboardEvent) => {
      if (document.querySelector('.edit-popover:not(.hidden)')) return;
      if (e.key === "Escape") { e.preventDefault(); closeRef.current(); }
      if (e.key === "Tab") { const items = focusables(), first = items[0], last = items.at(-1); if (e.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) { e.preventDefault(); first?.focus(); } }
    };
    document.addEventListener("keydown", handler);
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = previousOverflow; if (origin?.isConnected) origin.focus(); };
  }, [open, panel]);
}
