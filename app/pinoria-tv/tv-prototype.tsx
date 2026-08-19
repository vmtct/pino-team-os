"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./tv.module.css";
import choiceStyles from "./choice-polish.module.css";

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

const SURFACE_ID = "RECEPTION_TV";
const RELAY_URL = "/api/pinoria-prototype/tv-relay";

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
  const lastHandledEvent = useRef<number | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    let stopped = false;

    async function post(body: Record<string, unknown>) {
      try {
        await fetch(RELAY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        });
      } catch {
        // The TV remains a disposable presentation client when the mock relay is unavailable.
      }
    }

    async function heartbeat() {
      await post({ op: "heartbeat", surfaceId: SURFACE_ID, mode: modeRef.current });
    }

    async function ack(id: number) {
      await post({ op: "ack", surfaceId: SURFACE_ID, id });
    }

    function playEvent(event: RelayEvent) {
      if (event.kind === "control") {
        if (sequenceTimer.current) window.clearTimeout(sequenceTimer.current);
        setReplayLabel(null);
        setMode("ambient");
        return;
      }

      if (!event.subject || !event.mode) return;
      if (sequenceTimer.current) window.clearTimeout(sequenceTimer.current);
      setSubject(event.subject);
      setMode(event.mode);
      setReplayLabel(event.replay ? `PHÁT LẠI · ${event.mode === "arrival" ? "CHÀO ĐẾN" : "CHÀO VỀ"}` : null);

      if (event.mode === "arrival" && !event.replay) {
        sequenceTimer.current = window.setTimeout(() => {
          setMode("choice");
          setReplayLabel(null);
        }, 6500);
      }
    }

    async function poll() {
      try {
        const response = await fetch(`${RELAY_URL}?surfaceId=${SURFACE_ID}&includeEvent=1`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { event?: RelayEvent | null };
        const event = data.event;
        if (!event || event.id === lastHandledEvent.current) return;
        lastHandledEvent.current = event.id;
        await ack(event.id);
        if (!stopped) playEvent(event);
      } catch {
        // Keep the current scene if the relay is temporarily unavailable.
      }
    }

    void heartbeat();
    void poll();
    const heartbeatTimer = window.setInterval(() => { void heartbeat(); }, 2000);
    const pollTimer = window.setInterval(() => { void poll(); }, 900);

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
    setReplayLabel(null);
    setMode(next);
  }

  return (
    <main className={styles.screen}>
      <div className={styles.prototypeTag}>{replayLabel ?? "TV PROTOTYPE · CORE RELAY SIMULATION · RECEPTION_TV"}</div>
      {mode === "ambient" ? <Ambient /> : null}
      {mode === "arrival" ? <Arrival subject={subject} /> : null}
      {mode === "choice" ? <Choice subject={subject} /> : null}
      {mode === "ritual" ? <Ritual /> : null}
      {mode === "departure" ? <Departure subject={subject} /> : null}
      {mode === "news" ? <News subject={subject} /> : null}

      <button className={styles.reviewToggle} onClick={() => setReviewOpen((open) => !open)}>{reviewOpen ? "Hide review controls" : "Review controls"}</button>
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
  const companion = splitCompanion(subject.companion);
  return <SpotlightShell><div className={styles.arrivalLayout}><div><span className={styles.kicker}>{subject.name.toUpperCase()} HAS ARRIVED</span><h1>Chào {subject.name} ✦</h1><p>{companion.name !== "—" ? `“Hôm nay ${companion.name} đi cùng mình!”` : "“Một buổi học mới bắt đầu rồi!”"}</p><div className={styles.identityMeta}><span>{subject.path}</span><span>{subject.pls} PLS</span><span>Fruit ×{subject.fruit}</span></div></div><Character subject={subject} /><div className={styles.showcase}><span className={styles.kicker}>SHOWCASE</span><Artifact label="Water Drop II" /><Artifact label="Journey Seal II" /><Artifact label="PINA Bow" /><Artifact label="Empty" muted /></div></div><div className={styles.arrivalFooter}>Full character + active companion + selected achievements. Cosmetics render on character; showcase artifacts float beside it.</div></SpotlightShell>;
}

function Choice({ subject }: { subject: TVSubject }) {
  return (
    <SpotlightShell>
      <div className={choiceStyles.scene}>
        <header className={choiceStyles.header}>
          <span className={choiceStyles.kicker}>CHỌN NHANH · TÚI ĐỒ & CỬA HÀNG</span>
          <h1>{subject.name} muốn mang gì theo hôm nay?</h1>
          <p>Nói mã A1, A2, A3 hoặc B1, B2, B3 để cô chú chọn giúp con.</p>
          <div className={choiceStyles.timer} aria-label="Còn 8 giây">
            <div className={choiceStyles.timerTop}><span>Còn</span><strong>8</strong><span>giây</span></div>
            <div className={choiceStyles.timerTrack}><i /></div>
          </div>
        </header>

        <div className={choiceStyles.board}>
          <section className={choiceStyles.group}>
            <div className={choiceStyles.groupHead}><strong>Túi đồ · đã sở hữu</strong><span>Chọn món muốn mang theo</span></div>
            <div className={choiceStyles.cards}>
              <ChoiceCard code="A1" title="Mũ Lá" meta="Đang trang bị" icon="⌁" kind="owned" />
              <ChoiceCard code="A2" title="Huy hiệu Rêu" meta="Đã sở hữu" icon="✦" kind="owned" />
              <ChoiceCard code="A3" title="Giữ hiện tại" meta="Không đổi trang phục" icon="●" kind="current" />
            </div>
          </section>

          <section className={choiceStyles.group}>
            <div className={choiceStyles.groupHead}><strong>Cửa hàng · gợi ý hôm nay</strong><span>{subject.pls} PLS hiện có</span></div>
            <div className={choiceStyles.cards}>
              <ChoiceCard code="B1" title="Huy hiệu Lá Terravia" meta="180 PLS" icon="◇" kind="shop" />
              <ChoiceCard code="B2" title="Túi Rêu" meta="360 PLS" icon="▣" kind="shop" hero />
              <ChoiceCard code="B3" title="Áo choàng Đèn Lồng" meta="520 PLS" icon="△" kind="shop" />
            </div>
          </section>
        </div>
      </div>
    </SpotlightShell>
  );
}

function ChoiceCard({ code, title, meta, icon, kind, hero = false }: { code: string; title: string; meta: string; icon: string; kind: "owned" | "shop" | "current"; hero?: boolean }) {
  const kindClass = kind === "shop" ? choiceStyles.cardShop : kind === "current" ? choiceStyles.current : choiceStyles.cardOwned;
  return (
    <div className={`${choiceStyles.card} ${kindClass} ${hero ? choiceStyles.cardHero : ""}`}>
      <b className={choiceStyles.code}>{code}</b>
      <div className={choiceStyles.identity}>
        <span className={choiceStyles.icon}>{icon}</span>
        <div className={choiceStyles.copy}><strong>{title}</strong><small>{kind === "shop" ? "Gợi ý từ Cửa hàng" : "Trong Túi đồ"}</small></div>
      </div>
      <div className={choiceStyles.meta}><b>{kind === "shop" ? "Giá" : "Trạng thái"}</b><span>{meta}</span></div>
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
