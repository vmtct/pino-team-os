"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AmbientSocialSimulation, type AmbientSocialSubject } from "./ambient-social-simulation";
import { AmbientToDepartureTransition, AMBIENT_TO_DEPARTURE_MS, type FrozenAmbientActor } from "./ambient-to-departure-transition";
import { ArrivalScene } from "./arrival-scene";
import { ChoiceToAmbientScene, CHOICE_TO_AMBIENT_MS, type AmbientHandoffTarget } from "./choice-to-ambient-scene";
import { DepartureScene } from "./departure-scene";
import { companionView } from "./companion-view";
import {
  DEFAULT_ENERGY_SEED_REWARD,
  ENERGY_SEED_SCENE_MS,
  EnergySeedScene,
} from "./energy-seed-scene";
import {
  DEFAULT_LEARNING_SPOTLIGHT,
  LEARNING_SPOTLIGHT_MS,
  LearningSpotlightScene,
} from "./learning-spotlight-scene";
import { fitPinoriaStageRect, PINORIA_STAGE_HEIGHT, PINORIA_STAGE_WIDTH } from "./pinoria-stage";
import { PrototypeCompanion } from "./prototype-assets";
import { getLostArtifact } from "./lost-artifact-data";
import { LOST_ARTIFACT_BROADCAST_MS, LostArtifactScene } from "./lost-artifact-scene";
import {
  DEFAULT_PINORIA_WORLD_STATE,
  PINORIA_SHOP_CATALOG_URL,
  type CharacterProjectionSnapshot,
  type CompanionProjectionSnapshot,
  type EnergySeedReward,
  type LearningSpotlightPayload,
  type PinoriaSurfaceSessionSnapshot,
  type PinoriaWorldStateSnapshot,
  type ShopCatalogItem,
  type WorldBroadcastPayload,
  type WorldStateTransitionPayload,
} from "./shop-types";
import {
  DEFAULT_WORLD_BROADCAST,
  WORLD_BROADCAST_MS,
  WorldBroadcastScene,
} from "./world-broadcast-scene";
import { WorldStateAmbientOverlay } from "./world-state-ambient-overlay";
import { claimWishReveal, completeWishReveal } from "./wish-reveal-client";
import { WishRevealScene, wishRevealSceneMs } from "./wish-reveal-scene";
import type { WishRevealProjection } from "./wish-reveal-types";
import {
  WORLD_STATE_TRANSITION_MS,
  WorldStateTransitionScene,
} from "./world-state-transition-scene";
import { DEFAULT_WORLD_STATE_TRANSITION } from "./world-state-transition-data";
import styles from "./tv.module.css";

type Mode = "ambient" | "arrival" | "choice" | "ritual" | "reward" | "wish" | "learning" | "broadcast" | "world-transition" | "departure-transition" | "departure";
type TVSubject = {
  id: string;
  name: string;
  path: string;
  room: string;
  companion?: string;
  character?: CharacterProjectionSnapshot;
  companionState?: CompanionProjectionSnapshot;
};

type RelayEvent = {
  id: number;
  kind: "play" | "control";
  mode?: "arrival" | "departure" | "reward" | "learning" | "broadcast" | "world-transition";
  replay?: boolean;
  subject?: TVSubject;
  reward?: EnergySeedReward;
  spotlight?: LearningSpotlightPayload;
  broadcast?: WorldBroadcastPayload;
  worldTransition?: WorldStateTransitionPayload;
  action?: "ambient";
};

type RelaySurfaceSnapshot = PinoriaSurfaceSessionSnapshot & { housePresence?: TVSubject[]; activeEvent?: { id: number } | null };

type RelayMutationResponse = {
  ok?: boolean;
  event?: RelayEvent;
  surface?: RelaySurfaceSnapshot;
};

const SURFACE_ID = "RECEPTION_TV";
const RELAY_URL = "/api/pinoria-prototype/tv-relay";
const ARRIVAL_MS = 7650;
const DEPARTURE_MS = 9000;
const AMBIENT_SUBJECT_HANDOFF_LEAD_MS = 180;

