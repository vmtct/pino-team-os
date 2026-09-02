"use client";

import { useEffect, useState } from "react";
import { boApi } from "@/lib/bo-api";
import styles from "../bo.module.css";

type IntakeState = {
  enabled: boolean;
  updatedAt: string | null;
  updatedByUserId: string | null;
  version: number;
};

export function StaffRegistrationIntakeToggle() {
  const [state, setState] = useState<IntakeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    void boApi.staffRegistrationIntake()
      .then((next) => { if (current) setState(next); })
      .catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : "Không thể đọc trạng thái link đăng ký."); });
    return () => { current = false; };
  }, []);

  async function toggle() {
    if (!state || busy) return;
    const nextEnabled = !state.enabled;
    setBusy(true);
    setError("");
    try {
      const next = await boApi.setStaffRegistrationIntake(nextEnabled);
      setState(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đổi trạng thái link đăng ký.");
    } finally {
      setBusy(false);
    }
  }

  const enabled = state?.enabled === true;
  return (
    <section className={styles.intakePanel} aria-labelledby="staff-registration-intake-title">
      <div className={styles.intakeCopy}>
        <div className={styles.intakeTitleRow}>
          <h2 id="staff-registration-intake-title">Self-registration link</h2>
          <span className={`${styles.statusPill} ${enabled ? styles.intakeOn : styles.intakeOff}`}>
            {state ? (enabled ? "OPEN" : "CLOSED") : "LOADING"}
          </span>
        </div>
        <p>
          Bật khi cần nhận đăng ký nhân sự mới. Tắt sẽ chặn cả trang đăng ký và submit API ở Core.
        </p>
        <code>join.pinohouse.art/staff/register</code>
        {state?.updatedAt ? <small>Cập nhật gần nhất: {new Date(state.updatedAt).toLocaleString("vi-VN")}</small> : null}
        {error ? <p className={styles.intakeError}>{error}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? "Tắt link đăng ký nhân sự" : "Bật link đăng ký nhân sự"}
        className={`${styles.intakeSwitch} ${enabled ? styles.intakeSwitchOn : ""}`}
        onClick={() => { void toggle(); }}
        disabled={!state || busy}
      >
        <span className={styles.intakeKnob} />
      </button>
    </section>
  );
}
