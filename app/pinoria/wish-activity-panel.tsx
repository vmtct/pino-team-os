"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./wish-activity.module.css";

type Banner = {
  id: string;
  displayName: string;
  storyHook: string;
  bearer: { displayName: string; title: string };
  signatureSet: { displayName: string };
};
type WishState = {
  energySeedBalance: number;
  canDrawOne: boolean;
  canDrawFive: boolean;
  bearer: { resonanceLevel: number };
  signatureSet: { progress: { owned: number; total: 3 } };
};
type Envelope<T> = { data?: T; error?: { message?: string } };

type Props = {
  centerId: string;
  studentProfileId: string;
  displayName: string;
};

export function WishActivityPanel({ centerId, studentProfileId, displayName }: Props) {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [state, setState] = useState<WishState | null>(null);
  const [busy, setBusy] = useState<1 | 5 | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setError("");
    const bannersResponse = await fetch(
      `/api/tos-learning/pinoria/wish/banners/active?centerId=${encodeURIComponent(centerId)}`,
      { cache: "no-store" },
    );
    const bannersJson = await bannersResponse.json() as Envelope<Banner[]>;
    if (!bannersResponse.ok) throw new Error(bannersJson.error?.message ?? "Không tải được hoạt động Pinoria");
    const active = bannersJson.data?.[0] ?? null;
    setBanner(active);
    if (!active) {
      setState(null);
      return;
    }
    const stateResponse = await fetch(
      `/api/tos-learning/pinoria/wish/state?centerId=${encodeURIComponent(centerId)}&studentProfileId=${encodeURIComponent(studentProfileId)}&bannerId=${encodeURIComponent(active.id)}`,
      { cache: "no-store" },
    );
    const stateJson = await stateResponse.json() as Envelope<WishState>;
    if (!stateResponse.ok || !stateJson.data) throw new Error(stateJson.error?.message ?? "Không tải được trạng thái Wish");
    setState(stateJson.data);
  }, [centerId, studentProfileId]);

  useEffect(() => {
    let active = true;
    void refresh().catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Không tải được hoạt động Pinoria");
    });
    return () => { active = false; };
  }, [refresh]);

  async function draw(count: 1 | 5) {
    if (!banner || !state || busy) return;
    setBusy(count);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/tos-learning/pinoria/wish/draw", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({ centerId, studentProfileId, bannerId: banner.id, count }),
      });
      const json = await response.json() as Envelope<{ drawId: string; energySeedBalanceAfter: number }>;
      if (!response.ok || !json.data) throw new Error(json.error?.message ?? "Không Gieo được Hạt Năng Lượng");
      setNotice(`Đã gửi Gieo ×${count} của ${displayName} lên Pinoria TV.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không Gieo được Hạt Năng Lượng");
    } finally {
      setBusy(null);
    }
  }

  if (error) return <div className={styles.error}>{error}</div>;
  if (!banner) return <div className={styles.empty}>Chưa có hoạt động Pinoria đang mở.</div>;
  if (!state) return <div className={styles.empty}>Đang tải hoạt động Pinoria…</div>;

  const resonance = state.bearer.resonanceLevel < 0 ? "Chưa cộng hưởng" : `C${state.bearer.resonanceLevel}`;
  return <section className={styles.panel} aria-label={`Wish activity for ${displayName}`}>
    <div className={styles.copy}>
      <span>PINORIA · HOẠT ĐỘNG</span>
      <strong>{banner.displayName}</strong>
      <small>{banner.bearer.displayName} · {banner.signatureSet.displayName}</small>
    </div>
    <div className={styles.state}>
      <b>✦ {state.energySeedBalance}</b>
      <span>{resonance}</span>
      <span>{state.signatureSet.progress.owned}/{state.signatureSet.progress.total} set</span>
    </div>
    <div className={styles.actions}>
      <button disabled={!!busy || !state.canDrawOne} onClick={() => void draw(1)}>{busy === 1 ? "…" : "Gieo ×1"}</button>
      <button disabled={!!busy || !state.canDrawFive} onClick={() => void draw(5)}>{busy === 5 ? "…" : "Gieo ×5"}</button>
    </div>
    {notice ? <p className={styles.notice}>{notice}</p> : null}
  </section>;
}
