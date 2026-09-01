"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayeredCharacter, type PinoriaCharacterConfig } from "./layered-character";
import { AmbientHouseRuntime } from "./ambient-house-runtime";
import { advanceHouseSnapshotCursor, houseDepartureMatchesVisit, selectUnseenHouseEvents } from "./house-event-sequence";
import { claimPresentation, completePresentation } from "./presentation-client";
import { WishRevealScene, wishRevealSceneMs } from "./wish-reveal-scene";
import type { PinoriaPresentation } from "./presentation-types";
import { EggHatchScene, EGG_HATCH_SCENE_MS } from "./egg-hatch-scene";
import { CompanionRitualScene, COMPANION_RITUAL_SCENE_MS } from "./companion-ritual-scene";
import styles from "./reception-tv.module.css";

type Presence = {
  studentProfileId: string;
  displayName: string;
  visit: { id: string; checkedInAt: string; version: number };
  character: { id: string; config: PinoriaCharacterConfig };
};
type HouseSnapshot = { cursor: number; learners: Presence[] };
type HouseEvent = {
  sequence: number;
  type: "ARRIVAL" | "DEPARTURE";
  studentProfileId: string;
  visitId: string;
  characterId: string;
  occurredAt: string;
  payload: { displayName: string; character: PinoriaCharacterConfig };
};type EventPage = { cursor: number; events: HouseEvent[] };
type Scene = {
  id: string;
  kind: "arrival" | "departure";
  name: string;
  config: PinoriaCharacterConfig;
  studentProfileId: string;
  phase: "transition" | "performance";
  visitId: string;
};

const CENTER_STORAGE = "pino.arrival.centerId";