const modes: { id: Exclude<Mode, "departure-transition">; label: string }[] = [
  { id: "ambient", label: "Ambient" },
  { id: "arrival", label: "Arrival" },
  { id: "choice", label: "Quick Choice" },
  { id: "learning", label: "Learning Spotlight" },
  { id: "reward", label: "Hạt Năng Lượng" },
  { id: "broadcast", label: "World Broadcast" },
  { id: "world-transition", label: "World State Transition" },
  { id: "ritual", label: "Companion Ritual" },
  { id: "departure", label: "Departure" },
];

const defaultSubject: TVSubject = {
  id: "bo",
  name: "Bơ",
  path: "ArtChitect · Màu nước II",
  room: "Phòng Họa",
};

function replayTitle(event: RelayEvent) {
  if (event.mode === "arrival") return "CHÀO ĐẾN";
  if (event.mode === "departure") return "CHÀO VỀ";
  if (event.mode === "reward") return "HẠT NĂNG LƯỢNG";
  if (event.mode === "learning") return "LEARNING SPOTLIGHT";
  if (event.mode === "broadcast") return event.broadcast?.kind === "lost-artifact" ? "THẦN KHÍ THẤT LẠC" : "WORLD BROADCAST";
  if (event.mode === "world-transition") return "WORLD STATE";
  return "SỰ KIỆN";
}

