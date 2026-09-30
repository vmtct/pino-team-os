"use client";

import { useEffect, useState } from "react";
import styles from "./tos-shell.module.css";

type SupportState =
  | { active: false; invalid: boolean }
  | {
      active: true;
      invalid: false;
      sessionId: string;
      mode: "VIEW" | "ACT";
      reason: string;
      expiresAt: string;
      actorUserId: string;
      actorEmail: string;
      subjectUserId: string;
      subjectStaffMemberId: string | null;
      subjectEmail: string;
    };

export function SupportSessionBanner() {
  const [state, setState] = useState<SupportState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    void fetch("/api/support-session/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("support_status_unavailable");
        const body = await response.json() as { data?: SupportState };
        if (!current) return;
        if (!body.data) throw new Error("support_status_invalid");
        if (!body.data.active && body.data.invalid) {
          window.location.replace("/staff-login?support=expired");
          return;
        }
        setState(body.data);
      })
      .catch(() => {
        if (!current) return;
        void fetch("/api/support-session/logout", { method: "POST", cache: "no-store" })
          .finally(() => window.location.replace("/staff-login?support=status-unavailable"));
      });
    return () => { current = false; };
  }, []);

  if (!state?.active) return null;

  async function exitSupport() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/support-session/logout", { method: "POST", cache: "no-store" });
    } finally {
      const backOffice = window.location.hostname === "tos.pinohouse.art"
        ? "https://bo.pinohouse.art/bo/staff"
        : "/bo/staff";
      window.location.replace(backOffice);
    }
  }

  return (
    <aside className={styles.supportBanner} role="status" data-testid="support-session-banner">
      <div>
        <strong>{state.mode === "VIEW" ? "VIEW AS" : "ACT AS"} · {state.subjectEmail}</strong>
        <span>{state.reason} · hết hạn {formatExpiry(state.expiresAt)}</span>
      </div>
      <button type="button" onClick={exitSupport} disabled={busy}>
        {busy ? "Đang thoát…" : "Thoát debug"}
      </button>
    </aside>
  );
}

function formatExpiry(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}
