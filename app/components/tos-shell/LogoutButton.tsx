"use client";

import { useState } from "react";

export function LogoutButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch("/api/staff-auth/logout", { method: "POST", cache: "no-store" });
      if (!response.ok) throw new Error("logout_failed");
      window.location.replace("/staff-login");
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return <button type="button" className={className} onClick={logout} disabled={busy}
    aria-label={failed ? "Đăng xuất thất bại, thử lại" : "Đăng xuất"}
    title={failed ? "Không thể đăng xuất. Thử lại." : "Đăng xuất"}>
    {busy ? "Đang thoát…" : "Đăng xuất"}
  </button>;
}
