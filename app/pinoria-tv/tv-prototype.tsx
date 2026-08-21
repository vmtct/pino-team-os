"use client";

import { useEffect, useRef, useState } from "react";
import { AmbientHouseRuntime } from "./ambient-house-runtime";
import { ArrivalScene } from "./arrival-scene";
import { ChoiceScene } from "./choice-scene";
import { DepartureScene } from "./departure-scene";
import styles from "./tv.module.css";

type Mode = "ambient" | "arrival" | "choice" | "ritual" | "departure" | "news";
type TVSubject = {
  id: string;
  name: string;
  path: string;
  room: string;
  companion: string;
  pls: number;
  fruit: number;
};

type RelayEvent = {
  id: number;
  kind: "play" | "control";
  mode?: "arrival" | "departure";
  replay?: boolean;
  subject?: TVSubject;
  action?: "ambient";
};

type RelayMutationResponse = {
  ok?: boolean;
  event?: RelayEvent;
};

const SURFACE_ID = "RECEPTION_TV";
const RELAY_URL = "/api/pinoria-prototype/tv-relay";
const ARRIVAL_MS = 6500;
const QUICK_CHOICE_MS = 8000;
const DEPARTURE_MS = 9000;

const modes: { id: Mode; label: string }[] = [
  { id: "ambient", label: "Ambient" },
  { id: "arrival", label: "Arrival" },
  { id: "choice", label: "Quick Choice" },
  { id: "ritual", label: "Companion Ritual" },
  { id: "departure", label: "Departure" },
  { id: "news", label: "World News" },
];

const defaultSubject: TVSubject = {
  id: "bo",
  name: "Bơ",
  path: "ArtChitect · Màu nước II",
  room: "Phòng Họa",
  companion: "Bùm · Ploo · Cấp 2",
  pls: 420,
  fruit: 2,
};

export function PinoriaTVPrototype() {
  const [mode, setMode] = useState<Mode>("ambient");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [subject, setSubject] = useState<TVSubject>(defaultSubject);
  const [replayLabel, setReplayLabel] = useState<string | null>(null);
  const sequenceTimer = useRef<number | null>(null);
  const modeRef = useRef<Mode>("ambient");
  const activeEventId = useRef<number | null>(null);
  const busyRef = useRef(false);
  const pollingRef = useRef(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

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

    async function heartbeat() {
      await post({ op: "heartbeat", surfaceId: SURFACE_ID, mode: modeRef.current });
    }

    async function finishEvent(id: number) {
      if (activeEventId.current !== id) return;
      await post({ op: "complete", surfaceId: SURFACE_ID, id });
      activeEventId.current = null;
      busyRef.current = false;
      if (!stopped) {
        setReplayLabel(null);
        setMode("ambient");
      }
    }

    function playEvent(event: RelayEvent) {
      if (sequenceTimer.current) window.clearTimeout(sequenceTimer.current);

      if (event.kind === "control") {
        setReplayLabel(null);
        setMode("ambient");
        void finishEvent(event.id);
        return;
      }

      if (!event.subject || !event.mode) {
        void finishEvent(event.id);
        return;
      }

      setSubject(event.subject);
      setMode(event.mode);
      setReplayLabel(event.replay ? `PHÁT LẠI · ${event.mode === "arrival" ? "CHÀO ĐẾN" : "CHÀO VỀ"}` : null);

      if (event.mode === "arrival" && !event.replay) {
        sequenceTimer.current = window.setTimeout(() => {
          if (stopped || activeEventId.current !== event.id) return;
          setMode("choice");
          setReplayLabel(null);
          sequenceTimer.current = window.setTimeout(() => {
            void finishEvent(event.id);
          }, QUICK_CHOICE_MS);
        }, ARRIVAL_MS);
        return;
      }

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
        const data = await response.json() as { event?: RelayEvent | null };
        const event = data.event;
        if (!event) return;

        const claimed = await post({ op: "claim", surfaceId: SURFACE_ID, id: event.id });
        if (!claimed?.ok) return;
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
      if (sequenceTimer.current) window.clearTimeout(sequenceTimer.current);
    };
  }, []);

  useEffect(() => {
    void fetch(RELAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "heartbeat", surfaceId: SURFACE_ID, mode }),
      cache: "no-store",
    }).catch(() => undefined);
  }, [mode]);

  function selectReviewMode(next: Mode) {
    if (sequenceTimer.current) window.clearTimeout(sequenceTimer.current);
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
    setMode(next);
  }

  const learnerChrome = mode === "choice" || mode === "arrival" || mode === "departure";

  return (
    <main className={styles.screen}>
      <div
        className={styles.prototypeTag}
        style={learnerChrome ? { top: 14, left: 18, padding: "4px 7px", fontSize: 8, letterSpacing: ".1em", opacity: .32, background: "#161a15aa" } : undefined}
      >
        {replayLabel ?? "TV PROTOTYPE · CORE RELAY SIMULATION · RECEPTION_TV"}
      </div>
      {mode === "ambient" ? <AmbientHouseRuntime subject={subject} /> : null}
      {mode === "arrival" ? <Arrival subject={subject} /> : null}
      {mode === "choice" ? <ChoiceScene subject={subject} /> : null}
      {mode === "ritual" ? <Ritual /> : null}
      {mode === "departure" ? <Departure subject={subject} /> : null}
      {mode === "news" ? <News subject={subject} /> : null}

      <button
        className={styles.reviewToggle}
        style={learnerChrome ? { right: 10, bottom: 9, padding: "5px 8px", fontSize: 8, opacity: reviewOpen ? 1 : .28, background: reviewOpen ? "#f2e8dc" : "#172019cc", color: reviewOpen ? "#3a312a" : "#d9d3c8", border: "1px solid #ffffff18" } : undefined}
        onClick={() => setReviewOpen((open) => !open)}
      >
        {reviewOpen ? "Hide review controls" : learnerChrome ? "Duyệt" : "Review controls"}
      </button>
      {reviewOpen ? <aside className={styles.reviewPanel}><strong>Review mode</strong><span>Use these only during Founder sign-off.</span><div>{modes.map((item) => <button key={item.id} className={mode === item.id ? styles.active : ""} onClick={() => selectReviewMode(item.id)}>{item.label}</button>)}</div><small>Prototype TV polls the mock Core relay. Production TV will use a scoped surface session and cannot change business truth.</small></aside> : null}
    </main>
  );
}

