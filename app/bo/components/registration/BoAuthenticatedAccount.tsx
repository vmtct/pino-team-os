"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LogoutButton } from "@/app/components/tos-shell/LogoutButton";

/** BO shell owns the authenticated account footer, not individual BO modules. */
export function BoAuthenticatedAccount({ displayName, email }: { displayName: string | null; email: string }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const update = () => setTarget(document.querySelector<HTMLElement>('#app[data-bo-runtime="react"]:not([data-surface="ho"]) #sidebar .sidebar-footer'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  const name = displayName?.trim() || email;
  const subtitle = name === email ? "Back Office" : email;
  return <>
    <style>{'#app[data-bo-runtime="react"]:not([data-surface="ho"]) .sidebar-footer:has(>.bo-auth-account)>:not(.bo-auth-account){display:none}#app[data-bo-runtime="react"]:not([data-surface="ho"]) .sidebar-footer>.bo-auth-account{display:contents}'}</style>
    {target ? createPortal(<div className="bo-auth-account"><div className="avatar">{name.charAt(0).toUpperCase()}</div><div><strong>{name}</strong><small>{subtitle}</small></div><LogoutButton /></div>, target) : null}
  </>;
}
