"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./wish-activity.module.css";

type ActivityAction = {
  key: "DRAW_ONE" | "DRAW_FIVE";
  label: string;
  enabled: boolean;
  cost: number;
  reason: { code: string; message: string } | null;
};
type ActivityContext = {
  energySeedBalance: number;
  bearer: { resonanceLevel: number };
  signatureSet: { progress: { owned: number; total: number } };
  banner: {
    displayName: string;
    bearer: { displayName: string };
    signatureSet: { displayName: string };
  };
};
type AvailableActivity = {
  activityId: string;
  key: string;
  handlerKey: "WISH_DRAW";
  staffName: string;
  learnerName: string;
  iconAssetKey: string | null;
  presentationProfileKey: string;
  eligible: boolean;
  reason: { code: string; message: string } | null;
  actions: ActivityAction[];
  context: ActivityContext | null;
};
type Envelope<T> = { data?: T; error?: { message?: string } };
type Props = { centerId: string; studentProfileId: string; displayName: string };

export function PinoriaActivityPanel({ centerId, studentProfileId, displayName }: Props) {
  const [activities, setActivities] = useState<AvailableActivity[]>([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    const response = await fetch(
      `/api/tos-learning/pinoria/activities/available?centerId=${encodeURIComponent(centerId)}&studentProfileId=${encodeURIComponent(studentProfileId)}`,
      { cache: "no-store" },
    );
    const json = await response.json() as Envelope<AvailableActivity[]>;
    if (!response.ok || !json.data) throw new Error(json.error?.message ?? "Không tải được hoạt động Pinoria");
    setActivities(json.data);
  }, [centerId, studentProfileId]);

  useEffect(() => {
    let active = true;
    void refresh().catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Không tải được hoạt động Pinoria");
    });
    return () => { active = false; };
  }, [refresh]);

  async function execute(activity: AvailableActivity, action: ActivityAction) {
    if (busy || !action.enabled) return;
    const busyKey = `${activity.activityId}:${action.key}`;
    setBusy(busyKey);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/tos-learning/pinoria/activities/execute", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({
          centerId,
          studentProfileId,
          activityId: activity.activityId,
          actionKey: action.key,
        }),
      });
      const json = await response.json() as Envelope<{ activityId: string; actionKey: string }>;
      if (!response.ok || !json.data) throw new Error(json.error?.message ?? "Không thực hiện được hoạt động Pinoria");
      setNotice(`Đã gửi ${action.label} của ${displayName} lên Pinoria TV.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thực hiện được hoạt động Pinoria");
    } finally {
      setBusy("");
    }
  }

  if (error) return <div className={styles.error}>{error}</div>;
  if (!activities.length) return <div className={styles.empty}>Chưa có hoạt động Pinoria đang mở.</div>;
  return <>{activities.map((activity) => {
    const context = activity.context;
    const resonance = context
      ? context.bearer.resonanceLevel < 0 ? "Chưa cộng hưởng" : `C${context.bearer.resonanceLevel}`
      : null;
    return <section className={styles.panel} key={activity.activityId} aria-label={`Pinoria activity for ${displayName}`}>
      <div className={styles.copy}>
        <span>PINORIA · HOẠT ĐỘNG</span>
        <strong>{activity.staffName}</strong>
        <small>{activity.learnerName}{context ? ` · ${context.banner.bearer.displayName}` : ""}</small>
      </div>
      {context ? <div className={styles.state}>
        <b>✦ {context.energySeedBalance}</b>
        <span>{resonance}</span>
        <span>{context.signatureSet.progress.owned}/{context.signatureSet.progress.total} set</span>
      </div> : <div className={styles.state}><span>{activity.reason?.message ?? "Chưa khả dụng"}</span></div>}
      <div className={styles.actions}>
        {activity.actions.map((action) => {
          const key = `${activity.activityId}:${action.key}`;
          return <button
            key={action.key}
            disabled={!!busy || !action.enabled}
            title={action.reason?.message ?? undefined}
            onClick={() => void execute(activity, action)}
          >{busy === key ? "…" : action.label}</button>;
        })}
      </div>
      {!activity.eligible && activity.reason ? <p className={styles.notice}>{activity.reason.message}</p> : null}
      {notice ? <p className={styles.notice}>{notice}</p> : null}
    </section>;
  })}</>;
}
