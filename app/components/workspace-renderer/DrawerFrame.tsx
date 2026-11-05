"use client";
import { useRef, type ReactNode } from "react";
import { useBoDialog } from "../../bo/components/registration/useBoDialog";

/** Existing dialog policy, DOM and selectors; no surface-specific stylesheet. */
export function DrawerFrame({ title, path, onClose, children, footer, headerActions }: { readonly headerActions?: ReactNode; readonly title: string; readonly path: string; readonly onClose: () => void; readonly children: ReactNode; readonly footer: ReactNode }) {
  const panel = useRef<HTMLElement>(null);
  useBoDialog(true, onClose, panel);
  return <><div className="drawer-scrim visible" id="drawer-scrim" onClick={onClose} aria-hidden="true" /><aside ref={panel} id="drawer" className="drawer open" role="dialog" aria-modal="true" aria-labelledby="drawer-title" data-tdd-shell="drawer">
    <div className="drawer-top"><div className="drawer-header-copy"><span id="drawer-path" className="drawer-path">{path}</span><h2 id="drawer-title" className="drawer-record-title">{title}</h2></div>{headerActions ? <div data-tdd-action-region="drawer.header">{headerActions}</div> : null}<button id="drawer-close" className="drawer-close" type="button" aria-label="Đóng" onClick={onClose}>×</button></div>
    <div id="drawer-content" className="drawer-content">{children}</div>
    <div id="drawer-footer" className="drawer-footer"><div className="lab-bottom">{footer}</div></div>
  </aside></>;
}
