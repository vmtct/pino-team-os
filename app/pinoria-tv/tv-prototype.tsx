"use client";

import { useEffect, useRef, useState } from "react";
import { ArrivalScene } from "./arrival-scene";
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

  const learnerChrome = mode === "choice" || mode === "arrival";

  return (
    <main className={styles.screen}>
      <div
        className={styles.prototypeTag}
        style={learnerChrome ? { top: 14, left: 18, padding: "4px 7px", fontSize: 8, letterSpacing: ".1em", opacity: .32, background: "#161a15aa" } : undefined}
      >
        {replayLabel ?? "TV PROTOTYPE · CORE RELAY SIMULATION · RECEPTION_TV"}
      </div>
      {mode === "ambient" ? <Ambient /> : null}
      {mode === "arrival" ? <Arrival subject={subject} /> : null}
      {mode === "choice" ? <Choice subject={subject} /> : null}
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

function Ambient() {
  return <div className={styles.ambient}><div className={styles.skyGlow} /><header className={styles.worldHeader}><div><span>PINORIA · TERRAVIA</span><strong>Lantern Festival</strong></div><div className={styles.worldState}>Ancient Tree · Awakening</div></header><div className={styles.house}><Room title="Reception" className={styles.reception}><Mini name="Bơ" companion="Bùm" /><Door /></Room><Room title="Common" className={styles.common}><Mini name="Lan" /></Room><Room title="Art Room" className={styles.art}><Mini name="An" companion="Mây" /><Mini name="Bơ" companion="Bùm" /><Prop text="Lanterns" /></Room><Room title="Piano Room" className={styles.piano}><Mini name="Trí" companion="Miso" /><Prop text="Music glow" /></Room><Room title="Little Piner" className={styles.lp}><Mini name="An" companion="Mây" /><Prop text="PINA ribbons" /></Room><div className={styles.tree}><span>♧</span><strong>Ancient Tree</strong></div><div className={styles.vines}>Terravia vines</div></div><div className={styles.ambientBubble}>“Hình như cây kia vừa sáng thêm một chút...”</div></div>;
}

function Room({ title, className, children }: { title: string; className: string; children: React.ReactNode }) {
  return <section className={`${styles.room} ${className}`}><h2>{title}</h2>{children}</section>;
}

function Mini({ name, companion }: { name: string; companion?: string }) {
  return <div className={styles.miniWrap}><div className={styles.mini}>{name.slice(0,1)}</div><strong>{name}</strong>{companion ? <div className={styles.pet}><span>{companion.slice(0,1)}</span>{companion}</div> : null}</div>;
}

function Door() { return <div className={styles.door}>EXIT</div>; }
function Prop({ text }: { text: string }) { return <div className={styles.prop}>{text}</div>; }

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

function Choice({ subject }: { subject: TVSubject }) {
  return (
    <SpotlightShell>
      <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", padding: "64px clamp(52px,6.4vw,92px) 70px", display: "grid", gridTemplateRows: "auto minmax(0,1fr)", gap: 15, overflow: "hidden" }}>
        <header style={{ width: "100%", maxWidth: 1040, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: ".18em", fontWeight: 900, color: "#e7c77a" }}>CHỌN NHANH</span>
            <div aria-label="Còn 8 giây" style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 9px", borderRadius: 999, background: "#f2e3ba18", border: "1px solid #f2e3ba44", color: "#f3dfaa", boxShadow: "inset 0 1px 0 #ffffff10" }}>
              <strong style={{ fontSize: 13, lineHeight: 1 }}>8</strong><span style={{ fontSize: 8, fontWeight: 900, letterSpacing: ".08em" }}>GIÂY</span>
              <span style={{ width: 34, height: 3, borderRadius: 999, background: "#ffffff18", overflow: "hidden" }}><i style={{ display: "block", width: "72%", height: "100%", borderRadius: 999, background: "#e3c97f" }} /></span>
            </div>
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: "clamp(38px,4.1vw,54px)", lineHeight: .98, letterSpacing: "-.045em", color: "#fff" }}>{subject.name} muốn mang gì theo hôm nay?</h1>
          <p style={{ margin: 0, fontSize: "clamp(14px,1.28vw,17px)", lineHeight: 1.35, color: "#ddd9d0" }}>Nói số 1 đến 6 để thầy cô chọn giúp con.</p>
        </header>

        <div style={{ minHeight: 0, width: "100%", maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateRows: "1fr 1fr", gap: 13 }}>
          <ChoiceGroup title="Túi đồ · đã sở hữu" meta="A1–A3">
            <ChoiceCard code="A1" title="Mũ Lá" meta="Đang trang bị" icon="⌁" kind="owned" />
            <ChoiceCard code="A2" title="Huy hiệu Rêu" meta="Đã sở hữu" icon="✦" kind="owned" />
            <ChoiceCard code="A3" title="Giữ hiện tại" meta="Không đổi trang phục" icon="●" kind="current" />
          </ChoiceGroup>
          <ChoiceGroup title="Cửa hàng · gợi ý hôm nay" meta={`${subject.pls} PLS`}>
            <ChoiceCard code="B1" title="Huy hiệu Lá Terravia" meta="180 PLS" icon="◇" kind="shop" />
            <ChoiceCard code="B2" title="Túi Rêu" meta="360 PLS" icon="▣" kind="shop" hero />
            <ChoiceCard code="B3" title="Áo choàng Đèn Lồng" meta="520 PLS" icon="△" kind="shop" />
          </ChoiceGroup>
        </div>
      </div>
    </SpotlightShell>
  );
}

