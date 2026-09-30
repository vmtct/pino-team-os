"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { BoShellContext } from "@/lib/bo-shell-gate";
import { shortDisplayName } from "@/lib/display-name";
import { LogoutButton } from "./LogoutButton";
import styles from "./bo-shell.module.css";

export function BoCurrentUserMenu({ currentUser }: { currentUser: BoShellContext }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const name = shortDisplayName(currentUser.displayName);
  const label = name || currentUser.email;
  const initial = name ? Array.from(name)[0] ?? "@" : "@";

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div className={styles.userMenu} ref={root}>
      <button type="button" className={styles.userButton} onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open}>
        <span>{initial}</span><strong>{label}</strong><i aria-hidden="true">⌄</i>
      </button>
      {open ? <div className={styles.userPopover} role="menu">
        <div className={styles.userIdentity}><strong>{currentUser.displayName ?? "Tài khoản Back Office"}</strong><small>{currentUser.email}</small></div>
        <Link href="/bo/profile" role="menuitem" onClick={() => setOpen(false)}>Hồ sơ của tôi</Link>
        <LogoutButton className={styles.userLogout} />
      </div> : null}
    </div>
  );
}
