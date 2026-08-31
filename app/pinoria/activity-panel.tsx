"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./wish-activity.module.css";

type ActivityAction = {
  key: "DRAW_ONE" | "DRAW_FIVE" | "HATCH" | "ADVANCE_COMPANION_MATERIALIZATION";
  label: string;
  enabled: boolean;
  cost: number;
  reason: { code: string; message: string } | null;
};
type WishBanner = {
  id: string;
  displayName: string;
  releasePhase: { key: string; featuredSlot: number; releaseRole: "NEW" | "RERUN" | "SEASONAL" } | null;
  bearer: { displayName: string };
  signatureSet: { displayName: string };
};
type WishChoice = {
  selectionKey: string;
  banner: WishBanner;
  energySeedBalance: number;
  bearer: { resonanceLevel: number };
  signatureSet: { progress: { owned: number; total: number } };
};
type WishContext = {
  energySeedBalance: number;
  bearer: { resonanceLevel: number };
  signatureSet: { progress: { owned: number; total: number } };
  banner: WishBanner;
  choices?: WishChoice[];
};
type EggContext = {
  egg: { id: string; readyAt: string; assetKey: string } | null;
  species: { id: string; key: string; displayName: string; companionAssetKey: string } | null;
};
type RitualContext = {
  companion: { id: string; speciesId: string; status: string } | null;
  progression: {
    materializationLevel: number;
    state: string;
    stageFeedCount: number;
    readinessRuleKey: string | null;
    version: number;
  } | null;
  species: { id: string; key: string; displayName: string; companionAssetKey: string; sigilAssetKey: string | null } | null;
};
type AvailableActivity = {
  activityId: string;
  key: string;
  handlerKey: "WISH_DRAW" | "EGG_HATCH" | "COMPANION_RITUAL";
  staffName: string;
  learnerName: string;
  iconAssetKey: string | null;
  presentationProfileKey: string;
  eligible: boolean;
  reason: { code: string; message: string } | null;
  actions: ActivityAction[];
  context: WishContext | EggContext | RitualContext | null;
};
type Envelope<T> = { data?: T; error?: { message?: string } };
type Props = { centerId: string; studentProfileId: string; displayName: string };

function isWishContext(value: AvailableActivity["context"]): value is WishContext {
  return Boolean(value && "energySeedBalance" in value);
}
function isEggContext(value: AvailableActivity["context"]): value is EggContext {
  return Boolean(value && "egg" in value && "species" in value);
}