function ChoiceGroup({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  return (
    <section style={{ minHeight: 0, display: "grid", gridTemplateRows: "auto minmax(0,1fr)", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "0 3px" }}>
        <strong style={{ fontSize: 10, letterSpacing: ".14em", color: "#f0d18a", textTransform: "uppercase" }}>{title}</strong>
        <span style={{ fontSize: 10, color: "#aeb7aa", letterSpacing: ".04em" }}>{meta}</span>
      </div>
      <div style={{ minHeight: 0, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>{children}</div>
    </section>
  );
}

function ChoiceCard({ code, title, meta, icon, kind, hero = false }: { code: string; title: string; meta: string; icon: string; kind: "owned" | "shop" | "current"; hero?: boolean }) {
  const isShop = kind === "shop";
  const background = hero
    ? "radial-gradient(circle at 36% 38%,#e2cb7c32,transparent 44%),linear-gradient(145deg,#d8bd7228,#ffffff0b)"
    : isShop
      ? "radial-gradient(circle at 36% 38%,#d8bd721c,transparent 45%),linear-gradient(145deg,#ffffff0c,#ffffff07)"
      : "radial-gradient(circle at 36% 38%,#ffffff12,transparent 44%),linear-gradient(145deg,#ffffff0d,#ffffff07)";
  const borderColor = hero ? "#e6d28a88" : isShop ? "#dfca8550" : "#ffffff20";
  const objectBackground = hero ? "radial-gradient(circle,#f0d58b33,#a18f5630 58%,#1f291d88 100%)" : "radial-gradient(circle,#ffffff12,#1f291d88 75%)";
  return (
    <div style={{ position: "relative", minWidth: 0, minHeight: 0, borderRadius: 18, background, border: `1px solid ${borderColor}`, display: "grid", gridTemplateColumns: "42px 66px minmax(0,1fr)", gap: 12, alignItems: "center", padding: "13px 15px", boxSizing: "border-box", boxShadow: hero ? "0 0 28px #d8bd7216,inset 0 1px 0 #ffffff12" : "inset 0 1px 0 #ffffff08" }}>
      <b style={{ width: 38, height: 38, borderRadius: 11, background: "#1c271b", color: "#f5df9f", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 900, boxShadow: "inset 0 0 0 1px #ffffff08" }}>{code}</b>
      <div style={{ width: 62, height: 62, borderRadius: 20, background: objectBackground, border: "1px solid #f1d99428", display: "grid", placeItems: "center", boxShadow: hero ? "0 0 22px #e0c47420,inset 0 1px 0 #ffffff0f" : "inset 0 1px 0 #ffffff0d" }}>
        <span style={{ color: "#eccb78", fontSize: kind === "current" ? 27 : 38, lineHeight: 1, textShadow: "0 4px 14px #0005" }}>{icon}</span>
      </div>
      <div style={{ minWidth: 0, display: "grid", gap: 8, alignContent: "center", paddingRight: hero ? 42 : 0 }}>
        <strong style={{ fontSize: 16, lineHeight: 1.15, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</strong>
        <span style={{ width: "max-content", maxWidth: "100%", padding: "4px 7px", borderRadius: 999, background: isShop ? "#e4c97714" : "#ffffff0b", color: isShop ? "#efd793" : "#cbd2c6", fontSize: 9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</span>
      </div>
      {hero ? <span style={{ position: "absolute", right: 12, top: 10, padding: "4px 7px", borderRadius: 999, background: "#e8cf83", color: "#263023", fontSize: 7, fontWeight: 900, letterSpacing: ".1em" }}>GỢI Ý</span> : null}
    </div>
  );
}

function Ritual() {
  return <SpotlightShell><div className={styles.ritualLayout}><div className={styles.ritualIngredients}><Artifact label="Fruit ×5" /><Artifact label="Water Sigil" /></div><div className={styles.ritualCenter}><div className={styles.rings}><i /><i /><i /></div><div className={styles.companionHero}><span>B</span><strong>Bùm</strong><small>Ploo · Lv2 → Lv3</small></div><h1>Bùm đang hiện hình rõ hơn</h1><p>Canonical stage change has already been committed. This is presentation only.</p></div><div className={styles.ritualResult}><span className={styles.kicker}>NEW FORM</span><strong>Manifested III</strong><small>Replay shows the same outcome. No reroll.</small></div></div></SpotlightShell>;
}

function Departure({ subject }: { subject: TVSubject }) {
  const companion = splitCompanion(subject.companion);
  return <SpotlightShell><div className={styles.departureLayout}><div><span className={styles.kicker}>TODAY IN PINORIA</span><h1>{subject.name} đã có một ngày thật dài ✦</h1><p>{companion.name !== "—" ? `${companion.name} cùng ${subject.name} đã hoàn thành một buổi ở Nhà PINO.` : `${subject.name} đã hoàn thành một buổi ở Nhà PINO.`}</p><div className={styles.changeList}><span>Companion</span><strong>{subject.companion}</strong><span>Journey</span><strong>{subject.path}</strong><span>Room</span><strong>{subject.room}</strong></div></div><Character subject={subject} /><div className={styles.departureHero}><Artifact label="Water Drop II" /><span>FEATURED DEPARTURE MOMENT</span></div></div><div className={styles.exitLine}>{subject.name}{companion.name !== "—" ? ` + ${companion.name}` : ""} → Reception → Exit</div></SpotlightShell>;
}

function News({ subject }: { subject: TVSubject }) {
  return <div className={styles.news}><div className={styles.newsBackdrop} /><div className={styles.newsCard}><span className={styles.kicker}>WORLD NEWS · DISCOVERY</span><div className={styles.newsHero}>✦</div><h1>Một hình thái mới vừa xuất hiện</h1><p>{subject.name} đã khám phá <strong>Water Drop II</strong>.</p><div className={styles.discoveryLine}><div><span>I</span><small>known</small></div><div className={styles.discovered}><span>II</span><small>discovered</small></div><div><span>III</span><small>rumored</small></div><div className={styles.hidden}><span>?</span><small>unknown</small></div></div><footer>Người ta nói Dây Chuyền Giọt Nước có bốn hình thái...</footer></div></div>;
}
