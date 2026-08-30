"use client";

import { useCallback, useEffect, useState } from "react";
import { pinoriaReadinessApi, type PinoriaReadinessState } from "@/lib/pinoria-readiness-api";
import { WishProgressCard } from "./WishProgressCard";
import { CompanionProgressCard } from "./CompanionProgressCard";
import styles from "./wish-activity.module.css";

type ActivityAction = {
  key: "DRAW_ONE" | "DRAW_FIVE" | "HATCH" | "ADVANCE_COMPANION_MATERIALIZATION";
  label: string;
  enabled: boolean;
  cost: number;
  reason: { code: string; message: string } | null;
};
type WishContext = {
  energySeedBalance: number;
  pity: { mythicSinceLastHit:number;nextMythicPityPosition:number;mythicSoftPityStartsAt:number;mythicGuaranteedWithin:number;rareSinceLastHit:number;nextRarePityPosition:number;rareGuaranteedWithin:number;featuredGuarantee:boolean };
  bearer: { resonanceLevel: number };
  signatureSet: { progress: { owned: number; total: number } };
  banner: {
    id: string; displayName: string; storyHook?: string; rulesVersion: string;
    guarantees: { rareBaseRate:number;rareWithin:number;mythicBaseRate:number;mythicSoftPityStartsAt:number;mythicWithin:number;mythicRateByPity:Array<{pity:number;rate:number}>;featuredMythicRate:number;perfectMemoryRate:number };
    bearer: { displayName: string };
    signatureSet: { displayName: string };
  };
};
type EggContext = {
  egg: { id: string; readyAt: string; assetKey: string } | null;
  species: { id: string; key: string; displayName: string; companionAssetKey: string } | null;
};
type RitualContext = {
  companion: { id: string; speciesId: string; status: string } | null;
  progression: {
    materializationLevel: number;
    state: "GROWING" | "READY_FOR_RITUAL";
    stageFeedCount: number;
    readinessRuleKey: "FEED_2" | "FEED_5_AND_WATER_SIGIL" | null;
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
export function PinoriaActivityPanel({ centerId, studentProfileId, displayName }: Props) {
  const [activities, setActivities] = useState<AvailableActivity[]>([]);
  const [readiness, setReadiness] = useState<PinoriaReadinessState | null>(null);
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
    const nextReadiness = await pinoriaReadinessApi.state(centerId, studentProfileId);
    setActivities(json.data);
    setReadiness(nextReadiness);
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

  async function feedCompanion(companionId:string) {
    if (busy) return;
    setBusy(`feed:${companionId}`); setError(""); setNotice("");
    try {
      await pinoriaReadinessApi.feed(centerId, studentProfileId, companionId);
      setNotice(`${displayName}: đã dùng 1 Quả cho Hộ Linh. Core đã cập nhật tiến độ; TV chưa chạy scene.`);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể cập nhật Hộ Linh"); }
    finally { setBusy(""); }
  }

  if (error) return <div className={styles.error}>{error}</div>;
  if (!activities.length) return <div className={styles.empty}>Chưa có hoạt động Pinoria đang mở.</div>;
  return <>{activities.map((activity) => {
    const wish = isWishContext(activity.context) ? activity.context : null;
    const egg = isEggContext(activity.context) ? activity.context : null;
    const ritual = isRitualContext(activity.context) ? activity.context : null;
    const coreProgress = ritual?.companion ? readiness?.companions.find((item) => item.companionId === ritual.companion?.id) ?? null : null;
    return <section className={styles.panel} key={activity.activityId} aria-label={`Pinoria activity for ${displayName}`}>
      <div className={styles.copy}>
        <span>PINORIA · HOẠT ĐỘNG</span>
        <strong>{activity.staffName}</strong>
        <small>{activity.learnerName}{wish ? ` · ${wish.banner.bearer.displayName}` : egg?.species ? ` · ${egg.species.displayName}` : ritual?.species ? ` · ${ritual.species.displayName}` : ""}</small>
      </div>
      {wish ? <WishProgressCard centerId={centerId} studentProfileId={studentProfileId} banner={wish.banner} energySeedBalance={wish.energySeedBalance} pity={wish.pity} resonanceLevel={wish.bearer.resonanceLevel} setProgress={wish.signatureSet.progress} /> : egg ? <div className={styles.state}>
        <b>{egg.egg ? "🥚 Sẵn sàng" : "🥚 Chưa sẵn sàng"}</b>
        <span>{egg.species?.displayName ?? "Hộ Linh"}</span>
      </div> : ritual ? <CompanionProgressCard name={ritual.species?.displayName ?? "Hộ Linh"} assetKey={ritual.species?.companionAssetKey ?? ""} sigilAssetKey={ritual.species?.sigilAssetKey ?? null} progress={coreProgress ?? ritual.progression} readiness={readiness} /> : <div className={styles.state}><span>{activity.reason?.message ?? "Chưa khả dụng"}</span></div>}
      <div className={styles.actions}>
        {ritual?.companion && coreProgress ? <button disabled={!!busy || readiness?.fruitBalance === 0 || coreProgress.state !== "GROWING"} onClick={() => void feedCompanion(ritual.companion!.id)}>{busy === `feed:${ritual.companion.id}` ? "…" : "Dùng 1 Quả"}</button> : null}
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
