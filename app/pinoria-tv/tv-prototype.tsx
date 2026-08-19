"use client";

import { useState } from "react";
import styles from "./tv.module.css";

type Mode = "ambient" | "arrival" | "choice" | "ritual" | "departure" | "news";

const modes: { id: Mode; label: string }[] = [
  { id: "ambient", label: "Ambient" },
  { id: "arrival", label: "Arrival" },
  { id: "choice", label: "Quick Choice" },
  { id: "ritual", label: "Companion Ritual" },
  { id: "departure", label: "Departure" },
  { id: "news", label: "World News" },
];

export function PinoriaTVPrototype() {
  const [mode, setMode] = useState<Mode>("ambient");
  const [reviewOpen, setReviewOpen] = useState(true);

  return (
    <main className={styles.screen}>
      <div className={styles.prototypeTag}>TV PROTOTYPE · MOCK DATA · EXTENDED DISPLAY REVIEW</div>
      {mode === "ambient" ? <Ambient /> : null}
      {mode === "arrival" ? <Arrival /> : null}
      {mode === "choice" ? <Choice /> : null}
      {mode === "ritual" ? <Ritual /> : null}
      {mode === "departure" ? <Departure /> : null}
      {mode === "news" ? <News /> : null}

      <button className={styles.reviewToggle} onClick={() => setReviewOpen((open) => !open)}>{reviewOpen ? "Hide review controls" : "Review controls"}</button>
      {reviewOpen ? <aside className={styles.reviewPanel}><strong>Review mode</strong><span>Use these only during Founder sign-off.</span><div>{modes.map((item) => <button key={item.id} className={mode === item.id ? styles.active : ""} onClick={() => setMode(item.id)}>{item.label}</button>)}</div><small>Production TV would receive events from Core and never expose these controls.</small></aside> : null}
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

function Character({ compact = false }: { compact?: boolean }) {
  return <div className={`${styles.character} ${compact ? styles.characterCompact : ""}`}><div className={styles.hat}>⌁</div><div className={styles.face}>BƠ</div><div className={styles.bodyMark}>P</div><div className={styles.companionFull}><span>B</span><small>Bùm · Ploo II</small></div></div>;
}

function Artifact({ label, muted = false }: { label: string; muted?: boolean }) {
  return <div className={`${styles.artifact} ${muted ? styles.artifactMuted : ""}`}><span>✦</span><strong>{label}</strong></div>;
}

function Arrival() {
  return <SpotlightShell><div className={styles.arrivalLayout}><div><span className={styles.kicker}>BƠ HAS ARRIVED</span><h1>Chào Bơ ✦</h1><p>“Hôm nay Bùm đi cùng mình!”</p><div className={styles.identityMeta}><span>Forest Maker</span><span>420 PLS</span><span>Fruit ×2</span></div></div><Character /><div className={styles.showcase}><span className={styles.kicker}>SHOWCASE</span><Artifact label="Water Drop II" /><Artifact label="Journey Seal II" /><Artifact label="PINA Bow" /><Artifact label="Empty" muted /></div></div><div className={styles.arrivalFooter}>Full character + active companion + selected achievements. Cosmetics render on character; showcase artifacts float beside it.</div></SpotlightShell>;
}

function Choice() {
  return <SpotlightShell><div className={styles.choiceHead}><span className={styles.kicker}>QUICK CHOICE · 8 SEC</span><h1>Hôm nay con muốn mang gì theo?</h1><p>Con chọn mã A/B rồi nói với cô chú. TV không cần chạm.</p></div><div className={styles.choiceGrid}><ChoiceCard code="A1" title="Leaf Cap" meta="Owned · Equip" icon="⌁" /><ChoiceCard code="A2" title="Moss Pin" meta="Owned · Equip" icon="✦" /><ChoiceCard code="A3" title="Keep current" meta="Owned" icon="●" /><ChoiceCard code="B1" title="Terravia Leaf Pin" meta="180 PLS" icon="◇" /><ChoiceCard code="B2" title="Moss Satchel" meta="360 PLS" icon="▣" hero /><ChoiceCard code="B3" title="Lantern Cape" meta="520 PLS" icon="△" /></div><div className={styles.countdown}>8</div></SpotlightShell>;
}

function ChoiceCard({ code, title, meta, icon, hero = false }: { code: string; title: string; meta: string; icon: string; hero?: boolean }) {
  return <div className={`${styles.choiceCard} ${hero ? styles.choiceHero : ""}`}><b>{code}</b><span className={styles.choiceIcon}>{icon}</span><strong>{title}</strong><small>{meta}</small></div>;
}

function Ritual() {
  return <SpotlightShell><div className={styles.ritualLayout}><div className={styles.ritualIngredients}><Artifact label="Fruit ×5" /><Artifact label="Water Sigil" /></div><div className={styles.ritualCenter}><div className={styles.rings}><i /><i /><i /></div><div className={styles.companionHero}><span>B</span><strong>Bùm</strong><small>Ploo · Lv2 → Lv3</small></div><h1>Bùm đang hiện hình rõ hơn</h1><p>Canonical stage change has already been committed. This is presentation only.</p></div><div className={styles.ritualResult}><span className={styles.kicker}>NEW FORM</span><strong>Manifested III</strong><small>Replay shows the same outcome. No reroll.</small></div></div></SpotlightShell>;
}

function Departure() {
  return <SpotlightShell><div className={styles.departureLayout}><div><span className={styles.kicker}>TODAY IN PINORIA</span><h1>Bơ đã có một ngày thật dài ✦</h1><p>Bùm đã hiện hình ở dạng mới, và một báu vật mới đã xuất hiện.</p><div className={styles.changeList}><span>Companion</span><strong>Bùm · Ploo III</strong><span>New Artifact</span><strong>Water Drop II</strong><span>Active look</span><strong>Mushroom Hat + Moss Satchel</strong></div></div><Character /><div className={styles.departureHero}><Artifact label="Water Drop II" /><span>NEW ARTIFACT</span></div></div><div className={styles.exitLine}>Bơ + Bùm → Reception → Exit</div></SpotlightShell>;
}

function News() {
  return <div className={styles.news}><div className={styles.newsBackdrop} /><div className={styles.newsCard}><span className={styles.kicker}>WORLD NEWS · DISCOVERY</span><div className={styles.newsHero}>✦</div><h1>Một hình thái mới vừa xuất hiện</h1><p>Bơ đã khám phá <strong>Water Drop II</strong>.</p><div className={styles.discoveryLine}><div><span>I</span><small>known</small></div><div className={styles.discovered}><span>II</span><small>discovered</small></div><div><span>III</span><small>rumored</small></div><div className={styles.hidden}><span>?</span><small>unknown</small></div></div><footer>Người ta nói Dây Chuyền Giọt Nước có bốn hình thái...</footer></div></div>;
}