function isRitualContext(value: AvailableActivity["context"]): value is RitualContext {
  return Boolean(value && "companion" in value && "progression" in value && "species" in value);
}
function readinessLabel(key: string | null | undefined) {
  if (key === "FEED_2") return "2 lần nuôi";
  if (key === "FEED_5_AND_WATER_SIGIL") return "5 lần nuôi + Thủy Ấn";
  return "Đang tích lũy";
}
function releaseRoleLabel(role: "NEW" | "RERUN" | "SEASONAL") {
  if (role === "NEW") return "M?i";
  if (role === "RERUN") return "Tr? l?i";
  return "Theo m?a";
}
export function PinoriaActivityPanel({ centerId, studentProfileId, displayName }: Props) {
  const [activities, setActivities] = useState<AvailableActivity[]>([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [wishSelections, setWishSelections] = useState<Record<string, string>>({});
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
    setWishSelections({});
    void refresh().catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Không tải được hoạt động Pinoria");
    });
    return () => { active = false; };
  }, [refresh]);

  async function execute(activity: AvailableActivity, action: ActivityAction, selectionKey?: string) {
    if (busy || !action.enabled) return;
    const busyKey = `${activity.activityId}:${action.key}`;
    setBusy(busyKey);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/tos-learning/pinoria/activities/execute", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ centerId, studentProfileId, activityId: activity.activityId, actionKey: action.key, ...(selectionKey ? { selectionKey } : {}) }),
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
    const ritual = isRitualContext(activity.context) ? activity.context : null;
    const choices = wish?.choices ?? [];
    const selectedChoice = choices.find((choice) => choice.selectionKey === wishSelections[activity.activityId]) ?? choices[0] ?? null;
    const wishBalance = selectedChoice?.energySeedBalance ?? wish?.energySeedBalance ?? 0;
    const wishBearer = selectedChoice?.bearer ?? wish?.bearer ?? null;
    const wishSet = selectedChoice?.signatureSet ?? wish?.signatureSet ?? null;
    const wishBanner = selectedChoice?.banner ?? wish?.banner ?? null;
    const resonance = wishBearer ? (wishBearer.resonanceLevel < 0 ? "Ch?a c?ng h??ng" : `C${wishBearer.resonanceLevel}`) : null;
    return <section className={styles.panel} key={activity.activityId} aria-label={`Pinoria activity for ${displayName}`}>
      <div className={styles.copy}>
        <span>PINORIA · HOẠT ĐỘNG</span>
        <strong>{activity.staffName}</strong>
        <small>{activity.learnerName}{wish ? ` · ${wish.banner.bearer.displayName}` : egg?.species ? ` · ${egg.species.displayName}` : ritual?.species ? ` · ${ritual.species.displayName}` : ""}</small>
      </div>
      {wish ? <div className={styles.state}>
        <b>✦ {wish.energySeedBalance}</b>
        <span>{resonance}</span>
        <span>{wishSet?.progress.owned ?? 0}/{wishSet?.progress.total ?? 0} set</span>
      </div> : egg ? <div className={styles.state}>
        <b>{egg.egg ? "🥚 Sẵn sàng" : "🥚 Chưa sẵn sàng"}</b>
        <span>{egg.species?.displayName ?? "Hộ Linh"}</span>
      </div> : ritual ? <div className={styles.state}>
        <b>{ritual.species?.displayName ?? "Hộ Linh"} · Cấp {ritual.progression?.materializationLevel ?? "—"}</b>
        <span>{ritual.progression ? `${ritual.progression.stageFeedCount} tiến độ · ${readinessLabel(ritual.progression.readinessRuleKey)}` : "Chưa có tiến trình"}</span>
        <span>{ritual.progression?.state === "READY_FOR_RITUAL" ? "✦ Sẵn sàng Nghi thức" : activity.reason?.message ?? "Đang trưởng thành"}</span>
      </div> : <div className={styles.state}><span>{activity.reason?.message ?? "Chưa khả dụng"}</span></div>}
      {wish && choices.length > 1 ? <div className={styles.choices} role="group" aria-label="Ch?n banner Wish">
        {choices.map((choice) => {
          const selected = choice.selectionKey === selectedChoice?.selectionKey;
          const slot = choice.banner.releasePhase?.featuredSlot;
          const role = choice.banner.releasePhase?.releaseRole;
          return <button key={choice.selectionKey} type="button" className={selected ? styles.choiceSelected : undefined} aria-pressed={selected} disabled={!!busy} onClick={() => setWishSelections((current) => ({ ...current, [activity.activityId]: choice.selectionKey }))}>
            <strong>{choice.banner.displayName}</strong>
            <small>{slot ? `Banner ${slot}` : "Banner"}{role ? ` ? ${releaseRoleLabel(role)}` : ""}</small>
          </button>;
        })}
      </div> : null}
      <div className={styles.actions}>
        {activity.actions.map((action) => {
          const key = `${activity.activityId}:${action.key}`;
          return <button key={action.key} disabled={!!busy || !action.enabled} title={action.reason?.message ?? undefined} onClick={() => void execute(activity, action, selectedChoice?.selectionKey)}>{busy === key ? "?" : action.label}</button>;
        })}
      </div>
      {!activity.eligible && activity.reason ? <p className={styles.notice}>{activity.reason.message}</p> : null}
      {notice ? <p className={styles.notice}>{notice}</p> : null}
    </section>;
  })}</>;
}
