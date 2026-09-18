"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { LayeredCharacter, type PinoriaCharacterConfig } from "./layered-character";
import { AmbientHouseRuntime } from "./ambient-house-runtime";
import { advanceHouseSnapshotCursor, selectUnseenHouseEvents } from "./house-event-sequence";
import { actorFromArrival, actorHasSource, parsePresenceEventPage, parsePresenceSnapshot, type PresenceActor, type PresenceActorType, type PresenceEvent, type PresenceSourceType } from "./presence-contract";
import { claimPresentation, completePresentation } from "./presentation-client";
import { WishRevealScene, wishRevealSceneMs } from "./wish-reveal-scene";
import type { PinoriaPresentation } from "./presentation-types";
import { EggHatchScene, EGG_HATCH_SCENE_MS } from "./egg-hatch-scene";
import { CompanionRitualScene, COMPANION_RITUAL_SCENE_MS } from "./companion-ritual-scene";
import styles from "./reception-tv.module.css";

type Scene = {
  id: string;
  kind: "arrival" | "departure";
  name: string;
  config: PinoriaCharacterConfig;
  actorType: PresenceActorType;
  pinoriaSelfId: string;
  sourceType: PresenceSourceType;
  sourceId: string;
  phase: "transition" | "performance" | "handoff";
};

const CENTER_STORAGE = "pino.arrival.centerId";
const ARRIVAL_PERFORMANCE_MS = 5200;
const ARRIVAL_HANDOFF_MS = 1800;
const DEPARTURE_TRANSITION_MS = 1200;
const DEPARTURE_PERFORMANCE_MS = 5200;

