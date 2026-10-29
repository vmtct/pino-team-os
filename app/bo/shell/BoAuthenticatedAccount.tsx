"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LogoutButton } from "@/app/components/tos-shell/LogoutButton";
import { resolveBoAccountLabel } from "@/lib/bo-account-label";
import styles from "./bo-account.module.css";

/** The BO runtime shell owns the authenticated account footer; feature modules do not. */
export function BoAuthenticatedAccount({ displayName, email }: { displayName: string | null; email: string }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const update = () => setTarget(document.querySelector<HTMLElement>('#app[data-bo-runtime="react"]:not([data-surface="ho"]) #sidebar .sidebar-footer'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  const { name, subtitle } = resolveBoAccountLabel(displayName, email);
  return <>
    <style>{'#app[data-bo-runtime="react"]:not([data-surface="ho"]) .sidebar-footer:has(>#bo-auth-account)>:not(#bo-auth-account){display:none}'}</style>
    {target ? createPortal(
      <div id="bo-auth-account" className={styles.account}>
        <div className={"avatar " + styles.avatar} aria-hidden="true">{Array.from(name)[0] ?? "@"}</div>
        <div className={styles.identity}><strong title={name}>{name}</strong><small>{subtitle}</small></div>
        <LogoutButton className={styles.logout} />
      </div>,
      target
    ) : null}
  </>;
}
