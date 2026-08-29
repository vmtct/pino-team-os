"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LayeredCharacter, type PinoriaCharacterConfig } from "./layered-character";
import { claimPresentation, completePresentation } from "./presentation-client";
import { WishRevealScene, wishRevealSceneMs } from "./wish-reveal-scene";
import type { PinoriaPresentation } from "./presentation-types";
import { EggHatchScene, EGG_HATCH_SCENE_MS } from "./egg-hatch-scene";
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
  const wasConnected = useRef(false);
  const presentationBusy = useRef(false);

  useEffect(() => {
    const query = new URLSearchParams(location.search).get("centerId")?.trim() ?? "";
    const saved = localStorage.getItem(CENTER_STORAGE)?.trim() ?? "";
    const value = query || saved;
    if (!value) return;
    setCenterId(value);
    setDraft(value);
    if (query) localStorage.setItem(CENTER_STORAGE, query);
  }, []);
  const reconcile = useCallback(async () => {
    if (!centerId) return;
    const response = await fetch(`/api/pinoria-tv/snapshot?centerId=${encodeURIComponent(centerId)}&t=${Date.now()}`, { cache: "no-store" });
    const json = await response.json() as { data?: HouseSnapshot };
    if (!response.ok || !json.data) throw new Error("offline");
    cursor.current = json.data.cursor;
    setInside(json.data.learners);
    setConnected(true);
    wasConnected.current = true;
  }, [centerId]);

  const pollHouse = useCallback(async () => {
    if (!centerId) return;
    try {
      if (!wasConnected.current) {
        await reconcile();
        return;
      }
      const response = await fetch(`/api/pinoria-tv/events?centerId=${encodeURIComponent(centerId)}&after=${cursor.current}&t=${Date.now()}`, { cache: "no-store" });
      const json = await response.json() as { data?: EventPage };
      if (!response.ok || !json.data) throw new Error("offline");
      const page = json.data;
      cursor.current = page.cursor;
      if (page.events.length) enqueueHouseEvents(page.events);
      setConnected(true);
    } catch {
      setConnected(false);
      wasConnected.current = false;
    }
  }, [centerId, reconcile]);
  function enqueueHouseEvents(events: HouseEvent[]) {
    setScenes((queue) => [
      ...queue,
      ...events.map((event) => ({
        id: `${event.sequence}`,
        kind: event.type === "ARRIVAL" ? "arrival" as const : "departure" as const,
        name: event.payload.displayName,
        config: event.payload.character,
      })),
    ]);
    setInside((current) => {
      const next = new Map(current.map((item) => [item.studentProfileId, item]));
      for (const event of events) {
        if (event.type === "DEPARTURE") next.delete(event.studentProfileId);
        else next.set(event.studentProfileId, {
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
    wasConnected.current = false;
    void pollHouse();
    const timer = window.setInterval(() => void pollHouse(), 750);
    return () => window.clearInterval(timer);
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
    if (!scenes.length || presentation) return;
    const timer = window.setTimeout(() => setScenes((queue) => queue.slice(1)), 5200);
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

    const duration = presentation.kind === "WISH_REVEAL" ? wishRevealSceneMs(presentation.projection) : EGG_HATCH_SCENE_MS;
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
    cursor.current = 0;
    wasConnected.current = false;
    setInside([]);
    setScenes([]);
    setPresentation(null);
    setCenterId(value);
  }

  function resetCenter() {
    localStorage.removeItem(CENTER_STORAGE);
    cursor.current = 0;
    wasConnected.current = false;
    setInside([]);
    setScenes([]);
    setPresentation(null);
    setCenterId("");
  }
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
  const active = Boolean(scene || presentation);
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
    </header>    <div className={styles.ambient} aria-label={`${inside.length} learners in House`}>
      {inside.slice(0, 60).map((learner, index) => (
        <div
          key={learner.studentProfileId}
          className={styles.ambientCharacter}
          style={{
            "--x": `${6 + (index * 37) % 88}%`,
            "--y": `${20 + (index * 53) % 60}%`,
            "--delay": `${-(index % 11) * .7}s`,
            "--scale": `${.55 + (index % 5) * .07}`,
          } as CSSProperties}
        >
          <LayeredCharacter config={learner.character.config} style={{ width: "100%", height: "100%" }} />
          <span>{learner.displayName}</span>
        </div>
      ))}    </div>

    {scene ? <section key={scene.id} className={`${styles.scene} ${scene.kind === "departure" ? styles.departure : ""}`}>
      <div className={styles.aura}><img src="https://assets.pinohouse.art/draft/AuraLv3.png" alt="" /></div>
      <LayeredCharacter className={styles.character} config={scene.config} />
      <img className={styles.mori} src="https://assets.pinohouse.art/draft/Mori.png" alt="" />
      <div className={styles.copy}>
        <span>{scene.kind === "arrival" ? "CHÀO ĐẾN PINO HOUSE" : "HẸN GẶP LẠI"}</span>
        <h1>{scene.name}</h1>
        <p>{scene.kind === "arrival" ? "Pinoria đã nhận ra bạn ✦" : "Hẹn gặp lại trong chuyến phiêu lưu tiếp theo ✦"}</p>
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
