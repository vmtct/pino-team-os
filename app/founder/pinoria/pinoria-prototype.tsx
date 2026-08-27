"use client";

import { useMemo, useState, type ReactNode } from "react";
import styles from "./pinoria.module.css";

type Section =
  | "live"
  | "choices"
  | "learners"
  | "milestones"
  | "rewards"
  | "companions"
  | "shop"
  | "world"
  | "content"
  | "projections"
  | "fulfillment"
  | "tv"
  | "history";

type Learner = {
  id: string;
  name: string;
  path: string;
  room: string;
  companion: string;
  species: string;
  stage: number;
  pls: number;
  fruit: number;
  ritual: "ready" | "progress" | "none";
  choice: string | null;
  checkout: string;
  artifacts: string[];
  effects: string[];
};

const learners: Learner[] = [
  {
    id: "bo",
    name: "Bơ",
    path: "ArtChitect · Watercolor II",
    room: "Art Room",
    companion: "Bùm",
    species: "Ploo",
    stage: 2,
    pls: 420,
    fruit: 2,
    ritual: "ready",
    choice: "B2 · Moss Satchel",
    checkout: "19:30",
    artifacts: ["Water Drop II", "Journey Seal II", "PINA Bow"],
    effects: ["Mushroom Glow · session"],
  },
  {
    id: "tri",
    name: "Trí",
    path: "PianoHouse · Foundation Record I",
    room: "Piano Room",
    companion: "Miso",
    species: "Mori",
    stage: 3,
    pls: 760,
    fruit: 1,
    ritual: "progress",
    choice: null,
    checkout: "20:00",
    artifacts: ["Foundation Record I", "Journey Seal III", "Terravia Memory"],
    effects: [],
  },
  {
    id: "an",
    name: "An",
    path: "Little Piner Art · Forest Theme",
    room: "LP Room",
    companion: "Mây",
    species: "Vayu",
    stage: 1,
    pls: 180,
    fruit: 3,
    ritual: "progress",
    choice: "A1 · Leaf Cap",
    checkout: "18:45",
    artifacts: ["PINA Bow I"],
    effects: ["Lantern Spark · session"],
  },
  {
    id: "lan",
    name: "Lan",
    path: "Open Studio · Piano",
    room: "Common",
    companion: "—",
    species: "—",
    stage: 0,
    pls: 40,
    fruit: 0,
    ritual: "none",
    choice: null,
    checkout: "18:30",
    artifacts: [],
    effects: [],
  },
];

const sections: { group: string; items: { id: Section; label: string; note?: string }[] }[] = [
  {
    group: "PINORIA OPS",
    items: [
      { id: "live", label: "Live House" },
      { id: "choices", label: "Pending Choices", note: "2" },
      { id: "learners", label: "Learners" },
      { id: "fulfillment", label: "Physical Fulfillment", note: "3" },
      { id: "tv", label: "TV" },
    ],
  },
  {
    group: "PINORIA STUDIO",
    items: [
      { id: "milestones", label: "Milestones & Journeys" },
      { id: "rewards", label: "Rewards" },
      { id: "companions", label: "Companion System" },
      { id: "shop", label: "Shop & Inventory" },
      { id: "world", label: "World & Campaigns" },
      { id: "content", label: "Content Library", note: "5" },
      { id: "projections", label: "Projection Policies" },
    ],
  },
  { group: "REVIEW", items: [{ id: "history", label: "History & Diagnostics" }] },
];

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "accent" | "danger" }) {
  return <span className={`${styles.badge} ${styles[`badge_${tone}`]}`}>{children}</span>;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`${styles.card} ${className}`}>{children}</section>;
}

function SectionHead({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: ReactNode }) {
  return (
    <div className={styles.sectionHead}>
      <div>
        <div className={styles.eyebrow}>{eyebrow}</div>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {action ? <div className={styles.sectionActions}>{action}</div> : null}
    </div>
  );
}

export function PinoriaPrototype() {
  const [section, setSection] = useState<Section>("live");
  const [selectedLearner, setSelectedLearner] = useState("bo");
  const [choiceResolved, setChoiceResolved] = useState<Record<string, boolean>>({});
  const [fruitByLearner, setFruitByLearner] = useState<Record<string, number>>(
    Object.fromEntries(learners.map((learner) => [learner.id, learner.fruit])),
  );
  const [ritualPlayed, setRitualPlayed] = useState<Record<string, boolean>>({});
  const [campaignProgress, setCampaignProgress] = useState(67);
  const [rotationDays, setRotationDays] = useState(14);
  const [rotationSnooze, setRotationSnooze] = useState(7);
  const [toast, setToast] = useState("Prototype ready · all interactions are local-only");
  const [journeyBuilder, setJourneyBuilder] = useState(false);
  const [contentPreview, setContentPreview] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState("Water Drop IV");

  const learner = useMemo(() => learners.find((item) => item.id === selectedLearner) ?? learners[0], [selectedLearner]);

  function notify(message: string) {
    setToast(message);
  }

  function feed(id: string) {
    setFruitByLearner((current) => {
      const next = Math.max(0, (current[id] ?? 0) - 1);
      return { ...current, [id]: next };
    });
    notify("Mock: Feed Companion recorded. No Core write was performed.");
  }

  function resolveChoice(id: string) {
    setChoiceResolved((current) => ({ ...current, [id]: true }));
    notify("Mock: choice resolved as Purchase & Equip.");
  }

  function playRitual(id: string) {
    setRitualPlayed((current) => ({ ...current, [id]: true }));
    notify("Mock: canonical stage change + TV reveal simulated locally.");
  }

  function openTv() {
    const tv = window.open("/pinoria-tv", "pinoria-tv", "popup=yes,width=1440,height=900");
    tv?.focus();
    notify("Pinoria TV prototype opened in a separate window. Move it to the extended display and fullscreen it.");
  }

  return (
    <div className={styles.prototypeShell}>
      <div className={styles.prototypeBanner}>
        <strong>PINORIA UI PROTOTYPE</strong>
        <span>Mock data · interaction-only · no Core / Notion writes · not implementation authority</span>
      </div>

      <div className={styles.workspace}>
        <aside className={styles.pinoriaNav}>
          <div className={styles.pinoriaBrand}>
            <div className={styles.orb}>P</div>
            <div>
              <strong>Pinoria</strong>
              <span>Ops + Studio prototype</span>
            </div>
          </div>
          {sections.map((group) => (
            <div className={styles.navGroup} key={group.group}>
              <div className={styles.navLabel}>{group.group}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`${styles.navButton} ${section === item.id ? styles.navButtonActive : ""}`}
                  onClick={() => setSection(item.id)}
                >
                  <span>{item.label}</span>
                  {item.note ? <em>{item.note}</em> : null}
                </button>
              ))}
            </div>
          ))}
          <div className={styles.navFooter}>
            <span>Terravia · Autumn 2026</span>
            <button onClick={openTv}>↗ Open Pinoria TV</button>
          </div>
        </aside>

        <main className={styles.main}>
          <div className={styles.toast}>{toast}</div>
          {section === "live" ? <LiveHouse fruitByLearner={fruitByLearner} choiceResolved={choiceResolved} ritualPlayed={ritualPlayed} onFeed={feed} onResolve={resolveChoice} onRitual={playRitual} onSelect={(id) => { setSelectedLearner(id); setSection("learners"); }} onTv={openTv} /> : null}
          {section === "choices" ? <PendingChoices choiceResolved={choiceResolved} onResolve={resolveChoice} /> : null}
          {section === "learners" ? <Learners learner={learner} fruit={fruitByLearner[learner.id] ?? learner.fruit} onPick={setSelectedLearner} onFeed={() => feed(learner.id)} onRitual={() => playRitual(learner.id)} ritualPlayed={!!ritualPlayed[learner.id]} /> : null}
          {section === "milestones" ? <Milestones onCreate={() => setJourneyBuilder(true)} /> : null}
          {section === "rewards" ? <Rewards notify={notify} /> : null}
          {section === "companions" ? <Companions rotationDays={rotationDays} rotationSnooze={rotationSnooze} setRotationDays={setRotationDays} setRotationSnooze={setRotationSnooze} notify={notify} /> : null}
          {section === "shop" ? <Shop notify={notify} /> : null}
          {section === "world" ? <World progress={campaignProgress} setProgress={setCampaignProgress} notify={notify} /> : null}
          {section === "content" ? <ContentLibrary onPreview={(name) => { setSelectedArtifact(name); setContentPreview(true); }} /> : null}
          {section === "projections" ? <ProjectionPolicies /> : null}
          {section === "fulfillment" ? <PhysicalFulfillment notify={notify} /> : null}
          {section === "tv" ? <TVOperations onOpen={openTv} notify={notify} /> : null}
          {section === "history" ? <HistoryDiagnostics /> : null}
        </main>
      </div>

      {journeyBuilder ? <JourneyBuilder onClose={() => setJourneyBuilder(false)} notify={notify} /> : null}
      {contentPreview ? <ContentPreview name={selectedArtifact} onClose={() => setContentPreview(false)} /> : null}
    </div>
  );
}

