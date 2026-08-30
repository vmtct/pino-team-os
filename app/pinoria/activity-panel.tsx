"use client";

import { useCallback, useEffect, useState } from "react";
import { pinoriaReadinessApi, type PinoriaReadinessState } from "@/lib/pinoria-readiness-api";
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
    displayName: string; rulesVersion: string;
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
    const resonance = wish ? (wish.bearer.resonanceLevel < 0 ? "Chưa cộng hưởng" : `C${wish.bearer.resonanceLevel}`) : null;
    return <section className={styles.panel} key={activity.activityId} aria-label={`Pinoria activity for ${displayName}`}>
      <div className={styles.copy}>
        <span>PINORIA · HOẠT ĐỘNG</span>
        <strong>{activity.staffName}</strong>
        <small>{activity.learnerName}{wish ? ` · ${wish.banner.bearer.displayName}` : egg?.species ? ` · ${egg.species.displayName}` : ritual?.species ? ` · ${ritual.species.displayName}` : ""}</small>
      </div>
      {wish ? <div className={styles.state}>
        <b>✦ {wish.energySeedBalance}</b>
        <span>{resonance}</span>
        <span>{wish.signatureSet.progress.owned}/{wish.signatureSet.progress.total} set</span>
        <span>Mythic P{wish.pity.nextMythicPityPosition}/{wish.pity.mythicGuaranteedWithin} · soft từ P{wish.pity.mythicSoftPityStartsAt}</span>
        <span>{wish.pity.featuredGuarantee ? "Featured kế tiếp ✓" : `Featured ${(wish.banner.guarantees.featuredMythicRate*100).toFixed(0)}%`} · Rare P{wish.pity.nextRarePityPosition}/{wish.pity.rareGuaranteedWithin}</span>
        <span>{wish.banner.rulesVersion} · base Mythic {(wish.banner.guarantees.mythicBaseRate*100).toFixed(1)}%</span>
      </div> : egg ? <div className={styles.state}>
        <b>{egg.egg ? "🥚 Sẵn sàng" : "🥚 Chưa sẵn sàng"}</b>
        <span>{egg.species?.displayName ?? "Hộ Linh"}</span>
      </div> : ritual ? <div className={styles.state}>
        <b>{ritual.species?.displayName ?? "Hộ Linh"} · Cấp {coreProgress?.materializationLevel ?? ritual.progression?.materializationLevel ?? "—"}</b>
        <span>🍎 {readiness?.fruitBalance ?? 0} Quả · {readiness?.waterSigil ? "Thủy Ấn ✓" : "Chưa có Thủy Ấn"}</span>
        <span>{coreProgress ? `${coreProgress.stageFeedCount} tiến độ · ${readinessLabel(coreProgress.readinessRuleKey)}` : ritual.progression ? `${ritual.progression.stageFeedCount} tiến độ · ${readinessLabel(ritual.progression.readinessRuleKey)}` : "Chưa có tiến trình"}</span>
        <span>{coreProgress?.state === "READY_FOR_RITUAL" || ritual.progression?.state === "READY_FOR_RITUAL" ? "✦ Sẵn sàng Nghi thức" : activity.reason?.message ?? "Đang trưởng thành"}</span>
      </div> : <div className={styles.state}><span>{activity.reason?.message ?? "Chưa khả dụng"}</span></div>}
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