function captureAmbientActors(): FrozenAmbientActor[] {
  const screen = document.querySelector<HTMLElement>("[data-pinoria-tv-screen]");
  const screenRect = screen?.getBoundingClientRect() ?? {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
  if (!screenRect.width || !screenRect.height) return [];

  const stageRect = fitPinoriaStageRect({
    left: screenRect.left,
    top: screenRect.top,
    width: screenRect.width,
    height: screenRect.height,
  });

  return Array.from(document.querySelectorAll<HTMLElement>("[data-ambient-runtime-character]"))
    .map((element) => {
      const id = element.dataset.ambientRuntimeCharacter;
      if (!id) return null;
      const visual = element.querySelector<HTMLElement>("[data-pinoria-character-subject]") ?? element;
      const rect = visual.getBoundingClientRect();
      return {
        id,
        leftPct: ((rect.left - stageRect.left) / stageRect.width) * 100,
        topPct: ((rect.top - stageRect.top) / stageRect.height) * 100,
        widthPct: (rect.width / stageRect.width) * 100,
        heightPct: (rect.height / stageRect.height) * 100,
      } satisfies FrozenAmbientActor;
    })
    .filter((value): value is FrozenAmbientActor => value !== null);
}

function captureAmbientHandoffTarget(subjectId: string): AmbientHandoffTarget | null {
  const element = Array.from(document.querySelectorAll<HTMLElement>("[data-ambient-runtime-character]"))
    .find((candidate) => candidate.dataset.ambientRuntimeCharacter === subjectId);
  if (!element) return null;
  const left = Number.parseFloat(element.style.left);
  const top = Number.parseFloat(element.style.top);
  const width = Number.parseFloat(element.style.width);
  if (![left, top, width].every(Number.isFinite)) return null;
  return { leftPct: (left / PINORIA_STAGE_WIDTH) * 100, topPct: (top / PINORIA_STAGE_HEIGHT) * 100, widthPct: (width / PINORIA_STAGE_WIDTH) * 100 };
}

export function PinoriaTVPrototype({ reviewEnabled = false }: { reviewEnabled?: boolean }) {
  const [mode, setMode] = useState<Mode>("ambient");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [subject, setSubject] = useState<TVSubject>(defaultSubject);
  const [ambientSubject, setAmbientSubject] = useState<TVSubject>(defaultSubject);
  const [housePresence, setHousePresence] = useState<TVSubject[]>([]);
  const [housePresenceLoaded, setHousePresenceLoaded] = useState(false);
  const [ambientCharacterVisible, setAmbientCharacterVisible] = useState(true);
  const [ambientHiddenSubjectId, setAmbientHiddenSubjectId] = useState<string | null>(null);
  const [choiceAmbientTarget, setChoiceAmbientTarget] = useState<AmbientHandoffTarget | null>(null);
  const [characterCatalog, setCharacterCatalog] = useState<ShopCatalogItem[]>([]);
  const [frozenActors, setFrozenActors] = useState<FrozenAmbientActor[]>([]);
  const [reward, setReward] = useState<EnergySeedReward>(DEFAULT_ENERGY_SEED_REWARD);
  const [wishReveal, setWishReveal] = useState<WishRevealProjection | null>(null);
  const [spotlight, setSpotlight] = useState<LearningSpotlightPayload>(DEFAULT_LEARNING_SPOTLIGHT);
  const [broadcast, setBroadcast] = useState<WorldBroadcastPayload>(DEFAULT_WORLD_BROADCAST);
  const [worldTransition, setWorldTransition] = useState<WorldStateTransitionPayload>(DEFAULT_WORLD_STATE_TRANSITION);
  const [worldState, setWorldState] = useState<PinoriaWorldStateSnapshot>(DEFAULT_PINORIA_WORLD_STATE);
  const [replayLabel, setReplayLabel] = useState<string | null>(null);
  const sequenceTimer = useRef<number | null>(null);
  const ambientSubjectTimer = useRef<number | null>(null);
  const modeRef = useRef<Mode>("ambient");
  const subjectRef = useRef<TVSubject>(defaultSubject);
  const activeEventId = useRef<number | null>(null);
  const activeWishRevealId = useRef<string | null>(null);
  const busyRef = useRef(false);
  const pollingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(PINORIA_SHOP_CATALOG_URL, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { items?: ShopCatalogItem[] }) => {
        if (!cancelled && Array.isArray(data.items)) setCharacterCatalog(data.items);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    subjectRef.current = subject;
  }, [subject]);

  useEffect(() => {
    let stopped = false;

    async function post(body: Record<string, unknown>): Promise<RelayMutationResponse | null> {
      try {
        const response = await fetch(RELAY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        });
        if (!response.ok) return null;
        return await response.json().catch(() => null) as RelayMutationResponse | null;
      } catch {
        return null;
      }
    }

    function applyHousePresence(next: TVSubject[] | undefined) {
      if (!next) return;
      setHousePresenceLoaded(true);
      setHousePresence((current) => {
        if (current.length !== next.length) return next;
        const unchanged = current.every((item, index) => {
          const candidate = next[index];
          return candidate
            && item.id === candidate.id
            && item.name === candidate.name
            && item.path === candidate.path
            && item.room === candidate.room
            && item.character?.revision === candidate.character?.revision
            && item.companionState?.revision === candidate.companionState?.revision;
        });
        return unchanged ? current : next;
      });
    }

    async function heartbeat() {
      const relayMode = modeRef.current === "departure-transition" ? "departure" : modeRef.current === "wish" ? "ambient" : modeRef.current;
      const currentSubject = subjectRef.current;
      const response = await post({
        op: "heartbeat",
        surfaceId: SURFACE_ID,
        mode: relayMode,
        subject: { id: currentSubject.id, name: currentSubject.name },
      });
      if (!stopped && response?.surface) {
        if (response.surface.worldState && modeRef.current === "ambient") setWorldState(response.surface.worldState);
        if (response.surface.housePresence) applyHousePresence(response.surface.housePresence);
      }
    }

    async function finishEvent(id: number) {
      if (activeEventId.current !== id) return;
      const completed = await post({ op: "complete", surfaceId: SURFACE_ID, id });
      activeEventId.current = null;
      busyRef.current = false;
      if (!stopped) {
        if (completed?.surface?.worldState) setWorldState(completed.surface.worldState);
        if (completed?.surface?.housePresence) applyHousePresence(completed.surface.housePresence);
        setReplayLabel(null);
        setAmbientCharacterVisible(true);
        setAmbientHiddenSubjectId(null);
        setChoiceAmbientTarget(null);
        setMode("ambient");
      }
    }

    async function finishWishReveal(revealId: string) {
      if (activeWishRevealId.current !== revealId) return;
      try {
        await completeWishReveal(SURFACE_ID, revealId);
      } catch {
        sequenceTimer.current = window.setTimeout(() => { void finishWishReveal(revealId); }, 1500);
        return;
      }
      activeWishRevealId.current = null;
      busyRef.current = false;
      modeRef.current = "ambient";
      setWishReveal(null);
      setAmbientCharacterVisible(true);
      setMode("ambient");
    }

    function playWishReveal(reveal: WishRevealProjection) {
      clearSequenceTimers();
      busyRef.current = true;
      activeWishRevealId.current = reveal.revealId;
      setWishReveal(reveal);
      setAmbientCharacterVisible(false);
      setMode("wish");
      sequenceTimer.current = window.setTimeout(() => { void finishWishReveal(reveal.revealId); }, wishRevealSceneMs(reveal));
    }

    function clearSequenceTimers() {
      if (sequenceTimer.current) window.clearTimeout(sequenceTimer.current);
      if (ambientSubjectTimer.current) window.clearTimeout(ambientSubjectTimer.current);
      sequenceTimer.current = null;
      ambientSubjectTimer.current = null;
    }

    function playEvent(event: RelayEvent) {
      clearSequenceTimers();

      if (event.kind === "control") {
        setReplayLabel(null);
        setAmbientCharacterVisible(true);
        setAmbientHiddenSubjectId(null);
        setMode("ambient");
        void finishEvent(event.id);
        return;
      }

      if (!event.mode) {
        void finishEvent(event.id);
        return;
      }

      // World State Transition is subjectless and changes persistent Ambient
      // truth. The server commits first; this scene bridges the old projection
      // to the committed target without stealing learner ownership.
      if (event.mode === "world-transition") {
        const transition = event.worldTransition ?? DEFAULT_WORLD_STATE_TRANSITION;
        setWorldTransition(transition);
        setWorldState(transition.to);
        setReplayLabel(event.replay ? `PHÁT LẠI · ${replayTitle(event)}` : null);
        setAmbientCharacterVisible(false);
        setMode("world-transition");
        sequenceTimer.current = window.setTimeout(() => {
          if (stopped || activeEventId.current !== event.id) return;
          void finishEvent(event.id);
        }, WORLD_STATE_TRANSITION_MS);
        return;
      }

      // World Broadcast is deliberately subjectless: it temporarily owns the
      // shared surface without changing the current learner or interactive owner.
      if (event.mode === "broadcast") {
        const nextBroadcast = event.broadcast ?? DEFAULT_WORLD_BROADCAST;
        setBroadcast(nextBroadcast);
        setReplayLabel(event.replay ? `PHÁT LẠI · ${replayTitle(event)}` : null);
        setAmbientCharacterVisible(false);
        setMode("broadcast");
        sequenceTimer.current = window.setTimeout(() => {
          if (stopped || activeEventId.current !== event.id) return;
          void finishEvent(event.id);
        }, nextBroadcast.kind === "lost-artifact" ? LOST_ARTIFACT_BROADCAST_MS : WORLD_BROADCAST_MS);
        return;
      }

      if (!event.subject) {
        void finishEvent(event.id);
        return;
      }

      subjectRef.current = event.subject;
      setSubject(event.subject);
      setReplayLabel(event.replay ? `PHÁT LẠI · ${replayTitle(event)}` : null);

      if (event.mode === "learning") {
        setSpotlight(event.spotlight ?? DEFAULT_LEARNING_SPOTLIGHT);
        setAmbientCharacterVisible(false);
        setMode("learning");
        sequenceTimer.current = window.setTimeout(() => {
          if (stopped || activeEventId.current !== event.id) return;
          void finishEvent(event.id);
        }, LEARNING_SPOTLIGHT_MS);
        return;
      }

      if (event.mode === "reward") {
        setReward(event.reward ?? DEFAULT_ENERGY_SEED_REWARD);
        setAmbientCharacterVisible(false);
        setMode("reward");
        sequenceTimer.current = window.setTimeout(() => {
          if (stopped || activeEventId.current !== event.id) return;
          void finishEvent(event.id);
        }, ENERGY_SEED_SCENE_MS);
        return;
      }

      if (event.mode === "arrival" && !event.replay) {
        setAmbientCharacterVisible(true);
        setAmbientHiddenSubjectId(event.subject.id);
        setMode("arrival");
        sequenceTimer.current = window.setTimeout(() => {
          if (stopped || activeEventId.current !== event.id) return;
          setChoiceAmbientTarget(captureAmbientHandoffTarget(event.subject!.id));
          setMode("choice");
          setReplayLabel(null);

          ambientSubjectTimer.current = window.setTimeout(() => {
            if (stopped || activeEventId.current !== event.id) return;
            setAmbientSubject(event.subject!);
          }, Math.max(0, CHOICE_TO_AMBIENT_MS - AMBIENT_SUBJECT_HANDOFF_LEAD_MS));

          sequenceTimer.current = window.setTimeout(() => {
            if (stopped || activeEventId.current !== event.id) return;
            setAmbientSubject(event.subject!);
            setAmbientCharacterVisible(true);
            void finishEvent(event.id);
          }, CHOICE_TO_AMBIENT_MS);
        }, ARRIVAL_MS);
        return;
      }

      if (event.mode === "departure" && !event.replay) {
        const actors = captureAmbientActors();
        setFrozenActors(actors);
        setAmbientCharacterVisible(true);
        setAmbientHiddenSubjectId(event.subject.id);
        setMode("departure-transition");
        sequenceTimer.current = window.setTimeout(() => {
          if (stopped || activeEventId.current !== event.id) return;
          setMode("departure");
          sequenceTimer.current = window.setTimeout(() => {
            void finishEvent(event.id);
          }, DEPARTURE_MS);
        }, AMBIENT_TO_DEPARTURE_MS);
        return;
      }

      setMode(event.mode);
      const duration = event.mode === "departure" ? DEPARTURE_MS : ARRIVAL_MS;
      sequenceTimer.current = window.setTimeout(() => {
        void finishEvent(event.id);
      }, duration);
    }

    async function poll() {
      if (busyRef.current || pollingRef.current) return;
      pollingRef.current = true;
      try {
        const response = await fetch(`${RELAY_URL}?surfaceId=${SURFACE_ID}&includeEvent=1`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { event?: RelayEvent | null; surface?: RelaySurfaceSnapshot };
        const event = data.event;
        if (!event) {
          if (!stopped && data.surface?.worldState && modeRef.current === "ambient") setWorldState(data.surface.worldState);
          if (!stopped && data.surface?.housePresence) applyHousePresence(data.surface.housePresence);
          if (!stopped && !data.surface?.activeEvent && modeRef.current === "ambient") {
            const claimedWish = await claimWishReveal(SURFACE_ID).catch(() => null);
            if (claimedWish && !busyRef.current) playWishReveal(claimedWish.projection);
          }
          return;
        }

        // If a world transition is waiting, keep showing its `from` state until
        // the event is claimed; the committed `to` state is already server truth.
        if (!stopped && event.mode === "world-transition" && event.worldTransition && modeRef.current === "ambient") {
          setWorldState(event.worldTransition.from);
        }

        const claimed = await post({ op: "claim", surfaceId: SURFACE_ID, id: event.id });
        if (!claimed?.ok) return;
        if (!stopped && claimed.surface?.housePresence) applyHousePresence(claimed.surface.housePresence);
        const claimedEvent = claimed.event ?? event;
        busyRef.current = true;
        activeEventId.current = claimedEvent.id;
        if (!stopped) playEvent(claimedEvent);
      } catch {
        // Keep the current scene if the relay is temporarily unavailable.
      } finally {
        pollingRef.current = false;
      }
    }

    void heartbeat();
    void poll();
    const heartbeatTimer = window.setInterval(() => { void heartbeat(); }, 2000);
    const pollTimer = window.setInterval(() => { void poll(); }, 700);

    return () => {
      stopped = true;
      window.clearInterval(heartbeatTimer);
      window.clearInterval(pollTimer);
      clearSequenceTimers();
    };
  }, []);

  useEffect(() => {
    const relayMode = mode === "departure-transition" ? "departure" : mode === "wish" ? "ambient" : mode;
    void fetch(RELAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        op: "heartbeat",
        surfaceId: SURFACE_ID,
        mode: relayMode,
        subject: { id: subject.id, name: subject.name },
      }),
      cache: "no-store",
    }).catch(() => undefined);
  }, [mode, subject.id, subject.name]);

  function selectReviewMode(next: Exclude<Mode, "departure-transition">) {
    if (sequenceTimer.current) window.clearTimeout(sequenceTimer.current);
    if (ambientSubjectTimer.current) window.clearTimeout(ambientSubjectTimer.current);
    sequenceTimer.current = null;
    ambientSubjectTimer.current = null;
    const wishId = activeWishRevealId.current;
    if (wishId !== null) {
      activeWishRevealId.current = null;
      busyRef.current = false;
      setWishReveal(null);
      void completeWishReveal(SURFACE_ID, wishId).catch(() => undefined);
    }
    const id = activeEventId.current;
    if (id !== null) {
      activeEventId.current = null;
      busyRef.current = false;
      void fetch(RELAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "complete", surfaceId: SURFACE_ID, id }),
        cache: "no-store",
      }).catch(() => undefined);
    }
    setReplayLabel(null);
    setAmbientHiddenSubjectId(null);
    setChoiceAmbientTarget(null);
    if (next === "reward") setReward(DEFAULT_ENERGY_SEED_REWARD);
    if (next === "learning") setSpotlight(DEFAULT_LEARNING_SPOTLIGHT);
    if (next === "broadcast") setBroadcast(DEFAULT_WORLD_BROADCAST);
    if (next === "world-transition") {
      setWorldTransition(DEFAULT_WORLD_STATE_TRANSITION);
      setWorldState(DEFAULT_WORLD_STATE_TRANSITION.from);
    }
    setAmbientCharacterVisible(next !== "reward" && next !== "learning" && next !== "wish");
    setMode(next);
  }
  const activeLostArtifact = broadcast.kind === "lost-artifact" ? getLostArtifact(broadcast.artifactId ?? "") : undefined;
  const ambientSubjects = useMemo<AmbientSocialSubject[]>(() => {
    if (housePresenceLoaded) return housePresence.map(({ id, name, path, room, companion, character, companionState }) => ({ id, name, path, room, companion, character, companionState }));
    return [{ id: ambientSubject.id, name: ambientSubject.name, path: ambientSubject.path, room: ambientSubject.room, companion: ambientSubject.companion, character: ambientSubject.character, companionState: ambientSubject.companionState }];
  }, [ambientSubject.id, ambientSubject.name, ambientSubject.path, ambientSubject.room, ambientSubject.companion, ambientSubject.character, ambientSubject.companionState, housePresence, housePresenceLoaded]);


  const learnerChrome = mode === "choice" || mode === "arrival" || mode === "reward" || mode === "wish" || mode === "learning" || mode === "broadcast" || mode === "world-transition" || mode === "departure-transition" || mode === "departure";
  const ambientBackplaneVisible = mode === "ambient" || mode === "arrival" || mode === "choice" || mode === "reward" || mode === "wish" || mode === "learning" || mode === "broadcast" || mode === "world-transition" || mode === "departure-transition" || mode === "departure";

  return (
    <main data-pinoria-tv-screen className={styles.screen}>
      <div
        data-ambient-backplane
        data-ambient-character-visible={ambientCharacterVisible ? "true" : "false"}
        data-ambient-backplane-visible={ambientBackplaneVisible ? "true" : "false"}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          opacity: ambientBackplaneVisible ? 1 : 0,
          pointerEvents: "none",
          transition: "opacity 120ms linear",
        }}
      >
        <style>{`[data-ambient-backplane][data-ambient-character-visible="false"] [data-ambient-runtime-character]{display:none!important}`}</style>
        <AmbientSocialSimulation subjects={ambientSubjects} catalog={characterCatalog} hiddenSubjectId={ambientHiddenSubjectId} />
        <WorldStateAmbientOverlay state={worldState} />
      </div>

      {reviewEnabled ? <div
        className={styles.prototypeTag}
        style={learnerChrome ? { top: 14, left: 18, padding: "4px 7px", fontSize: 8, letterSpacing: ".1em", opacity: .32, background: "#161a15aa" } : undefined}
      >
        {replayLabel ?? "TV PROTOTYPE · SURFACE SESSION · RECEPTION_TV"}
      </div> : null}

      {mode === "arrival" ? <Arrival subject={subject} catalog={characterCatalog} /> : null}
      {mode === "choice" ? <ChoiceToAmbientScene subject={subject} ambientTarget={choiceAmbientTarget} catalog={characterCatalog} /> : null}
      {mode === "learning" ? <LearningSpotlightScene subject={subject} spotlight={spotlight} replay={!!replayLabel} /> : null}
      {mode === "reward" ? <EnergySeedScene subject={subject} reward={reward} replay={!!replayLabel} /> : null}
      {mode === "wish" && wishReveal ? <WishRevealScene reveal={wishReveal} /> : null}
      {mode === "broadcast" ? (activeLostArtifact ? <LostArtifactScene artifact={activeLostArtifact} /> : <WorldBroadcastScene broadcast={broadcast} replay={!!replayLabel} />) : null}
      {mode === "world-transition" ? <WorldStateTransitionScene transition={worldTransition} replay={!!replayLabel} /> : null}
      {mode === "ritual" ? <Ritual subject={subject} /> : null}
      {mode === "departure-transition" ? <AmbientToDepartureTransition subject={subject} actors={frozenActors} catalog={characterCatalog} /> : null}
      {mode === "departure" ? <Departure subject={subject} catalog={characterCatalog} /> : null}

      {reviewEnabled ? <button
        data-pinoria-review-toggle
        className={styles.reviewToggle}
        style={learnerChrome ? { right: 10, bottom: 9, padding: "5px 8px", fontSize: 8, opacity: reviewOpen ? 1 : .28, background: reviewOpen ? "#f2e8dc" : "#172019cc", color: reviewOpen ? "#3a312a" : "#d9d3c8", border: "1px solid #ffffff18" } : undefined}
        onClick={() => setReviewOpen((open) => !open)}
      >
        {reviewOpen ? "Hide review controls" : learnerChrome ? "Duyệt" : "Review controls"}
      </button> : null}
      {reviewEnabled && reviewOpen ? <aside className={styles.reviewPanel}><strong>Review mode</strong><span>Use these only during Founder sign-off.</span><div>{modes.map((item) => <button key={item.id} className={mode === item.id ? styles.active : ""} onClick={() => selectReviewMode(item.id)}>{item.label}</button>)}</div><small>Prototype TV projects one scoped SurfaceSession. Review controls never change business truth.</small></aside> : null}
    </main>
  );
}