export function ReceptionTv() {
  const [centerId, setCenterId] = useState("");
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState(false);
  const [inside, setInside] = useState<PresenceActor[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [presentation, setPresentation] = useState<PinoriaPresentation | null>(null);
  const cursor = useRef(0);
  const presentedSequence = useRef(0);
  const wasConnected = useRef(false);
  const presentationBusy = useRef(false);
  const housePollInFlight = useRef(false);
  const houseGeneration = useRef(0);
  const stageRef = useRef<HTMLElement | null>(null);
  const [arrivalHandoffTarget, setArrivalHandoffTarget] = useState<{ left: string; top: string; width: string; height: string } | null>(null);

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
        const json = await response.json() as { data?: unknown };
        if (!response.ok || !json.data) throw new Error("offline");
        const snapshot = parsePresenceSnapshot(json.data);
        if (generation !== houseGeneration.current) return;
        const advanced = advanceHouseSnapshotCursor(snapshot.cursor, cursor.current, presentedSequence.current);
        if (advanced.applySnapshot) {
          cursor.current = advanced.cursor;
          presentedSequence.current = advanced.presentedSequence;
          setInside(snapshot.actors);
          // Snapshot is reconnect truth. Never replay or resume a historical presence scene across reconnect.
          setScenes([]);
        }
        setConnected(true);
        wasConnected.current = true;
        return;
      }
      const response = await fetch(`/api/pinoria-tv/events?centerId=${encodeURIComponent(centerId)}&after=${cursor.current}&t=${Date.now()}`, { cache: "no-store" });
      const json = await response.json() as { data?: unknown };
      if (!response.ok || !json.data) throw new Error("offline");
      if (generation !== houseGeneration.current) return;
      const page = parsePresenceEventPage(json.data);
      if (page.cursor < cursor.current) {
        setConnected(true);
        return;
      }
      const unseen = selectUnseenHouseEvents(page.events, presentedSequence.current, page.cursor);
      if (unseen.hasGap) {
        setConnected(false);
        wasConnected.current = false;
        return;
      }
      cursor.current = Math.max(cursor.current, page.cursor);
      presentedSequence.current = Math.max(presentedSequence.current, unseen.lastSequence);
      if (unseen.events.some((event) => event.kind === "RECONCILE_REQUIRED")) {
        // Aggregate source transitions are snapshot-only: never flash a partial hero from the same page.
        setConnected(false);
        wasConnected.current = false;
        return;
      }
      if (unseen.events.length) {
        enqueuePresenceEvents(unseen.events.filter((event): event is PresenceEvent => event.kind === "PRESENCE_EVENT"));
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
  function enqueuePresenceEvents(events: PresenceEvent[]) {
    setScenes((queue) => [
      ...queue,
      ...events.map((event) => ({
        id: `${event.sequence}`,
        kind: event.type === "ARRIVAL" ? "arrival" as const : "departure" as const,
        name: event.payload.displayName,
        config: event.payload.character ?? {},
        actorType: event.actorType,
        pinoriaSelfId: event.pinoriaSelfId,
        sourceType: event.sourceType,
        sourceId: event.sourceId,
        phase: event.type === "DEPARTURE" ? "transition" as const : "performance" as const,
      })),
    ]);
    setInside((current) => {
      const next = new Map(current.map((item) => [item.pinoriaSelfId, item]));
      for (const event of events) {
        if (event.type === "ARRIVAL") next.set(event.pinoriaSelfId, actorFromArrival(event));
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

  const scene = scenes[0] ?? null;
  const sceneIsCurrent = !scene
    || inside.some((actor) => actor.pinoriaSelfId === scene.pinoriaSelfId && actorHasSource(actor, scene.sourceType, scene.sourceId));

  useEffect(() => {
    if (!scene || presentation) return;
    if (!sceneIsCurrent) {
      setScenes((queue) => queue[0]?.id === scene.id ? queue.slice(1) : queue);
      return;
    }
    const duration = scene.kind === "arrival"
      ? scene.phase === "performance" ? ARRIVAL_PERFORMANCE_MS : ARRIVAL_HANDOFF_MS
      : scene.phase === "transition" ? DEPARTURE_TRANSITION_MS : DEPARTURE_PERFORMANCE_MS;
    const timer = window.setTimeout(() => {
      if (scene.kind === "arrival" && scene.phase === "performance") {
        setScenes((queue) => queue[0]?.id === scene.id
          ? [{ ...queue[0], phase: "handoff" }, ...queue.slice(1)]
          : queue);
        return;
      }
      if (scene.kind === "departure" && scene.phase === "transition") {
        setScenes((queue) => queue[0]?.id === scene.id
          ? [{ ...queue[0], phase: "performance" }, ...queue.slice(1)]
          : queue);
        return;
      }
      if (scene.kind === "departure") {
        setInside((current) => current.filter((actor) => actor.pinoriaSelfId !== scene.pinoriaSelfId
          || !actorHasSource(actor, scene.sourceType, scene.sourceId)));
      }
      setScenes((queue) => queue[0]?.id === scene.id ? queue.slice(1) : queue);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [presentation, scene, sceneIsCurrent]);

  useLayoutEffect(() => {
    if (!scene || scene.kind !== "arrival" || scene.phase !== "handoff") {
      setArrivalHandoffTarget(null);
      return;
    }
    const stage = stageRef.current;
    if (!stage) return;
    const target = Array.from(stage.querySelectorAll<HTMLElement>("[data-ambient-runtime-character]"))
      .find((element) => element.dataset.ambientRuntimeSelf === scene.pinoriaSelfId);
    if (!target) {
      setScenes((queue) => queue[0]?.id === scene.id ? queue.slice(1) : queue);
      return;
    }
    const stageRect = stage.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    if (!stageRect.width || !stageRect.height || !targetRect.width || !targetRect.height) return;
    setArrivalHandoffTarget({
      left: `${((targetRect.left + targetRect.width / 2 - stageRect.left) / stageRect.width) * 100}%`,
      top: `${((targetRect.top + targetRect.height / 2 - stageRect.top) / stageRect.height) * 100}%`,
      width: `${targetRect.width}px`,
      height: `${targetRect.height}px`,
    });
  }, [scene]);
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
  const ambientActors = useMemo(() => inside.map((actor) => ({ id: actor.pinoriaSelfId, actorType: actor.actorType, name: actor.displayName, config: actor.character })), [inside]);
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

  const visualScene = scene?.phase === "performance" || (scene?.kind === "arrival" && scene.phase === "handoff") ? scene : null;
  const arrivalActorIds = scenes.filter((queued) => queued.kind === "arrival").map((queued) => queued.pinoriaSelfId);
  const departingId = scene?.kind === "departure" && scene.phase === "transition"
    && inside.some((actor) => actor.pinoriaSelfId === scene.pinoriaSelfId && actorHasSource(actor, scene.sourceType, scene.sourceId))
    ? scene.pinoriaSelfId
    : null;
  const isArrivalHandoff = visualScene?.kind === "arrival" && visualScene.phase === "handoff";
  const handoffStyle = isArrivalHandoff && arrivalHandoffTarget ? ({
    "--arrival-target-left": arrivalHandoffTarget.left,
    "--arrival-target-top": arrivalHandoffTarget.top,
    "--arrival-target-width": arrivalHandoffTarget.width,
    "--arrival-target-height": arrivalHandoffTarget.height,
  } as CSSProperties) : undefined;
  const active = Boolean(visualScene || presentation);
  const arrivalActive = visualScene?.kind === "arrival";
  return <main ref={stageRef} className={`${styles.stage} ${active ? styles.active : ""} ${arrivalActive ? styles.arrivalActive : ""}`}>
    <div className={styles.sky} />
    <div className={styles.orbOne} />
    <div className={styles.orbTwo} />
    <header className={styles.status}>
      <div><b>PINORIA</b><span>HOUSE</span></div>
      <div className={styles.live}>
        <i className={connected ? styles.online : styles.offline} />
        {connected ? `${inside.length} Piner đang ở House` : "Đang reconcile…"}
      </div>
    </header>    <AmbientHouseRuntime actors={ambientActors} departingId={departingId} suppressedIds={arrivalActorIds} frozenIds={arrivalActorIds} />

    {visualScene ? <section
      key={visualScene.id}
      data-arrival-scene={visualScene.kind === "arrival" ? "true" : undefined}
      data-arrival-phase={visualScene.kind === "arrival" ? visualScene.phase : undefined}
      data-arrival-self={visualScene.kind === "arrival" ? visualScene.pinoriaSelfId : undefined}
      data-arrival-source-type={visualScene.kind === "arrival" ? visualScene.sourceType : undefined}
      data-arrival-source-id={visualScene.kind === "arrival" ? visualScene.sourceId : undefined}
      data-presence-actor-type={visualScene.actorType}
      className={`${styles.scene} ${visualScene.kind === "arrival" ? styles.arrivalScene : styles.departure} ${isArrivalHandoff ? styles.arrivalHandoff : ""}`}
      style={handoffStyle}
    >
      {visualScene.kind === "arrival" ? <div className={styles.arrivalBackdrop} /> : null}
      <div className={styles.aura}><img src="https://assets.pinohouse.art/draft/AuraLv3.png" alt="" /></div>
      {visualScene.kind === "arrival" ? <><div className={styles.heroLight} /><div className={styles.footShadow} /><div className={styles.contactShadow} /><div className={styles.radiance} /></> : null}
      <LayeredCharacter className={styles.character} config={visualScene.config} />
      <div className={styles.moriShadow} />
      <img className={styles.mori} src="https://assets.pinohouse.art/draft/Mori.png" alt="" />
      <div className={styles.copy}>
        <span>{visualScene.kind === "arrival" ? `CHÀO ĐẾN · ${visualScene.name.toUpperCase()}` : "HẸN GẶP LẠI"}</span>
        <h1>{visualScene.kind === "arrival" ? `Chào ${visualScene.name} ✦` : visualScene.name}</h1>
        <p>{visualScene.kind === "arrival" ? "Hôm nay Mori đi cùng mình!" : "Hẹn gặp lại trong chuyến phiêu lưu tiếp theo ✦"}</p>
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
