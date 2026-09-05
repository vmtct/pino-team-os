"use client";

import { useCallback, useEffect, useState } from "react";
import { TosShell } from "@/app/components/tos-shell/TosShell";
import { TOS_PINORIA_FOOTER } from "@/app/components/tos-shell/navigation";
import { workforceApi } from "@/lib/workforce-api";
import type { WardSession, WardSessionCandidate, WardSessionEnvelope } from "@/lib/pinoria-ward-session";
import { PinoriaActivityPanel } from "./activity-panel";
import { WardSessionChoice } from "./ward-session-choice";
import styles from "./pinoria.module.css";

type Visit = { id: string; checkedInAt: string; version: number };
type Learner = { studentProfileId: string; displayName: string; hasCharacter: boolean; openVisit: Visit | null };
type Preset = { id: string; displayName: string; config: { hair: string; face: string; outfit: string; back?: string } };
type Envelope<T> = { data?: T; error?: { code?: string; message?: string } };
type WardChoiceState = { learnerName: string; studentProfileId: string; session: WardSession };

const CENTER_STORAGE = "pino.arrival.centerId";
const INSUFFICIENT_WARD = "PINORIA_WARD_SESSION_INSUFFICIENT_CANDIDATES";

export function ArrivalDesk() {
  const [centerId, setCenterId] = useState("");
  const [query, setQuery] = useState("");
  const [learners, setLearners] = useState<Learner[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [pending, setPending] = useState<Learner | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [wardChoice, setWardChoice] = useState<WardChoiceState | null>(null);
  const [wardBusy, setWardBusy] = useState(false);
  const [wardError, setWardError] = useState("");

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        const urlCenter = new URLSearchParams(location.search).get("centerId")?.trim();
        const saved = localStorage.getItem(CENTER_STORAGE)?.trim();
        const context = !urlCenter && !saved ? await workforceApi.context() : null;
        const value = urlCenter || saved || context?.data.centers[0]?.id || "";
        if (!active) return;
        if (value) {
          localStorage.setItem(CENTER_STORAGE, value);
          setCenterId(value);
        }
        const response = await fetch(`/api/tos-learning/pinoria/presets?centerId=${encodeURIComponent(value)}`, { cache: "no-store" });
        const json = await response.json() as Envelope<Preset[]>;
        if (response.ok && json.data) setPresets(json.data);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Không khởi tạo được quầy");
      }
    }
    void start();
    return () => { active = false; };
  }, []);

  const search = useCallback(async (value: string) => {
    if (!centerId || !value.trim()) {
      setLearners([]);
      return;
    }
    try {
      const response = await fetch(`/api/tos-learning/pinoria/learners/search?centerId=${encodeURIComponent(centerId)}&query=${encodeURIComponent(value.trim())}`, { cache: "no-store" });
      const json = await response.json() as Envelope<Learner[]>;
      if (!response.ok || !json.data) throw new Error(json.error?.message ?? "Không tìm được học viên");
      setLearners(json.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tìm được học viên");
    }
  }, [centerId]);

  useEffect(() => {
    const timer = setTimeout(() => void search(query), 250);
    return () => clearTimeout(timer);
  }, [query, search]);

  async function openWardChoice(learner: Learner, silentInsufficient = false) {
    setWardError("");
    const response = await fetch("/api/tos-learning/pinoria/wardrobe/session/open", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ studentProfileId: learner.studentProfileId, centerId }),
    });
    const json = await response.json() as WardSessionEnvelope<WardSession>;
    if (!response.ok || !json.data) {
      if (json.error?.code === INSUFFICIENT_WARD) {
        if (!silentInsufficient) setError("Học viên chưa có đủ 3 Ward hợp lệ để mở lựa chọn hôm nay.");
        return false;
      }
      throw new Error(json.error?.message ?? "Không mở được Ward choice");
    }
    setWardChoice({ learnerName: learner.displayName, studentProfileId: learner.studentProfileId, session: json.data });
    return true;
  }

  async function mutate(learner: Learner, presetId?: string) {
    setBusy(learner.studentProfileId);
    setError("");
    try {
      const checkIn = !learner.openVisit;
      const response = await fetch(`/api/tos-learning/pinoria/house/${checkIn ? "check-in" : "check-out"}`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify(checkIn
          ? { studentProfileId: learner.studentProfileId, centerId, presetId: presetId ?? null, checkedInAt: new Date().toISOString() }
          : { studentProfileId: learner.studentProfileId, centerId, expectedVersion: learner.openVisit!.version, checkedOutAt: new Date().toISOString(), reason: "Rời PINO House" }),
      });
      const json = await response.json() as Envelope<unknown>;
      if (!response.ok) throw new Error(json.error?.message ?? "Thao tác thất bại");
      setPending(null);
      if (checkIn) {
        try {
          await openWardChoice(learner, true);
        } catch (cause) {
          const detail = cause instanceof Error ? cause.message : "Ward choice chưa sẵn sàng";
          setError(`Check-in đã thành công. Ward choice chưa mở được: ${detail}`);
        }
      }
      await search(query);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Thao tác thất bại");
    } finally {
      setBusy(null);
    }
  }

  async function resumeWard(learner: Learner) {
    setBusy(learner.studentProfileId);
    setError("");
    try {
      await openWardChoice(learner, false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không mở được Ward choice");
    } finally {
      setBusy(null);
    }
  }

  async function confirmWard(candidate: WardSessionCandidate) {
    if (!wardChoice) return;
    setWardBusy(true);
    setWardError("");
    try {
      const response = await fetch("/api/tos-learning/pinoria/wardrobe/session/select", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ candidateSetId: wardChoice.session.id, studentProfileId: wardChoice.studentProfileId, centerId, variantId: candidate.id }),
      });
      const json = await response.json() as WardSessionEnvelope<{ session: WardSession }>;
      if (!response.ok || !json.data) throw new Error(json.error?.message ?? "Không áp dụng được Ward choice");
      setWardChoice((current) => current ? { ...current, session: json.data!.session } : current);
      await search(query);
    } catch (cause) {
      setWardError(cause instanceof Error ? cause.message : "Không áp dụng được Ward choice");
    } finally {
      setWardBusy(false);
    }
  }

  function activate(learner: Learner) {
    if (!learner.openVisit && !learner.hasCharacter) {
      setPending(learner);
      return;
    }
    void mutate(learner);
  }

  return <TosShell title="PINO Arrival Desk" subtitle="Hiện diện toàn House · Staff only" theme="pinoria" footerItems={TOS_PINORIA_FOOTER} activeFooterId="presence">
    <div className={styles.page}>
      <section className={styles.toolbar}><div><span className={styles.eyebrow}>HOUSE-WIDE SEARCH</span><strong>Tìm học viên theo tên</strong></div><a className={styles.refresh} href="/staff-login">Đổi staff</a></section>
      <input className={styles.search} autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nhập tên học viên…" />
      {error ? <div className={styles.error}>{error}</div> : null}
      <section className={styles.list}>
        {query.trim() && !learners.length ? <div className={styles.empty}><strong>Không có kết quả</strong><span>Thử một phần khác của tên học viên.</span></div> : null}
        {learners.map((learner) => <article className={`${styles.card} ${learner.openVisit ? styles.present : ""}`} key={learner.studentProfileId}>
          <div className={styles.avatar}>{learner.displayName.charAt(0).toUpperCase()}</div>
          <div className={styles.identity}><div className={styles.nameRow}><h3>{learner.displayName}</h3><span className={learner.openVisit ? styles.inBadge : styles.waitBadge}>{learner.openVisit ? "Đang ở House" : learner.hasCharacter ? "Sẵn sàng" : "Lần đầu"}</span></div>{learner.openVisit ? <small>Đến lúc {new Date(learner.openVisit.checkedInAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</small> : null}</div>
          {learner.openVisit ? <div className={styles.cardActions}><button className={styles.wardResume} disabled={busy === learner.studentProfileId} onClick={() => void resumeWard(learner)}>Ward</button><button className={styles.checkout} disabled={busy === learner.studentProfileId} onClick={() => activate(learner)}>{busy === learner.studentProfileId ? "…" : "Check-out"}</button></div> : <button className={styles.checkin} disabled={busy === learner.studentProfileId} onClick={() => activate(learner)}>{busy === learner.studentProfileId ? "…" : "Check-in"}</button>}
          {learner.openVisit ? <PinoriaActivityPanel centerId={centerId} studentProfileId={learner.studentProfileId} displayName={learner.displayName} /> : null}
        </article>)}
      </section>
      {pending ? <div className={styles.modalBackdrop} role="dialog" aria-modal="true"><section className={styles.modal}><span className={styles.eyebrow}>FIRST CHECK-IN</span><h2>Chọn nhân vật cho {pending.displayName}</h2><p>Lựa chọn này sẽ trở thành nhân vật canonical. Có thể customize ở rollout sau.</p><div className={styles.presetGrid}>{presets.map((preset) => <button key={preset.id} disabled={!!busy} onClick={() => void mutate(pending, preset.id)}><b>{preset.displayName}</b><small>{preset.config.hair.split("/").at(-3)} · {preset.config.face.split("/").at(-3)} · {preset.config.outfit.split("/").at(-3)}</small></button>)}</div><button className={styles.cancel} onClick={() => setPending(null)}>Hủy</button></section></div> : null}
      {wardChoice ? <WardSessionChoice learnerName={wardChoice.learnerName} session={wardChoice.session} busy={wardBusy} error={wardError} onConfirm={(candidate) => void confirmWard(candidate)} onClose={() => { setWardChoice(null); setWardError(""); }} /> : null}
    </div>
  </TosShell>;
}
