"use client";

import { useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import {
  activateF2LearningOperator,
  F2_CENTER_ID,
  F2_LEARNING_PERMISSION_KEYS,
  F2_TARGET_ACCESS_USER_ID,
} from "@/lib/f2-learning-activation";
import styles from "../bo.module.css";

type ActivationState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; roleId: string; assignmentId: string | null; summary: string }
  | { status: "error"; message: string; requestId: string | null };

export function F2LearningOperatorActivation() {
  const [state, setState] = useState<ActivationState>({ status: "idle" });

  async function activate() {
    if (state.status === "running") return;
    setState({ status: "running" });
    try {
      const result = await activateF2LearningOperator({
        listRoles: boApi.accessRoles,
        listUsers: boApi.accessUsers,
        createRole: (input) => adminWrite("access/roles", input),
        assignRole: (input) => adminWrite("access/assignments", input),
      });
      const summary = result.roleCreated || result.assignmentCreated
        ? `Committed: ${result.roleCreated ? "role created" : "role reused"}; ${result.assignmentCreated ? "CENTER assignment created" : "CENTER assignment already present"}.`
        : "Already active. No write was required.";
      setState({ status: "success", roleId: result.roleId, assignmentId: result.assignmentId, summary });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "F2 activation failed.",
        requestId: error instanceof BoApiError ? error.requestId : null,
      });
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div>
          <h2>Slice F2 · Learning Operator activation</h2>
          <p>Founder-only governed write. Creates one dedicated role and one Cần Thơ CENTER assignment for the reviewed Access user. Retry is no-op when already active.</p>
        </div>
        <span className={styles.writePill}>Explicit activation</span>
      </div>
      <div className={styles.formGrid}>
        <label className={styles.field}>Target Access user<code>{F2_TARGET_ACCESS_USER_ID}</code></label>
        <label className={styles.field}>Center scope<code>{F2_CENTER_ID}</code></label>
      </div>
      <div className={styles.assignmentList}>
        {F2_LEARNING_PERMISSION_KEYS.map((permission) => <code key={permission}>{permission}</code>)}
      </div>
      <button type="button" className={styles.primaryButton} disabled={state.status === "running" || state.status === "success"} onClick={() => void activate()}>
        {state.status === "running" ? "Activating…" : state.status === "success" ? "F2 activated" : "Activate F2 Learning Operator"}
      </button>
      {state.status === "success" ? <div className={styles.successCard}><strong>{state.summary}</strong><code>{state.roleId}</code>{state.assignmentId ? <code>{state.assignmentId}</code> : null}</div> : null}
      {state.status === "error" ? <div className={styles.successCard}><strong>Activation stopped</strong><span>{state.message}</span>{state.requestId ? <code>{state.requestId}</code> : null}</div> : null}
    </section>
  );
}

async function adminWrite(path: "access/roles" | "access/assignments", body: unknown): Promise<{ id: string }> {
  const response = await fetch(`/api/bo/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as { data?: { id?: string }; error?: { message?: string; requestId?: string } };
  const requestId = response.headers.get("x-request-id") ?? payload.error?.requestId ?? null;
  if (!response.ok || !payload.data?.id) throw new BoApiError(response.status, payload.error?.message ?? "Back Office access command failed.", requestId);
  return { id: payload.data.id };
}
