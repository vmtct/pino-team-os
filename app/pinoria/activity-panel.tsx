"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./wish-activity.module.css";

type ActivityAction = {
  key: "DRAW_ONE" | "DRAW_FIVE" | "HATCH";
  label: string;
  enabled: boolean;
  cost: number;
  reason: { code: string; message: string } | null;
};
type WishContext = {
  energySeedBalance: number;
  bearer: { resonanceLevel: number };
  signatureSet: { progress: { owned: number; total: number } };
  banner: {
    displayName: string;
    bearer: { displayName: string };
    signatureSet: { displayName: string };
  };
};
type EggContext = {
  egg: { id: string; readyAt: string; assetKey: string } | null;
  species: { id: string; key: string; displayName: string; companionAssetKey: string } | null;
};
type AvailableActivity = {
  activityId: string;
  key: string;
  handlerKey: "WISH_DRAW" | "EGG_HATCH";
  staffName: string;
  learnerName: string;
  iconAssetKey: string | null;
  presentationProfileKey: string;
  eligible: boolean;
  reason: { code: string; message: string } | null;
  actions: ActivityAction[];
  context: WishContext | EggContext | null;
};
type Envelope<T> = { data?: T; error?: { message?: string } };
type Props = { centerId: string; studentProfileId: string; displayName: string };

function isWishContext(value: AvailableActivity["context"]): value is WishContext {
  return Boolean(value && "energySeedBalance" in value);
}
function isEggContext(value: AvailableActivity["context"]): value is EggContext {
  return Boolean(value && "egg" in value && "species" in value);
}

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
        body: JSON.stringify({ centerId, studentProfileId, activityId: activity.activityId, actionKey: action.key }),
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
    const wish = isWishContext(activity.context) ? activity.context : null;
    const egg = isEggContext(activity.context) ? activity.context : null;
    const resonance = wish ? (wish.bearer.resonanceLevel < 0 ? "Chưa cộng hưởng" : `C${wish.bearer.resonanceLevel}`) : null;
    return <section className={styles.panel} key={activity.activityId} aria-label={`Pinoria activity for ${displayName}`}>
      <div className={styles.copy}>
        <span>PINORIA · HOẠT ĐỘNG</span>
        <strong>{activity.staffName}</strong>
        <small>{activity.learnerName}{wish ? ` · ${wish.banner.bearer.displayName}` : egg?.species ? ` · ${egg.species.displayName}` : ""}</small>
      </div>
      {wish ? <div className={styles.state}>
        <b>✦ {wish.energySeedBalance}</b>
        <span>{resonance}</span>
        <span>{wish.signatureSet.progress.owned}/{wish.signatureSet.progress.total} set</span>
      </div> : egg ? <div className={styles.state}>
        <b>{egg.egg ? "🥚 Sẵn sàng" : "🥚 Chưa sẵn sàng"}</b>
        <span>{egg.species?.displayName ?? "Hộ Linh"}</span>
      </div> : <div className={styles.state}><span>{activity.reason?.message ?? "Chưa khả dụng"}</span></div>}
      <div className={styles.actions}>
        {activity.actions.map((action) => {
          const key = `${activity.activityId}:${action.key}`;
          return <button key={action.key} disabled={!!busy || !action.enabled} title={action.reason?.message ?? undefined} onClick={() => void execute(activity, action)}>{busy === key ? "…" : action.label}</button>;
        })}
      </div>
      {!activity.eligible && activity.reason ? <p className={styles.notice}>{activity.reason.message}</p> : null}
      {notice ? <p className={styles.notice}>{notice}</p> : null}
    </section>;
  })}</>;
}
