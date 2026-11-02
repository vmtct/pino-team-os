"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LogoutButton } from "@/app/components/tos-shell/LogoutButton";
import { resolveBoAccountLabel } from "@/lib/bo-account-label";

/** BO shell account parity: exactly the HO footer visual treatment, without changing module/DS styles. */
const BO_ACCOUNT_STYLES = `
#app[data-bo-runtime="react"]:not([data-surface="ho"]) .sidebar-footer:has(> #bo-auth-account) > :not(#bo-auth-account) { display: none; }
#app[data-bo-runtime="react"]:not([data-surface="ho"]) #bo-auth-account { display: contents; }
#app[data-bo-runtime="react"]:not([data-surface="ho"]) #bo-auth-account > .avatar { background: #74283e; color: #fff; }
#app[data-bo-runtime="react"]:not([data-surface="ho"]) #bo-auth-account > div:nth-child(2) { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
#app[data-bo-runtime="react"]:not([data-surface="ho"]) #bo-auth-account > div:nth-child(2) :is(strong, small) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#app[data-bo-runtime="react"]:not([data-surface="ho"]) #bo-auth-account > div:nth-child(2) strong { color: #fff; font-size: 11px; }
#app[data-bo-runtime="react"]:not([data-surface="ho"]) #bo-auth-account > div:nth-child(2) small { color: #8c8ca9; font-size: 10px; }
#app[data-bo-runtime="react"]:not([data-surface="ho"]) #bo-auth-account > button { background: transparent; border: 1px solid #dec0cb; border-radius: 6px; color: #fff; cursor: pointer; flex-shrink: 0; font-size: 13px; font-weight: 400; line-height: normal; margin-left: auto; padding: 5px; white-space: nowrap; }
#app[data-bo-runtime="react"]:not([data-surface="ho"]) #bo-auth-account > button:hover:not(:disabled) { background: rgb(255 255 255 / 8%); }
#app[data-bo-runtime="react"]:not([data-surface="ho"]) #bo-auth-account > button:focus-visible { outline: 2px solid #dec0cb; outline-offset: 2px; }
#app[data-bo-runtime="react"]:not([data-surface="ho"]) #bo-auth-account > button:disabled { cursor: wait; opacity: .65; }
`;

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
    <style>{BO_ACCOUNT_STYLES}</style>
    {target ? createPortal(
      <div id="bo-auth-account">
        <div className="avatar" aria-hidden="true">{Array.from(name)[0] ?? "@"}</div>
        <div><strong title={name}>{name}</strong><small>{subtitle}</small></div>
        <LogoutButton />
      </div>,
      target
    ) : null}
  </>;
}