export function ReceptionTv() {
  const [centerId, setCenterId] = useState("");
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState(false);
  const [inside, setInside] = useState<Presence[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [presentation, setPresentation] = useState<PinoriaPresentation | null>(null);
  const cursor = useRef(0);
  const presentedSequence = useRef(0);
  const wasConnected = useRef(false);
  const presentationBusy = useRef(false);
  const housePollInFlight = useRef(false);
  const houseGeneration = useRef(0);

  useEffect(() => {
    const query = new URLSearchParams(location.search).get("centerId")?.trim() ?? "";
    const saved = localStorage.getItem(CENTER_STORAGE)?.trim() ?? "";
    const value = query || saved;
    if (!value) return;
    setCenterId(value);
    setDraft(value);
    if (query) localStorage.setItem(CENTER_STORAGE, query);
  }, []);
  const pollHouse = useCallback(async () => {
    if (!centerId || housePollInFlight.current) return;
    housePollInFlight.current = true;
    const generation = houseGeneration.current;
    try {
      if (!wasConnected.current) {
        const response = await fetch(`/api/pinoria-tv/snapshot?centerId=${encodeURIComponent(centerId)}&t=${Date.now()}`, { cache: "no-store" });
        const json = await response.json() as { data?: HouseSnapshot };
        if (!response.ok || !json.data) throw new Error("offline");
        if (generation !== houseGeneration.current) return;
        const advanced = advanceHouseSnapshotCursor(json.data.cursor, cursor.current, presentedSequence.current);
        if (advanced.applySnapshot) {
          cursor.current = advanced.cursor;
          presentedSequence.current = advanced.presentedSequence;
          setInside(json.data.learners);
        }
        setConnected(true);
        wasConnected.current = true;
        return;
      }
      const response = await fetch(`/api/pinoria-tv/events?centerId=${encodeURIComponent(centerId)}&after=${cursor.current}&t=${Date.now()}`, { cache: "no-store" });
      const json = await response.json() as { data?: EventPage };
      if (!response.ok || !json.data) throw new Error("offline");
      if (generation !== houseGeneration.current) return;
      const page = json.data;
      if (page.cursor < cursor.current) {
        setConnected(true);
        return;
      }
      const unseen = selectUnseenHouseEvents(page.events, presentedSequence.current);
      cursor.current = Math.max(cursor.current, page.cursor);
      if (unseen.events.length) {
        presentedSequence.current = Math.max(presentedSequence.current, unseen.lastSequence);
        enqueueHouseEvents(unseen.events);
      }
      setConnected(true);
    } catch {
      if (generation === houseGeneration.current) {
        setConnected(false);
        wasConnected.current = false;
      }
    } finally {
      if (generation === houseGeneration.current) housePollInFlight.current = false;
    }
  }, [centerId]);
  function enqueueHouseEvents(events: HouseEvent[]) {
    setScenes((queue) => [
      ...queue,
      ...events.map((event) => ({
        id: `${event.sequence}`,
        kind: event.type === "ARRIVAL" ? "arrival" as const : "departure" as const,
        name: event.payload.displayName,
        config: event.payload.character,
        studentProfileId: event.studentProfileId,
        phase: event.type === "DEPARTURE" ? "transition" as const : "performance" as const,
        visitId: event.visitId,
      })),
    ]);
    setInside((current) => {
      const next = new Map(current.map((item) => [item.studentProfileId, item]));
      for (const event of events) {
        if (event.type === "ARRIVAL") next.set(event.studentProfileId, {
          studentProfileId: event.studentProfileId,
          displayName: event.payload.displayName,
          visit: { id: event.visitId, checkedInAt: event.occurredAt, version: 1 },
          character: { id: event.characterId, config: event.payload.character },
        });
      }
      return [...next.values()];
    });
  }

  useEffect(() => {
    if (!centerId) return;
    houseGeneration.current += 1;
    const generation = houseGeneration.current;
    housePollInFlight.current = false;
    wasConnected.current = false;
    void pollHouse();
    const timer = window.setInterval(() => void pollHouse(), 750);
    return () => {
      window.clearInterval(timer);
      if (houseGeneration.current === generation) houseGeneration.current += 1;
      housePollInFlight.current = false;
    };
  }, [centerId, pollHouse]);
  const pollPresentation = useCallback(async () => {
    if (!centerId || presentationBusy.current || presentation || scenes.length > 0) return;
    presentationBusy.current = true;
    try {
      const claimed = await claimPresentation(centerId);
      if (claimed) setPresentation(claimed);
    } catch {
      // House presence remains usable if the Wish relay is temporarily unavailable.
    } finally {
      presentationBusy.current = false;
    }
  }, [centerId, scenes.length, presentation]);

  useEffect(() => {
    if (!centerId) return;
    void pollPresentation();
    const timer = window.setInterval(() => void pollPresentation(), 1000);
    return () => window.clearInterval(timer);
  }, [centerId, pollPresentation]);

  useEffect(() => {
    const scene = scenes[0];
    if (!scene || presentation) return;
    const duration = scene.kind === "departure" && scene.phase === "transition" ? 1200 : 5200;
    const timer = window.setTimeout(() => {
      if (scene.kind === "departure" && scene.phase === "transition") {
        setScenes((queue) => queue[0]?.id === scene.id
          ? [{ ...queue[0], phase: "performance" }, ...queue.slice(1)]
          : queue);
        return;
      }
      if (scene.kind === "departure") {
        setInside((current) => current.filter((learner) => learner.studentProfileId !== scene.studentProfileId || learner.visit.id !== scene.visitId));
      }
      setScenes((queue) => queue[0]?.id === scene.id ? queue.slice(1) : queue);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [scenes, presentation]);

  useEffect(() => {
    if (!presentation || !centerId) return;
    const presentationId = presentation.id;
    let cancelled = false;
    let timer = 0;

    const finish = async () => {      try {
        await completePresentation(centerId, presentationId);
        if (cancelled) return;
        setPresentation((current) => current?.id === presentationId ? null : current);
      } catch {
        if (!cancelled) timer = window.setTimeout(() => void finish(), 1500);
      }
    };

    const duration = presentation.kind === "WISH_REVEAL"
      ? wishRevealSceneMs(presentation.projection)
      : presentation.kind === "EGG_HATCH"
        ? EGG_HATCH_SCENE_MS
        : COMPANION_RITUAL_SCENE_MS;
    timer = window.setTimeout(() => void finish(), duration);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [centerId, presentation]);

  function saveCenter() {
    const value = draft.trim();
    if (!value) return;
    localStorage.setItem(CENTER_STORAGE, value);
    houseGeneration.current += 1;
    housePollInFlight.current = false;
    cursor.current = 0;
    presentedSequence.current = 0;
    wasConnected.current = false;
    setInside([]);
    setScenes([]);
    setPresentation(null);
    setCenterId(value);
  }

  function resetCenter() {
    localStorage.removeItem(CENTER_STORAGE);
    houseGeneration.current += 1;
    housePollInFlight.current = false;
    cursor.current = 0;
    presentedSequence.current = 0;
    wasConnected.current = false;
    setInside([]);
    setScenes([]);
    setPresentation(null);
    setCenterId("");
  }
  const ambientLearners = useMemo(() => inside.map((learner) => ({ id: learner.studentProfileId, name: learner.displayName, config: learner.character.config })), [inside]);
  if (!centerId) {
    return <main className={styles.setup}>
      <div>
        <span>PINORIA · HOUSE TV</span>
        <h1>Kết nối màn hình</h1>
        <p>Nhập Center ID một lần cho TV.</p>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Center ID" />
        <button onClick={saveCenter}>Kết nối</button>
      </div>
    </main>;
  }

  const scene = scenes[0] ?? null;
  const performanceScene = scene?.phase === "performance" ? scene : null;
  const departingId = scene?.kind === "departure" && scene.phase === "transition"
    && inside.some((learner) => houseDepartureMatchesVisit(learner.studentProfileId, learner.visit.id, scene.studentProfileId, scene.visitId))
    ? scene.studentProfileId
    : null;
  const active = Boolean(performanceScene || presentation);
  return <main className={`${styles.stage} ${active ? styles.active : ""}`}>
    <div className={styles.sky} />
    <div className={styles.orbOne} />
    <div className={styles.orbTwo} />
    <header className={styles.status}>
      <div><b>PINORIA</b><span>HOUSE</span></div>
      <div className={styles.live}>
        <i className={connected ? styles.online : styles.offline} />
        {connected ? `${inside.length} Piner đang ở House` : "Đang reconcile…"}
      </div>
    </header>    <AmbientHouseRuntime learners={ambientLearners} departingId={departingId} />

    {performanceScene ? <section key={performanceScene.id} className={`${styles.scene} ${performanceScene.kind === "departure" ? styles.departure : ""}`}>
      <div className={styles.aura}><img src="https://assets.pinohouse.art/draft/AuraLv3.png" alt="" /></div>
      <LayeredCharacter className={styles.character} config={performanceScene.config} />
      <img className={styles.mori} src="https://assets.pinohouse.art/draft/Mori.png" alt="" />
      <div className={styles.copy}>
        <span>{performanceScene.kind === "arrival" ? "CHÀO ĐẾN PINO HOUSE" : "HẸN GẶP LẠI"}</span>
        <h1>{performanceScene.name}</h1>
        <p>{performanceScene.kind === "arrival" ? "Pinoria đã nhận ra bạn ✦" : "Hẹn gặp lại trong chuyến phiêu lưu tiếp theo ✦"}</p>
      </div>
    </section> : null}
    {!scene && !presentation ? <section className={styles.idle}>
      <div className={styles.sigil}>P</div>
      <span>PINORIA HOUSE IS ALIVE</span>
      <h1>Chào mừng đến PINO House</h1>
      <p>{inside.length ? `${inside.length} Piner đang khám phá cùng nhau.` : "Pinoria đang chờ Piner đầu tiên."}</p>
    </section> : null}

    {presentation?.kind === "WISH_REVEAL" ? <WishRevealScene reveal={presentation.projection} /> : null}
    {presentation?.kind === "EGG_HATCH" ? <EggHatchScene hatch={presentation.projection} /> : null}
    {presentation?.kind === "COMPANION_RITUAL" ? <CompanionRitualScene ritual={presentation.projection} /> : null}

    <footer>
      <span>{new Date().toLocaleDateString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
      })}</span>
      <button onClick={resetCenter}>Center</button>
    </footer>
  </main>;
}
