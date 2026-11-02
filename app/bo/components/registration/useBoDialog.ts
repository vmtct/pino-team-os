"use client";
import { useEffect, useRef, type RefObject } from "react";
import { handleDialogKey } from "@/app/components/workspace-renderer/dialog";
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
      const editorOpen = Boolean(document.querySelector('.edit-popover:not(.hidden)'));
      const items = !editorOpen && e.key === "Tab" ? focusables() : [];
      handleDialogKey(e, { editorOpen, first: items[0], last: items.at(-1), active: document.activeElement, containsActive: Boolean(panel.current?.contains(document.activeElement)), close: () => closeRef.current() });
    };
    document.addEventListener("keydown", handler);
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = previousOverflow; if (origin?.isConnected) origin.focus(); };
  }, [open, panel]);
}
