"use client";

import { useEffect, useState } from "react";
import styles from "./bo.module.css";

interface BoContext {
  userId: string;
  email: string;
  staffMemberId: string | null;
  surface: "BO";
  entitled: true;
}

type State =
  | { status: "loading" }
  | { status: "ready"; context: BoContext }
  | { status: "denied"; message: string };

export function BoContextCard() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    void fetch("/api/bo/context", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { data?: BoContext; error?: { message?: string } };
        if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Back Office access was denied.");
        if (active) setState({ status: "ready", context: body.data });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: "denied", message: error instanceof Error ? error.message : "Back Office access was denied." });
      });
    return () => { active = false; };
  }, []);

  if (state.status === "loading") return <div className={styles.card} aria-busy="true">Verifying BO entitlement…</div>;
  if (state.status === "denied") {
    return <div className={`${styles.card} ${styles.denied}`} role="alert"><strong>Access denied</strong><span>{state.message}</span></div>;
  }

  return (
    <div className={styles.card}>
      <span className={styles.status}>BO entitlement verified</span>
      <strong>{state.context.email}</strong>
      <dl>
        <div><dt>Canonical User</dt><dd>{state.context.userId}</dd></div>
        <div><dt>Surface</dt><dd>{state.context.surface}</dd></div>
      </dl>
    </div>
  );
}