function LiveHouse({ fruitByLearner, choiceResolved, ritualPlayed, onFeed, onResolve, onRitual, onSelect, onTv }: {
  fruitByLearner: Record<string, number>;
  choiceResolved: Record<string, boolean>;
  ritualPlayed: Record<string, boolean>;
  onFeed: (id: string) => void;
  onResolve: (id: string) => void;
  onRitual: (id: string) => void;
  onSelect: (id: string) => void;
  onTv: () => void;
}) {
  return (
    <>
      <SectionHead eyebrow="PINORIA OPS" title="Live House" copy="Presence-first workspace: who is here, what matters before checkout, and what staff can safely do now." action={<button className={styles.primary} onClick={onTv}>Open Pinoria TV ↗</button>} />
      <div className={styles.metricGrid}>
        <Metric label="Present now" value="4" note="3 rooms + common" />
        <Metric label="Needs attention" value="3" note="2 choices · 1 ritual" tone="warn" />
        <Metric label="TV" value="Closed" note="Expected on extended display" tone="neutral" />
        <Metric label="World" value="67%" note="Lantern Festival · Active" tone="good" />
      </div>
      <div className={styles.liveGrid}>
        <Card className={styles.houseCard}>
          <div className={styles.cardHead}>
            <div><span className={styles.kicker}>HOUSE MAP</span><h2>PINO House · live presence</h2></div>
            <Badge tone="good">Ambient ready</Badge>
          </div>
          <div className={styles.houseMap}>
            <Room name="Reception" people={["Bơ"]} />
            <Room name="Common" people={["Lan"]} />
            <Room name="Art Room" people={["Bơ", "An"]} accent />
            <Room name="Piano Room" people={["Trí"]} />
            <Room name="LP Room" people={["An"]} />
            <div className={styles.worldOverlay}>Terravia vines · Lantern layer 02</div>
          </div>
        </Card>
        <Card>
          <div className={styles.cardHead}><div><span className={styles.kicker}>ATTENTION</span><h2>Before checkout</h2></div><Badge tone="warn">3 items</Badge></div>
          <div className={styles.attentionList}>
            <Attention label="An · checkout 18:45" title="A1 Leaf Cap waiting" action="Resolve" />
            <Attention label="Bơ · checkout 19:30" title="B2 Moss Satchel waiting" action="Resolve" />
            <Attention label="Bơ" title="Bùm ready for materialization" action="Ritual" />
          </div>
        </Card>
      </div>
      <div className={styles.learnerGrid}>
        {learners.map((item) => {
          const choicePending = item.choice && !choiceResolved[item.id];
          const ritualReady = item.ritual === "ready" && !ritualPlayed[item.id];
          return (
            <Card key={item.id} className={styles.learnerCard}>
              <button className={styles.learnerOpen} onClick={() => onSelect(item.id)} aria-label={`Open ${item.name}`}>↗</button>
              <div className={styles.avatar}>{item.name.slice(0, 1)}</div>
              <div className={styles.learnerTitle}><div><h3>{item.name}</h3><p>{item.path}</p></div><Badge tone="good">Present</Badge></div>
              <div className={styles.detailRows}>
                <Detail label="Room" value={item.room} />
                <Detail label="Companion" value={item.stage ? `${item.companion} · ${item.species} III`.replace("III", `Lv${item.stage}`) : "Not yet"} />
                <Detail label="Resources" value={`${item.pls} PLS · ${fruitByLearner[item.id] ?? item.fruit} Fruit`} />
                <Detail label="Checkout" value={item.checkout} />
              </div>
              <div className={styles.actionStack}>
                {choicePending ? <button className={styles.primary} onClick={() => onResolve(item.id)}>Resolve {item.choice}</button> : null}
                {ritualReady ? <button className={styles.secondary} onClick={() => onRitual(item.id)}>Begin companion ritual</button> : null}
                {item.stage && (fruitByLearner[item.id] ?? 0) > 0 ? <button className={styles.ghost} onClick={() => onFeed(item.id)}>Feed Fruit</button> : null}
                {!choicePending && !ritualReady ? <span className={styles.clearState}>No urgent Pinoria action</span> : null}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function Metric({ label, value, note, tone = "accent" }: { label: string; value: string; note: string; tone?: "accent" | "warn" | "good" | "neutral" }) {
  return <Card className={styles.metricCard}><span>{label}</span><strong className={styles[`metric_${tone}`]}>{value}</strong><small>{note}</small></Card>;
}

function Room({ name, people, accent = false }: { name: string; people: string[]; accent?: boolean }) {
  return <div className={`${styles.room} ${accent ? styles.roomAccent : ""}`}><strong>{name}</strong><div>{people.map((person) => <span key={person}>{person}</span>)}</div></div>;
}

function Attention({ label, title, action }: { label: string; title: string; action: string }) {
  return <div className={styles.attentionItem}><div><span>{label}</span><strong>{title}</strong></div><button>{action}</button></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className={styles.detail}><span>{label}</span><strong>{value}</strong></div>;
}

function PendingChoices({ choiceResolved, onResolve }: { choiceResolved: Record<string, boolean>; onResolve: (id: string) => void }) {
  const items = learners.filter((item) => item.choice);
  return (
    <>
      <SectionHead eyebrow="PINORIA OPS" title="Pending Choices" copy="Async Arrival choices sorted by checkout proximity. Choice intent never reserves PLS or stock." />
      <Card>
        <div className={styles.tableHead}><span>Learner</span><span>Choice at Arrival</span><span>Snapshot price / state</span><span>Action</span></div>
        {items.map((item) => (
          <div className={styles.tableRow} key={item.id}>
            <div><strong>{item.name}</strong><small>Checkout {item.checkout}</small></div>
            <div><strong>{item.choice}</strong><small>{item.choice?.startsWith("A") ? "Owned Bag item" : "Shop offer"}</small></div>
            <div><strong>{item.choice?.startsWith("B") ? "360 PLS" : "Already owned"}</strong><small>Current balance {item.pls} PLS</small></div>
            <div>{choiceResolved[item.id] ? <Badge tone="good">Applied</Badge> : <button className={styles.primary} onClick={() => onResolve(item.id)}>{item.choice?.startsWith("B") ? "Purchase & Equip" : "Equip"}</button>}</div>
          </div>
        ))}
      </Card>
      <div className={styles.twoCol}>
        <Card><span className={styles.kicker}>EDGE CASE</span><h2>Insufficient PLS</h2><p className={styles.bodyCopy}>Keep Pending or Cancel. Staff cannot waive price or force a negative balance.</p><div className={styles.inlineActions}><button className={styles.secondary}>Keep Pending</button><button className={styles.ghost}>Cancel</button></div></Card>
        <Card><span className={styles.kicker}>EDGE CASE</span><h2>Already acquired elsewhere</h2><p className={styles.bodyCopy}>Do not charge twice. Offer Equip or Cancel against the frozen Arrival choice.</p><div className={styles.inlineActions}><button className={styles.secondary}>Equip</button><button className={styles.ghost}>Cancel</button></div></Card>
      </div>
    </>
  );
}

function Learners({ learner, fruit, onPick, onFeed, onRitual, ritualPlayed }: { learner: Learner; fruit: number; onPick: (id: string) => void; onFeed: () => void; onRitual: () => void; ritualPlayed: boolean }) {
  return (
    <>
      <SectionHead eyebrow="PINORIA OPS" title="Learners" copy="Instance state only. Definitions and policy editing stay in Pinoria Studio." />
      <div className={styles.learnerWorkspace}>
        <Card className={styles.learnerRail}>
          <div className={styles.kicker}>PRESENT LEARNERS</div>
          {learners.map((item) => <button key={item.id} className={`${styles.personRow} ${learner.id === item.id ? styles.personRowActive : ""}`} onClick={() => onPick(item.id)}><span className={styles.smallAvatar}>{item.name.slice(0, 1)}</span><span><strong>{item.name}</strong><small>{item.room}</small></span></button>)}
        </Card>
        <div className={styles.learnerDetail}>
          <Card className={styles.identityCard}>
            <div className={styles.heroAvatar}>{learner.name}</div>
            <div className={styles.identityCopy}><div className={styles.kicker}>PINORIA PROFILE</div><h2>{learner.name}</h2><p>{learner.path}</p><div className={styles.badgeRow}><Badge tone="good">Present</Badge><Badge>{learner.room}</Badge></div></div>
            <div className={styles.identityStats}><Detail label="PLS" value={String(learner.pls)} /><Detail label="Fruit" value={String(fruit)} /><Detail label="Showcase" value={`${learner.artifacts.length}/4`} /></div>
          </Card>
          <div className={styles.twoCol}>
            <Card>
              <div className={styles.cardHead}><div><span className={styles.kicker}>ACTIVE COMPANION</span><h2>{learner.stage ? `${learner.companion} · ${learner.species}` : "No companion yet"}</h2></div>{learner.stage ? <Badge tone="accent">Lv{learner.stage}</Badge> : null}</div>
              {learner.stage ? <><div className={styles.progressList}><Progress label="Fruit this stage" value={learner.id === "bo" ? 5 : learner.id === "tri" ? 3 : 1} max={5} /><Progress label="Water Sigil" value={learner.id === "bo" || learner.id === "tri" ? 1 : 0} max={1} /></div><div className={styles.inlineActions}><button className={styles.secondary} disabled={fruit <= 0} onClick={onFeed}>Feed Fruit</button>{learner.ritual === "ready" && !ritualPlayed ? <button className={styles.primary} onClick={onRitual}>Begin Ritual</button> : null}</div></> : <p className={styles.bodyCopy}>Starter companion choice can be surfaced when learner becomes eligible.</p>}
            </Card>
            <Card>
              <span className={styles.kicker}>SHOWCASE LOADOUT</span><h2>What {learner.name} is proud of</h2>
              <div className={styles.showcaseSlots}>{[0, 1, 2, 3].map((slot) => <div className={styles.showcaseSlot} key={slot}><span>{learner.artifacts[slot] ? "✦" : "+"}</span><strong>{learner.artifacts[slot] ?? "Empty slot"}</strong></div>)}</div>
            </Card>
          </div>
          <div className={styles.twoCol}>
            <Card><span className={styles.kicker}>SPECIAL ITEMS</span><h2>Entitlements</h2><div className={styles.chipList}><span>Hạt Năng Lượng ×2</span><span>Phép Lời Nói ×1</span><span>Mirror Ticket ×1</span></div></Card>
            <Card><span className={styles.kicker}>ACTIVE EFFECTS</span><h2>World-facing consequences</h2>{learner.effects.length ? learner.effects.map((effect) => <div className={styles.eventLine} key={effect}><Badge tone="accent">Active</Badge><strong>{effect}</strong><button className={styles.textButton}>Remove</button></div>) : <p className={styles.bodyCopy}>No active Pinoria effects.</p>}</Card>
          </div>
        </div>
      </div>
    </>
  );
}

function Progress({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return <div className={styles.progressItem}><div><span>{label}</span><strong>{value}/{max}</strong></div><div className={styles.progressTrack}><i style={{ width: `${pct}%` }} /></div></div>;
}

function Milestones({ onCreate }: { onCreate: () => void }) {
  const rows = [
    ["Open Studio Participation", "ENTRY", "MICRO", "Small experience reward", "—"],
    ["First Premium Journey", "CONVERSION", "MAJOR", "Journey Emblem I", "Premium depth begins"],
    ["Membership Renewal · 12W", "RETENTION", "MAJOR", "Journey Relic evolves", "Continuity"],
    ["Watercolor II Completed", "ACHIEVEMENT + EXPANSION", "MAJOR", "Water Drop II", "Watercolor III"],
    ["Foundation Performance I", "ACHIEVEMENT + RETENTION", "SIGNATURE", "Foundation Record I", "Next repertoire"],
    ["LP · 4 PINA Stickers", "ACHIEVEMENT", "MINOR", "Physical Bow + digital twin", "Continue theme"],
    ["LP Theme · 10/12", "ACHIEVEMENT + RETENTION", "MAJOR", "Theme Relic", "Next theme"],
    ["24M Actual Continuity", "RETENTION", "LEGACY", "Legacy Journey Relic", "—"],
  ];
  return (
    <>
      <SectionHead eyebrow="PINORIA STUDIO" title="Milestones & Journeys" copy="Learning and membership truth becomes visible meaning without turning Pinoria into a loyalty dashboard." action={<button className={styles.primary} onClick={onCreate}>+ Create Journey</button>} />
      <div className={styles.filterBar}><button className={styles.filterActive}>All</button><button>Entry</button><button>Retention</button><button>Expansion</button><button>Achievement</button><span /><button>Map view</button></div>
      <Card>
        <div className={styles.tableHeadFive}><span>Milestone</span><span>Role</span><span>Importance</span><span>Reward</span><span>Next journey</span></div>
        {rows.map((row) => <div className={styles.tableRowFive} key={row[0]}><div><strong>{row[0]}</strong><small>Published</small></div><div><Badge tone="neutral">{row[1]}</Badge></div><div><Badge tone={row[2] === "LEGACY" || row[2] === "SIGNATURE" ? "accent" : row[2] === "MAJOR" ? "good" : "neutral"}>{row[2]}</Badge></div><div><strong>{row[3]}</strong></div><div><strong>{row[4]}</strong></div></div>)}
      </Card>
      <div className={styles.flowCard}>
        <span>Watercolor II</span><b>→</b><span>Milestone achieved</span><b>→</b><span>Major Mastery</span><b>→</b><span>Water Drop II</span><b>→</b><span>Departure Reveal</span><b>→</b><span>Watercolor III available</span>
      </div>
    </>
  );
}

function Rewards({ notify }: { notify: (message: string) => void }) {
  return (
    <>
      <SectionHead eyebrow="PINORIA STUDIO" title="Rewards" copy="Source events match configurable Grant Policies. Staff records reality; Core derives reward consequences." action={<button className={styles.secondary} onClick={() => notify("Mock: manual grant drawer would open with mandatory reason + audit provenance.")}>Manual grant</button>} />
      <div className={styles.metricGrid}>
        <Metric label="Active Grant Policies" value="18" note="4 program families" />
        <Metric label="Reward Packages" value="6" note="Reusable templates" />
        <Metric label="Pending processing" value="0" note="Outbox healthy" tone="good" />
        <Metric label="Corrections" value="2" note="Manager review" tone="warn" />
      </div>
      <div className={styles.threeCol}>
        <Card><span className={styles.kicker}>PACKAGE</span><h2>Major Mastery</h2><ul className={styles.cleanList}><li>Primary Showcase Artifact</li><li>Featured Departure Reveal</li><li>World News eligible</li><li>Next Journey Opportunity</li></ul><Badge tone="good">Reusable</Badge></Card>
        <Card><span className={styles.kicker}>PACKAGE</span><h2>Signature Performance</h2><ul className={styles.cleanList}><li>Performance Relic</li><li>Recording provenance</li><li>Hero reveal</li><li>World News eligible</li></ul><Badge tone="accent">Signature</Badge></Card>
        <Card><span className={styles.kicker}>PACKAGE</span><h2>Term Continuity</h2><ul className={styles.cleanList}><li>Journey Artifact evolves</li><li>Continuity recognition</li><li>Featured reveal</li><li>No mastery claim</li></ul><Badge>Retention</Badge></Card>
      </div>
      <Card>
        <div className={styles.cardHead}><div><span className={styles.kicker}>GRANT POLICIES</span><h2>Event → outcome</h2></div><button className={styles.secondary}>+ New Policy</button></div>
        <PolicyRow when="Watercolor II completed" eligibility="First completion only" then="Water Drop II + Major Mastery package" status="Active" />
        <PolicyRow when="Membership cycle renewed" eligibility="Once per cycle" then="Journey Relic evolves" status="Active" />
        <PolicyRow when="Water mastery earned" eligibility="Once ever" then="Water Sigil credential" status="Active" />
        <PolicyRow when="Physical Chest result = Fruit" eligibility="Always" then="Pinoria Fruit +1" status="Active" />
      </Card>
    </>
  );
}

function PolicyRow({ when, eligibility, then, status }: { when: string; eligibility: string; then: string; status: string }) {
  return <div className={styles.policyRow}><div><span>WHEN</span><strong>{when}</strong></div><div><span>IF</span><strong>{eligibility}</strong></div><div><span>THEN</span><strong>{then}</strong></div><Badge tone="good">{status}</Badge></div>;
}

function Companions({ rotationDays, rotationSnooze, setRotationDays, setRotationSnooze, notify }: { rotationDays: number; rotationSnooze: number; setRotationDays: (value: number) => void; setRotationSnooze: (value: number) => void; notify: (message: string) => void }) {
  return (
    <>
      <SectionHead eyebrow="PINORIA STUDIO" title="Companion System" copy="Relationship progression built from reusable Progression Assets. Active Companion remains a presentation choice, never progression routing." />
      <div className={styles.tabStrip}><button className={styles.tabActive}>Progression</button><button>Species</button><button>Bond & Evidence</button><button>Materialization</button><button>Active Companion</button></div>
      <div className={styles.twoColWide}>
        <Card>
          <div className={styles.cardHead}><div><span className={styles.kicker}>PROGRESSION POLICY</span><h2>Starter Water · v1</h2></div><Badge tone="good">Published</Badge></div>
          <div className={styles.levelFlow}>
            <LevelBox level="Lv1" title="Encounter" />
            <ArrowRequirements lines={["Fruit ×2", "Applied to companion"]} />
            <LevelBox level="Lv2" title="Bonded" />
            <ArrowRequirements lines={["Fruit ×5", "Water Sigil ×1"]} />
            <LevelBox level="Lv3" title="Manifested" />
            <ArrowRequirements lines={["TBD"]} muted />
            <LevelBox level="Lv4" title="True Companion" muted />
          </div>
          <button className={styles.secondary} onClick={() => notify("Mock: creates a new immutable policy version and previews affected companions.")}>Create new version</button>
        </Card>
        <Card>
          <span className={styles.kicker}>PROGRESSION ASSETS</span><h2>Reusable capability definitions</h2>
          <AssetLine icon="●" name="Trái Pinoria" type="Stackable Resource" behavior="Applied to Companion" />
          <AssetLine icon="◇" name="Water Sigil" type="Credential" behavior="Learner Has" />
          <AssetLine icon="♡" name="Bond" type="Companion Evidence" behavior="Companion Event" />
          <AssetLine icon="✦" name="Continuity Mark" type="Persistent Mark" behavior="Companion scope" />
          <AssetLine icon="⌁" name="Lighthouse Key" type="Completion Gate" behavior="Event Completed" />
          <button className={styles.secondary} onClick={() => notify("Mock: new Progression Asset uses supported capability presets; no new code for new content inside the envelope.")}>+ New Progression Asset</button>
        </Card>
      </div>
      <div className={styles.twoCol}>
        <Card>
          <div className={styles.cardHead}><div><span className={styles.kicker}>ACTIVE COMPANION POLICY</span><h2>Rotation suggestion</h2></div><Badge tone="good">Enabled</Badge></div>
          <label className={styles.formLabel}>Suggest after <input type="number" min={1} value={rotationDays} onChange={(e) => setRotationDays(Number(e.target.value))} /> days</label>
          <label className={styles.formLabel}>If learner keeps current companion, snooze <input type="number" min={1} value={rotationSnooze} onChange={(e) => setRotationSnooze(Number(e.target.value))} /> days</label>
          <label className={styles.checkLine}><input type="checkbox" defaultChecked /> Surface during Check-in</label>
          <label className={styles.checkLine}><input type="checkbox" defaultChecked /> Allow manual suggestion</label>
          <p className={styles.bodyCopy}>Never auto-rotate. Learner chooses to switch or keep current companion.</p>
        </Card>
        <Card>
          <span className={styles.kicker}>SPECIES</span><h2>Starter companions</h2>
          <div className={styles.speciesGrid}><Species name="Mori" region="Starter" stages="4 forms" /><Species name="Ploo" region="Starter" stages="4 forms" /><Species name="Vayu" region="Starter" stages="4 forms" /></div>
          <button className={styles.secondary}>+ New Species</button>
        </Card>
      </div>
    </>
  );
}

function LevelBox({ level, title, muted = false }: { level: string; title: string; muted?: boolean }) {
  return <div className={`${styles.levelBox} ${muted ? styles.mutedBox : ""}`}><strong>{level}</strong><span>{title}</span></div>;
}
function ArrowRequirements({ lines, muted = false }: { lines: string[]; muted?: boolean }) {
  return <div className={`${styles.arrowReq} ${muted ? styles.mutedReq : ""}`}><b>→</b>{lines.map((line) => <span key={line}>{line}</span>)}</div>;
}
function AssetLine({ icon, name, type, behavior }: { icon: string; name: string; type: string; behavior: string }) {
  return <div className={styles.assetLine}><span className={styles.assetIcon}>{icon}</span><div><strong>{name}</strong><small>{type}</small></div><Badge>{behavior}</Badge></div>;
}
function Species({ name, region, stages }: { name: string; region: string; stages: string }) {
  return <div className={styles.speciesCard}><div className={styles.speciesArt}>{name.slice(0, 1)}</div><strong>{name}</strong><span>{region}</span><small>{stages}</small></div>;
}

function Shop({ notify }: { notify: (message: string) => void }) {
  const offers = [
    ["Moss Satchel", "360 PLS", "CURRENT COLLECTION", "UNLIMITED"],
    ["Mushroom Hat", "280 PLS", "CURRENT COLLECTION", "UNLIMITED"],
    ["Lantern Cape", "520 PLS", "SPECIAL FIND", "PER_STUDENT"],
    ["Terravia Leaf Pin", "180 PLS", "EVERYDAY", "UNLIMITED"],
  ];
  return (
    <>
      <SectionHead eyebrow="PINORIA STUDIO" title="Shop & Inventory" copy="Shop supplies official identity assets. Learner ownership is separate from Shop supply and physical stock." action={<button className={styles.primary} onClick={() => notify("Mock: create offer drawer would select a PUBLISHED content asset, price, supply mode and eligibility preset.")}>+ Add Offer</button>} />
      <div className={styles.metricGrid}>
        <Metric label="Current Collection" value="Terravia" note="6 active offers" />
        <Metric label="Catalog" value="24" note="Published assets" />
        <Metric label="Limited Global" value="1" note="Used sparingly" tone="warn" />
        <Metric label="Pending Choices" value="2" note="No PLS reserved" tone="neutral" />
      </div>
      <div className={styles.offerGrid}>{offers.map(([name, price, collection, supply]) => <Card className={styles.offerCard} key={name}><div className={styles.offerArt}>{name.slice(0, 1)}</div><Badge>{collection}</Badge><h3>{name}</h3><strong>{price}</strong><small>{supply}</small><button className={styles.ghost}>View usage</button></Card>)}</div>
      <div className={styles.twoCol}>
        <Card><span className={styles.kicker}>OWNERSHIP DOCTRINE</span><h2>Three different concepts</h2><ol className={styles.numberList}><li><strong>Learner Holding</strong><span>What the learner owns.</span></li><li><strong>Digital Supply</strong><span>Whether Shop can still sell it.</span></li><li><strong>Physical Inventory</strong><span>Real-world fulfillment/chest stock.</span></li></ol></Card>
        <Card><span className={styles.kicker}>ARRIVAL RANKING</span><h2>B1 / B2 / B3</h2><div className={styles.ranking}><span>B1</span><strong>Affordable / easy yes</strong><span>B2</span><strong>Hero current collection</strong><span>B3</span><strong>Aspiration</strong></div><p className={styles.bodyCopy}>Deterministic from ownership, PLS, campaign, impression history and slot diversity. No AI recommendation.</p></Card>
      </div>
    </>
  );
}

function World({ progress, setProgress, notify }: { progress: number; setProgress: (value: number) => void; notify: (message: string) => void }) {
  const state = progress >= 100 ? "RESOLVED" : progress >= 80 ? "CLIMAX" : progress >= 50 ? "STATE 3" : progress >= 25 ? "STATE 2" : "STATE 1";
  return (
    <>
      <SectionHead eyebrow="PINORIA STUDIO" title="World & Campaigns" copy="Many PINO activities become one shared story. Paths contribute differently without a learner leaderboard." action={<button className={styles.secondary} onClick={() => notify("Mock: Founder can create a campaign from a bounded template, then preview phases before publish.")}>+ New Campaign</button>} />
      <Card className={styles.worldHero}>
        <div><span className={styles.kicker}>CURRENT WORLD</span><h2>Terravia · Lantern Festival</h2><p>Primary campaign · Autumn 2026</p><div className={styles.badgeRow}><Badge tone="good">ACTIVE</Badge><Badge tone="accent">{state}</Badge></div></div>
        <div className={styles.treeVisual}><div className={styles.treeGlow} style={{ opacity: 0.25 + progress / 135 }} /><span>♧</span><strong>Ancient Tree</strong></div>
        <div className={styles.progressControl}><label>Founder simulation <strong>{progress}%</strong></label><input type="range" min="0" max="100" value={progress} onChange={(e) => setProgress(Number(e.target.value))} /><small>Preview only · numeric progress stays hidden from learner-facing TV.</small></div>
      </Card>
      <div className={styles.threeCol}>
        <Card><span className={styles.kicker}>OBJECTIVE</span><h2>Light</h2><p className={styles.bodyCopy}>Art / making events add visual light to the House.</p><Progress label="World state" value={Math.round(progress * 0.8)} max={100} /></Card>
        <Card><span className={styles.kicker}>OBJECTIVE</span><h2>Sound</h2><p className={styles.bodyCopy}>Piano performance events unlock festival audio layers.</p><Progress label="World state" value={Math.round(progress * 0.55)} max={100} /></Card>
        <Card><span className={styles.kicker}>OBJECTIVE</span><h2>Memory</h2><p className={styles.bodyCopy}>LP and community participation adds ribbons and shared traces.</p><Progress label="World state" value={Math.round(progress * 0.7)} max={100} /></Card>
      </div>
      <div className={styles.twoColWide}>
        <Card>
          <span className={styles.kicker}>CONTRIBUTION POLICIES</span><h2>Domain truth → shared meaning</h2>
          <PolicyRow when="Art specialization completed" eligibility="Once per milestone" then="CRAFT_LIGHT +5" status="Active" />
          <PolicyRow when="Piano performance recorded" eligibility="Once per performance" then="SOUND_LIGHT +5" status="Active" />
          <PolicyRow when="LP theme milestone" eligibility="Once per theme" then="SPARK +3" status="Active" />
          <PolicyRow when="Mirror contribution approved" eligibility="Campaign slot available" then="WORLD_CRAFT +8" status="Active" />
        </Card>
        <Card>
          <span className={styles.kicker}>WORLD NEWS</span><h2>Editorial queue</h2>
          <News type="LORE" title="The Four Drops" copy="The Water Drop is rumored to have four forms." />
          <News type="ACHIEVEMENT" title="A new Water Drop II appeared" copy="Bơ has discovered another form." />
          <News type="CAMPAIGN" title="Terravia is glowing brighter" copy="The Ancient Tree is nearing its next state." />
          <button className={styles.secondary}>Open News & Lore</button>
        </Card>
      </div>
    </>
  );
}

function News({ type, title, copy }: { type: string; title: string; copy: string }) {
  return <div className={styles.newsLine}><Badge tone={type === "ACHIEVEMENT" ? "accent" : type === "CAMPAIGN" ? "good" : "neutral"}>{type}</Badge><div><strong>{title}</strong><small>{copy}</small></div></div>;
}

function ContentLibrary({ onPreview }: { onPreview: (name: string) => void }) {
  const items = [
    ["Water Drop I", "Achievement Artifact", "Published", "Ready", "✓ ✓ ✓"],
    ["Water Drop II", "Achievement Artifact", "Published", "Ready", "✓ ✓ ✓"],
    ["Water Drop III", "Achievement Artifact", "Ready", "Warning", "✓ ✓ —"],
    ["Water Drop IV", "Achievement Artifact", "Draft", "Needs hero", "✓ ✓ —"],
    ["Mushroom Hat", "Character Cosmetic", "Published", "Ready", "✓ full · mini"],
    ["Terravia Energy Seed", "Special Item", "Published", "Ready", "✓ ritual"],
    ["Ancient Tree", "World Prop", "Published", "Ready", "5 variants"],
    ["Ploo", "Companion Species", "Published", "Ready", "4 stages"],
  ];
  return (
    <>
      <SectionHead eyebrow="PINORIA STUDIO" title="Content Library" copy="Create once, define meaning once, reuse everywhere. R2 stores media; Core definitions remain canonical." action={<button className={styles.primary}>+ New Content</button>} />
      <div className={styles.libraryToolbar}><input placeholder="Search content, family, tag…" /><button>All</button><button>Cosmetics</button><button>Artifacts</button><button>Companions</button><button>World</button><button>Media</button></div>
      <div className={styles.libraryGrid}>{items.map(([name, type, status, readiness, media], index) => <Card className={styles.contentCard} key={name}><div className={`${styles.contentArt} ${index % 3 === 1 ? styles.contentArtAlt : index % 3 === 2 ? styles.contentArtDark : ""}`}>{name.slice(0, 1)}</div><div className={styles.cardHead}><Badge tone={status === "Published" ? "good" : status === "Draft" ? "warn" : "neutral"}>{status}</Badge><span className={styles.readiness}>{readiness}</span></div><h3>{name}</h3><p>{type}</p><small>Media: {media}</small><div className={styles.inlineActions}><button className={styles.secondary} onClick={() => onPreview(name)}>Preview</button><button className={styles.ghost}>Usage</button></div></Card>)}</div>
      <Card><span className={styles.kicker}>ARTIFACT FAMILY</span><h2>Dây Chuyền Giọt Nước</h2><div className={styles.familyStages}><FamilyStage label="I" state="Published" /><FamilyStage label="II" state="Published" /><FamilyStage label="III" state="Ready" /><FamilyStage label="IV" state="Draft" hidden /></div><p className={styles.bodyCopy}>Lore reveal: I known · II known · III rumored · IV hidden. Same family supports Showcase, News and future-stage aspiration without rendering on the character.</p></Card>
    </>
  );
}

function FamilyStage({ label, state, hidden = false }: { label: string; state: string; hidden?: boolean }) {
  return <div className={`${styles.familyStage} ${hidden ? styles.familyHidden : ""}`}><strong>{hidden ? "?" : label}</strong><span>Stage {label}</span><small>{state}</small></div>;
}

function ProjectionPolicies() {
  return (
    <>
      <SectionHead eyebrow="PINORIA STUDIO · ADVANCED" title="Projection Policies" copy="Domain systems create truth. Pinoria projects meaning. Every learner-meaningful feature explicitly decides whether it projects." />
      <Card>
        <div className={styles.cardHead}><div><span className={styles.kicker}>ACTIVE POLICIES</span><h2>Plain-language projection rules</h2></div><button className={styles.secondary}>+ New Projection</button></div>
        <Projection when="A learner completes a Signature Performance" target="Student" consequence="Featured Departure Moment" surface="Departure" fallback="Achievement remains complete" />
        <Projection when="Companion materialization advances" target="Student + Companion" consequence="Hero Companion Ritual" surface="Live Ritual" fallback="Replay same outcome" />
        <Projection when="Physical Chest result = CARD_JAILED" target="Student" consequence="Magical Jail effect" surface="Ambient + Departure" fallback="No operational rights affected" />
        <Projection when="Campaign threshold reaches Climax" target="House" consequence="World State Change" surface="Ambient + Broadcast" fallback="World truth persists" />
        <Projection when="Water mastery is earned" target="Student" consequence="Water Ripple candidate" surface="Ambient" fallback="Mastery unaffected" />
      </Card>
      <div className={styles.doctrineCard}><strong>Projection checklist</strong><span>Decision · Source Event · Meaning · Target · Consequence · Surface · Timing · Importance · Intensity · Provenance · Moderation · Failure behavior.</span></div>
    </>
  );
}

function Projection({ when, target, consequence, surface, fallback }: { when: string; target: string; consequence: string; surface: string; fallback: string }) {
  return <div className={styles.projectionRow}><div><span>WHEN</span><strong>{when}</strong></div><div><span>TARGET</span><strong>{target}</strong></div><div><span>THEN</span><strong>{consequence}</strong></div><div><span>SURFACE</span><strong>{surface}</strong></div><div><span>FAILURE</span><strong>{fallback}</strong></div></div>;
}

function PhysicalFulfillment({ notify }: { notify: (message: string) => void }) {
  const items = [
    ["Bơ", "Ploo Lv3 Fragment", "Pending", "18 Aug"],
    ["An", "PINA Bow I", "Prepared", "19 Aug"],
    ["Trí", "Foundation Record Sleeve", "Out of stock", "18 Aug"],
  ];
  return (
    <>
      <SectionHead eyebrow="PINORIA OPS" title="Physical Fulfillment" copy="Digital truth never waits for physical stock. This queue only tracks what still needs to be prepared or handed over." />
      <Card>
        <div className={styles.tableHead}><span>Learner</span><span>Physical item</span><span>Status</span><span>Action</span></div>
        {items.map(([name, item, status, date]) => <div className={styles.tableRow} key={`${name}-${item}`}><div><strong>{name}</strong><small>Ready since {date}</small></div><div><strong>{item}</strong><small>Canonical reward already complete</small></div><div><Badge tone={status === "Prepared" ? "good" : status === "Out of stock" ? "danger" : "warn"}>{status}</Badge></div><div><button className={styles.secondary} onClick={() => notify(`Mock: ${item} marked ${status === "Prepared" ? "Given" : "Prepared"}.`)}>{status === "Prepared" ? "Mark Given" : status === "Out of stock" ? "Resolve stock" : "Mark Prepared"}</button></div></div>)}
      </Card>
      <div className={styles.twoCol}><Card><span className={styles.kicker}>PHYSICAL CHEST</span><h2>Batch logging session</h2><p className={styles.bodyCopy}>Physical reality decides the result. Staff logs actual draws; Core never rerolls.</p><div className={styles.chestButtons}><button>Fruit</button><button>Coral</button><button>Pearl</button><button>Jailed</button></div></Card><Card><span className={styles.kicker}>STOCK</span><h2>Operational warning</h2><div className={styles.stockLine}><strong>Ploo Lv3 Fragment</strong><span>8 on hand</span></div><div className={styles.stockLine}><strong>Foundation Record Sleeve</strong><span className={styles.dangerText}>0 on hand · 1 waiting</span></div><button className={styles.ghost}>Open physical inventory</button></Card></div>
    </>
  );
}

function TVOperations({ onOpen, notify }: { onOpen: () => void; notify: (message: string) => void }) {
  return (
    <>
      <SectionHead eyebrow="PINORIA OPS" title="Pinoria TV" copy="Disposable presentation client launched from this fixed PINO laptop and shown on the extended display." action={<button className={styles.primary} onClick={onOpen}>Open TV window ↗</button>} />
      <div className={styles.tvOpsGrid}>
        <Card className={styles.tvStatusCard}><div className={styles.tvDot} /><div><span className={styles.kicker}>RECEPTION_TV</span><h2>Closed</h2><p>Normal state until staff opens the dedicated runtime window.</p></div></Card>
        <Card><span className={styles.kicker}>OPERATING POLICY</span><h2>17:30 → 21:15</h2><p className={styles.bodyCopy}>TOS may remind staff to open TV. It does not auto-open a browser window.</p></Card>
      </div>
      <Card>
        <div className={styles.cardHead}><div><span className={styles.kicker}>RUNTIME CONTROLS</span><h2>Safe operator actions</h2></div><Badge>Prototype</Badge></div>
        <div className={styles.tvControlGrid}><button className={styles.primary} onClick={onOpen}>Open / Focus TV</button><button className={styles.secondary} onClick={() => notify("Mock: current foreground presentation aborted safely; canonical state untouched; renderer returns to Ambient.")}>Return to Ambient</button><button className={styles.secondary} onClick={() => notify("Mock: replay requests presentation only; no reward, choice or progression re-executes.")}>Replay last eligible</button><button className={styles.ghost} onClick={() => notify("Mock: presentation session closes. Core world and learner state remain intact.")}>Close TV</button></div>
      </Card>
      <div className={styles.twoColWide}>
        <Card><span className={styles.kicker}>QUEUE PREVIEW</span><h2>Personal events</h2><QueueItem priority="Departure" name="An" state="Queued" /><QueueItem priority="Arrival" name="Bơ" state="Expires in 2m" /><QueueItem priority="Ritual" name="Bùm · materialization" state="Ready" /></Card>
        <Card><span className={styles.kicker}>HEALTH</span><h2>Renderer diagnostics</h2><Health label="Manifest" value="v2026.08.19.14" good /><Health label="House assets" value="Cached" good /><Health label="Optional media" value="1 missing hero" warn /><Health label="Runtime" value="Not connected" warn /><p className={styles.bodyCopy}>TV failure never blocks check-in, checkout, reward, learning or companion truth.</p></Card>
      </div>
    </>
  );
}

function QueueItem({ priority, name, state }: { priority: string; name: string; state: string }) {
  return <div className={styles.queueItem}><Badge tone={priority === "Departure" ? "accent" : "neutral"}>{priority}</Badge><strong>{name}</strong><span>{state}</span></div>;
}
function Health({ label, value, good = false, warn = false }: { label: string; value: string; good?: boolean; warn?: boolean }) {
  return <div className={styles.health}><span>{label}</span><strong className={good ? styles.goodText : warn ? styles.warnText : ""}>{value}</strong></div>;
}

function HistoryDiagnostics() {
  return (
    <>
      <SectionHead eyebrow="REVIEW" title="History & Diagnostics" copy="Explainable chains from source truth to presentation. Prototype shows curated operational history, not raw event-store internals." />
      <div className={styles.twoColWide}>
        <Card>
          <span className={styles.kicker}>CORRELATION TRACE</span><h2>Why did Bơ receive Water Drop II?</h2>
          <div className={styles.timeline}><Trace time="18:42" title="Watercolor II completed" detail="Learning truth recorded" /><Trace time="18:42" title="Milestone achieved" detail="Achievement + Expansion · Major" /><Trace time="18:42" title="Reward granted" detail="Water Drop II · Major Mastery v1" /><Trace time="18:42" title="Ownership created" detail="Bơ owns Water Drop II" /><Trace time="18:43" title="Projection created" detail="Featured Departure candidate" /><Trace time="19:30" title="TV presentation completed" detail="Hero reveal · immutable snapshot" /></div>
        </Card>
        <Card>
          <span className={styles.kicker}>SYSTEM HEALTH</span><h2>Actionable warnings</h2>
          <Diagnostic tone="warn" title="Water Drop IV missing hero media" detail="Showcase ready; Signature reveal not production-ready." />
          <Diagnostic tone="good" title="Grant outbox healthy" detail="No retry backlog." />
          <Diagnostic tone="warn" title="Foundation Record Sleeve out of stock" detail="1 physical fulfillment waiting. Digital reward unaffected." />
          <Diagnostic tone="neutral" title="Pinoria TV closed" detail="Expected until operating window begins." />
        </Card>
      </div>
      <Card><span className={styles.kicker}>AUDIT / CORRECTIONS</span><h2>Semantic exceptions</h2><div className={styles.auditGrid}><Audit action="Correct Missing Reward" actor="Manager" reason="MISSED_LOG" target="An · PINA Bow" /><Audit action="Adjust Fruit Holding +1" actor="Founder" reason="LEGACY_DATA_FIX" target="Bơ" /><Audit action="Suppress Projection" actor="Manager" reason="Child requested quiet" target="Magical Jail" /></div></Card>
    </>
  );
}

function Trace({ time, title, detail }: { time: string; title: string; detail: string }) {
  return <div className={styles.trace}><span>{time}</span><i /><div><strong>{title}</strong><small>{detail}</small></div></div>;
}
function Diagnostic({ tone, title, detail }: { tone: "warn" | "good" | "neutral"; title: string; detail: string }) {
  return <div className={styles.diagnostic}><span className={`${styles.diagDot} ${styles[`diag_${tone}`]}`} /><div><strong>{title}</strong><small>{detail}</small></div></div>;
}
function Audit({ action, actor, reason, target }: { action: string; actor: string; reason: string; target: string }) {
  return <div className={styles.audit}><strong>{action}</strong><span>{target}</span><small>{actor} · {reason}</small></div>;
}

function JourneyBuilder({ onClose, notify }: { onClose: () => void; notify: (message: string) => void }) {
  const [step, setStep] = useState(1);
  return <div className={styles.modalBackdrop}><div className={styles.modal}><div className={styles.modalHead}><div><span className={styles.kicker}>FOUNDER WORKFLOW</span><h2>Create Journey</h2><p>Composed UX over separate canonical primitives. Prototype only.</p></div><button onClick={onClose}>×</button></div><div className={styles.stepper}>{[1,2,3,4].map((item) => <button key={item} className={step === item ? styles.stepActive : ""} onClick={() => setStep(item)}>{item}<span>{item === 1 ? "Identity" : item === 2 ? "Milestone" : item === 3 ? "Reward" : "Preview"}</span></button>)}</div>{step === 1 ? <div className={styles.modalBody}><label>Journey name<input defaultValue="Urban Sketching I" /></label><label>Program<select defaultValue="ArtChitect"><option>ArtChitect</option><option>PianoHouse</option><option>Little Piner</option></select></label><label>Duration<select defaultValue="4 weeks"><option>4 weeks</option><option>12 weeks</option><option>24 weeks</option></select></label><label>Template<select defaultValue="4-week Major Mastery"><option>4-week Major Mastery</option><option>12-week Signature Performance</option></select></label></div> : null}{step === 2 ? <div className={styles.modalBody}><label>Completion milestone<input defaultValue="Urban Sketching I Completed" /></label><label>Business role<select defaultValue="Achievement + Expansion"><option>Achievement + Expansion</option><option>Retention</option><option>Achievement</option></select></label><label>Journey importance<select defaultValue="Major"><option>Major</option><option>Signature</option><option>Minor</option></select></label><label>Next Journey<input defaultValue="Urban Sketching II" /></label></div> : null}{step === 3 ? <div className={styles.modalBody}><label>Reward package<select defaultValue="Major Mastery"><option>Major Mastery</option><option>Signature Performance</option><option>Term Continuity</option></select></label><label>Artifact<select defaultValue="Create new"><option>Create new</option><option>Use existing</option><option>No lasting artifact</option></select></label><div className={styles.spanTwo}><div className={styles.inlineCreate}><div><strong>Create linked 4-stage Artifact Family?</strong><small>Draft placeholders only; media can be added later.</small></div><button className={styles.secondary}>Create family</button></div></div></div> : null}{step === 4 ? <div className={styles.previewBundle}><div className={styles.flowCard}><span>Urban Sketching I</span><b>→</b><span>Milestone</span><b>→</b><span>Major Mastery</span><b>→</b><span>Sketch Relic I</span><b>→</b><span>Featured Departure</span><b>→</b><span>Urban Sketching II</span></div><div className={styles.previewPanel}><strong>Validation</strong><span>✓ Milestone semantics</span><span>✓ Reward package</span><span>✓ Next Journey</span><span>⚠ Artifact hero media can be added later</span></div></div> : null}<div className={styles.modalActions}><button className={styles.ghost} onClick={onClose}>Cancel</button>{step > 1 ? <button className={styles.secondary} onClick={() => setStep(step - 1)}>Back</button> : null}{step < 4 ? <button className={styles.primary} onClick={() => setStep(step + 1)}>Continue</button> : <button className={styles.primary} onClick={() => { notify("Mock: Journey bundle validated. Publish would be atomic in the real system."); onClose(); }}>Validate prototype</button>}</div></div></div>;
}

function ContentPreview({ name, onClose }: { name: string; onClose: () => void }) {
  return <div className={styles.modalBackdrop}><div className={`${styles.modal} ${styles.previewModal}`}><div className={styles.modalHead}><div><span className={styles.kicker}>FOUNDER PREVIEW</span><h2>{name}</h2><p>Same content identity across multiple presentation surfaces.</p></div><button onClick={onClose}>×</button></div><div className={styles.surfacePreviewGrid}><div className={styles.previewSurface}><span>ARRIVAL / SHOWCASE</span><div className={styles.mockCharacter}>BƠ<div className={styles.mockArtifact}>✦</div></div><strong>{name}</strong></div><div className={styles.previewSurface}><span>WORLD NEWS</span><div className={styles.newsPreviewHero}>✦</div><strong>A new form has appeared</strong><small>{name}</small></div><div className={styles.previewSurface}><span>INVENTORY</span><div className={styles.inventoryIcon}>✦</div><strong>{name}</strong><small>Achievement Artifact</small></div></div><div className={styles.modalActions}><button className={styles.primary} onClick={onClose}>Done</button></div></div></div>;
}