function SpotlightShell({ children }: { children: React.ReactNode }) {
  return <div className={styles.spotlight}><div className={styles.spotlightGlow} />{children}</div>;
}

function Artifact({ label, muted = false }: { label: string; muted?: boolean }) {
  return <div className={`${styles.artifact} ${muted ? styles.artifactMuted : ""}`}><span>✦</span><strong>{label}</strong></div>;
}

function Arrival({ subject, catalog }: { subject: TVSubject; catalog: readonly ShopCatalogItem[] }) {
  return <ArrivalScene subject={subject} catalog={catalog} />;
}

function Ritual({ subject }: { subject: TVSubject }) {
  const companion = companionView(subject);
  const companionMeta = companion.active
    ? [companion.species, companion.level ? `Cấp ${companion.level}` : ""].filter(Boolean).join(" · ")
    : "Chưa kích hoạt";
  return <SpotlightShell><div className={styles.ritualLayout}><div className={styles.ritualIngredients}><Artifact label="Trạng thái hiện tại" /><Artifact label="Đã được ghi nhận" /></div><div className={styles.ritualCenter}><div className={styles.rings}><i /><i /><i /></div><div className={styles.companionHero}>{companion.active ? <div className={styles.companionVisual}><PrototypeCompanion displayName={companion.displayName} visualId={companion.visualId ?? undefined} size="100%" /></div> : null}<strong>{companion.active ? companion.displayName : "Chưa có Hộ Linh"}</strong><small>{companionMeta}</small></div><h1>{companion.active ? `${companion.displayName} đang đồng hành cùng ${subject.name}` : `${subject.name} chưa có Hộ Linh`}</h1><p>Pinoria hiển thị đúng trạng thái Hộ Linh đã được ghi nhận.</p></div><div className={styles.ritualResult}><span className={styles.kicker}>HÌNH THÁI HIỆN TẠI</span><strong>{companion.active ? companion.formLabel || companionMeta : "Chưa kích hoạt"}</strong><small>Projection chỉ đọc · Không tự tiến hoá</small></div></div></SpotlightShell>;
}

function Departure({ subject, catalog }: { subject: TVSubject; catalog: readonly ShopCatalogItem[] }) {
  return <DepartureScene subject={subject} catalog={catalog} />;
}