function SpotlightShell({ children }: { children: React.ReactNode }) {
  return <div className={styles.spotlight}><div className={styles.spotlightGlow} />{children}</div>;
}

function splitCompanion(value: string) {
  if (!value || value.startsWith("Chưa có")) return { name: "—", detail: "Chưa có Hộ Linh" };
  const parts = value.split(" · ");
  return { name: parts[0] ?? "—", detail: parts.join(" · ") };
}

function Character({ subject, compact = false }: { subject: TVSubject; compact?: boolean }) {
  const companion = splitCompanion(subject.companion);
  return <div className={`${styles.character} ${compact ? styles.characterCompact : ""}`}><div className={styles.hat}>⌁</div><div className={styles.face}>{subject.name.toUpperCase()}</div><div className={styles.bodyMark}>P</div>{companion.name !== "—" ? <div className={styles.companionFull}><span>{companion.name.slice(0,1)}</span><small>{companion.detail}</small></div> : null}</div>;
}

function Artifact({ label, muted = false }: { label: string; muted?: boolean }) {
  return <div className={`${styles.artifact} ${muted ? styles.artifactMuted : ""}`}><span>✦</span><strong>{label}</strong></div>;
}

function Arrival({ subject }: { subject: TVSubject }) {
  return <ArrivalScene subject={subject} />;
}

function Ritual() {
  return <SpotlightShell><div className={styles.ritualLayout}><div className={styles.ritualIngredients}><Artifact label="Fruit ×5" /><Artifact label="Water Sigil" /></div><div className={styles.ritualCenter}><div className={styles.rings}><i /><i /><i /></div><div className={styles.companionHero}><span>B</span><strong>Bùm</strong><small>Ploo · Lv2 → Lv3</small></div><h1>Bùm đang hiện hình rõ hơn</h1><p>Canonical stage change has already been committed. This is presentation only.</p></div><div className={styles.ritualResult}><span className={styles.kicker}>NEW FORM</span><strong>Manifested III</strong><small>Replay shows the same outcome. No reroll.</small></div></div></SpotlightShell>;
}

function Departure({ subject }: { subject: TVSubject }) {
  return <DepartureScene subject={subject} />;
}

function News({ subject }: { subject: TVSubject }) {
  return <div className={styles.news}><div className={styles.newsBackdrop} /><div className={styles.newsCard}><span className={styles.kicker}>WORLD NEWS · DISCOVERY</span><div className={styles.newsHero}>✦</div><h1>Một hình thái mới vừa xuất hiện</h1><p>{subject.name} đã khám phá <strong>Water Drop II</strong>.</p><div className={styles.discoveryLine}><div><span>I</span><small>known</small></div><div className={styles.discovered}><span>II</span><small>discovered</small></div><div><span>III</span><small>rumored</small></div><div className={styles.hidden}><span>?</span><small>unknown</small></div></div><footer>Người ta nói Dây Chuyền Giọt Nước có bốn hình thái...</footer></div></div>;
}
