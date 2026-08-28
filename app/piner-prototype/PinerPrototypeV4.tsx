"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import base from "./piner-prototype-v2.module.css";
import v3 from "./piner-prototype-v3.module.css";
import v4 from "./piner-prototype-v4.module.css";
import {
  acPackageTopics,
  characterChildren,
  CollectionKind,
  HomeCondition,
  JourneyPath,
  lpaFutureTopics,
  lpaPackageTopics,
  openStudioSessions,
  PathKey,
  scenarios,
  StudentScenario,
  householdKeys,
  ScheduledTopic,
} from "./fixtures-v2";

type AppTab = "home" | "journey" | "collection" | "explore";
type MediaTier = "FREE" | "PREMIUM";
type MediaAccess = "OPEN" | "TRIAL" | "LOCKED";
type CampaignVisibility = "PINER_ONLY" | "PUBLIC";
type PracticeResourceKind = "STARTER" | "JOURNEY" | "SPECIALTY";
type RecordingState = "idle" | "recording" | "ready" | "submitted";

type PackageSchedule = {
  days: string;
  time: string;
  mode: string;
};

type Campaign = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  emoji: string;
  visibility: CampaignVisibility;
  cmsSlug: string;
};

type CollectionMedia = {
  id: string;
  emoji: string;
  label: string;
  tier: MediaTier;
  retained?: boolean;
};

type CollectionStory = {
  id: string;
  kind: CollectionKind;
  title: string;
  subtitle: string;
  meta: string;
  heroEmoji: string;
  media: CollectionMedia[];
};

type PracticeResource = {
  id: string;
  kind: PracticeResourceKind;
  title: string;
  subtitle: string;
  progressLabel: string;
  sheetCode: string;
  sheetLabel: string;
  handMapLabel: string;
  audioLabel: string;
  available: boolean;
  founderStatus: "PUBLISHED" | "DRAFT";
};

type Overlay =
  | { type: "students" }
  | { type: "premium" }
  | { type: "collection"; story: CollectionStory }
  | { type: "touchpoint" }
  | { type: "campaign"; campaign: Campaign }
  | { type: "practice"; resource: PracticeResource }
  | null;

const tabs: Array<{ key: AppTab; label: string; icon: string }> = [
  { key: "home", label: "Home", icon: "⌂" },
  { key: "journey", label: "Journey", icon: "◇" },
  { key: "collection", label: "Collection", icon: "▦" },
  { key: "explore", label: "Explore", icon: "✦" },
];

const campaigns: Campaign[] = [
  {
    id: "film-music-launch",
    eyebrow: "Chuyên đề mới",
    title: "Film Music Specialty ra mắt",
    description: "Một nhánh PianoHouse riêng để đi sâu vào nhạc phim và tạo Vinyl Artifact.",
    cta: "Xem chuyên đề",
    emoji: "🎬",
    visibility: "PINER_ONLY",
    cmsSlug: "film-music-specialty",
  },
  {
    id: "piano-gift-piano",
    eyebrow: "Chương trình tháng này",
    title: "Học đàn · nhận đàn để tiếp tục ở nhà",
    description: "Campaign minh hoạ cho chương trình acquisition/upgrade có thể được publish cả Piner và pino-web.",
    cta: "Xem chương trình",
    emoji: "🎹",
    visibility: "PUBLIC",
    cmsSlug: "hoc-dan-tang-dan",
  },
  {
    id: "autumn-pinoria",
    eyebrow: "Sắp diễn ra",
    title: "Pinoria · mùa Thu mở cửa",
    description: "Một campaign nội bộ cho member, dùng để kéo learner quay lại physical house và khám phá arc mới.",
    cta: "Khám phá",
    emoji: "🍂",
    visibility: "PINER_ONLY",
    cmsSlug: "pinoria-autumn-arc",
  },
];

const pianoPracticeResources: PracticeResource[] = [
  {
    id: "ph-always-with-me-l4",
    kind: "JOURNEY",
    title: "Always With Me",
    subtitle: "Verse 1 + Chorus",
    progressLabel: "L4 · Fundamental",
    sheetCode: "PH-AWM-J04",
    sheetLabel: "Journey Sheet · v4",
    handMapLabel: "Two-hand · Single Bass",
    audioLabel: "Verse 1 + Chorus reference",
    available: true,
    founderStatus: "PUBLISHED",
  },
  {
    id: "ph-film-music-l2",
    kind: "SPECIALTY",
    title: "Film Music Specialty",
    subtitle: "Theme study · L2",
    progressLabel: "Specialty · L2",
    sheetCode: "PH-FILM-S02",
    sheetLabel: "Specialty Sheet · L2",
    handMapLabel: "Chord shape map",
    audioLabel: "Theme phrase reference",
    available: true,
    founderStatus: "PUBLISHED",
  },
  {
    id: "ph-always-with-me-l6",
    kind: "JOURNEY",
    title: "Always With Me · Expansion",
    subtitle: "Midtro arpeggio",
    progressLabel: "L6 · Expansion",
    sheetCode: "PH-AWM-J06",
    sheetLabel: "Journey Sheet · L6",
    handMapLabel: "Arpeggio hand map",
    audioLabel: "Midtro reference",
    available: false,
    founderStatus: "PUBLISHED",
  },
];

const lppPracticeResources: PracticeResource[] = [
  {
    id: "lpp-abc-current",
    kind: "STARTER",
    title: "ABC Song",
    subtitle: "Phrase 1–4",
    progressLabel: "Starter · đang học",
    sheetCode: "LPP-ABC-ST01",
    sheetLabel: "Starter Sheet · ABC Song",
    handMapLabel: "Thế tay C · ngón 1–5",
    audioLabel: "ABC Song · phrase reference",
    available: true,
    founderStatus: "PUBLISHED",
  },
  {
    id: "lpp-twinkle",
    kind: "STARTER",
    title: "Twinkle Twinkle",
    subtitle: "Starter melody",
    progressLabel: "Starter · available",
    sheetCode: "LPP-TWK-ST01",
    sheetLabel: "Starter Sheet · Twinkle",
    handMapLabel: "Position guide",
    audioLabel: "Twinkle · phrase reference",
    available: true,
    founderStatus: "PUBLISHED",
  },
  {
    id: "lpp-next-song",
    kind: "STARTER",
    title: "Bài quen thuộc tiếp theo",
    subtitle: "Future unlock",
    progressLabel: "Starter · locked",
    sheetCode: "LPP-NEXT-ST01",
    sheetLabel: "Starter Sheet",
    handMapLabel: "Hand map",
    audioLabel: "Reference audio",
    available: false,
    founderStatus: "DRAFT",
  },
];

const collectionKinds: Array<"All" | CollectionKind> = ["All", "Artwork", "Music", "Milestone", "Moment"];

function getScenario(key: string) {
  return scenarios.find((scenario) => scenario.key === key) ?? scenarios[0];
}

function packageSchedule(student: StudentScenario, path: PathKey): PackageSchedule {
  if (student.key === "minh-premium" && path === "PIANOHOUSE") return { days: "T3 · T5", time: "18:00–19:30", mode: "Fixed slot" };
  if (student.key === "minh-premium" && path === "ARTCHITECT") return { days: "T4 · T7", time: "18:00–20:30", mode: "Flexible studio window" };
  if (student.key === "han-trial-ac" && path === "ARTCHITECT") return { days: "T4", time: "18:00–20:30", mode: "Flexible studio window" };
  if (student.key === "mia-lpa" && path === "LPA") return { days: "T5", time: "18:00–19:30", mode: "Fixed slot" };
  if (student.key === "bo-lpp" && path === "LPP") return { days: "T6", time: "19:00–20:30", mode: "Fixed slot" };
  if (student.key === "leo-expired" && path === "PIANOHOUSE") return { days: "T3 · T5", time: "19:30–21:00", mode: "Fixed slot" };
  return { days: "Theo lịch gói", time: "Theo lớp đã chọn", mode: "Package schedule" };
}

function occurrenceCode(topic: ScheduledTopic) {
  return `26B${String(topic.syllabusWeek).padStart(2, "0")}`;
}

function attendanceLabel(state: ScheduledTopic["attendance"]) {
  if (state === "attended") return "Đã tham dự";
  if (state === "missed_excused") return "Vắng có phép";
  if (state === "missed") return "Vắng";
  if (state === "current") return "Hiện tại";
  return "Sắp tới";
}

function storiesFor(student: StudentScenario): CollectionStory[] {
  const stories: CollectionStory[] = [];
  const hasFish = student.collection.some((item) => item.title.includes("Chú cá màu cam"));

  if (hasFish) {
    stories.push({
      id: `${student.key}-orange-fish`,
      kind: "Artwork",
      title: "Chú cá màu cam",
      subtitle: "Open Studio · một outcome, nhiều nội dung",
      meta: "2 nội dung Free · 1 nội dung Premium",
      heroEmoji: "🐠",
      media: [
        { id: "fish-1", emoji: "🐠", label: "Ảnh tác phẩm", tier: "FREE", retained: true },
        { id: "fish-2", emoji: "📷", label: "Ảnh con cùng tác phẩm", tier: "FREE", retained: true },
        { id: "fish-3", emoji: "✨", label: "Ảnh curated / portfolio", tier: "PREMIUM" },
      ],
    });
  }

  student.collection
    .filter((item) => !item.title.includes("Chú cá màu cam"))
    .forEach((item) => {
      stories.push({
        id: `${student.key}-${item.id}`,
        kind: item.kind,
        title: item.title,
        subtitle: item.subtitle,
        meta: item.meta,
        heroEmoji: item.emoji,
        media: [
          {
            id: `${item.id}-main`,
            emoji: item.emoji,
            label: item.kind === "Music" ? "Recording" : item.kind === "Moment" ? "Khoảnh khắc" : "Nội dung chính",
            tier: item.tier,
            retained: item.owned,
          },
        ],
      });
    });

  return stories;
}

function mediaAccess(student: StudentScenario, media: CollectionMedia): MediaAccess {
  if (media.tier === "FREE") return "OPEN";
  if (student.mode === "ACTIVE_PREMIUM") return "OPEN";
  if (student.mode === "TRIAL_PREMIUM") return "TRIAL";
  if (student.mode === "EXPIRED_PREMIUM" && media.retained) return "OPEN";
  return "LOCKED";
}

export default function PinerPrototypeV4() {
  const [scenarioKey, setScenarioKey] = useState("minh-premium");
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [homeCondition, setHomeCondition] = useState<HomeCondition>("normal");
  const [activePath, setActivePath] = useState<PathKey | null>("PIANOHOUSE");
  const [collectionFilter, setCollectionFilter] = useState<"All" | CollectionKind>("All");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [campaignIndex, setCampaignIndex] = useState(0);

  const student = useMemo(() => getScenario(scenarioKey), [scenarioKey]);
  const householdStudents = useMemo(() => {
    const baseStudents = householdKeys.map(getScenario);
    return baseStudents.some((candidate) => candidate.key === student.key) ? baseStudents : [student, ...baseStudents];
  }, [student]);

  useEffect(() => {
    setActivePath(student.defaultPath);
    setActiveTab("home");
    setHomeCondition("normal");
    setCollectionFilter("All");
    setOverlay(null);
  }, [student.key, student.defaultPath]);

  useEffect(() => {
    if (activeTab !== "explore") return;
    const timer = window.setInterval(() => setCampaignIndex((index) => (index + 1) % campaigns.length), 6000);
    return () => window.clearInterval(timer);
  }, [activeTab]);

  function goTo(tab: AppTab) {
    setActiveTab(tab);
    setOverlay(null);
  }

  function openJourney(path: PathKey) {
    setActivePath(path);
    setActiveTab("journey");
    setOverlay(null);
  }

  return (
    <main className={`${base.prototype} ${v3.prototypeV3}`}>
      <aside className={base.labPanel}>
        <div className={base.labBadge}>LOCAL PROTOTYPE · V4</div>
        <h1>Piner Member Space</h1>
        <p>V4 mở rộng PianoHouse/LPP với một Practice Support contract dùng chung cho Starter, Journey và Specialty.</p>

        <label htmlFor="scenario" className={base.controlLabel}>Student / membership state</label>
        <select id="scenario" className={base.controlSelect} value={scenarioKey} onChange={(event) => setScenarioKey(event.target.value)}>
          {scenarios.map((scenario) => <option key={scenario.key} value={scenario.key}>{scenario.name} — {scenario.membershipLabel} · {scenario.membershipNote}</option>)}
        </select>

        <div className={base.controlGroup}>
          <span className={base.controlLabel}>Home condition</span>
          <div className={base.segmented}>
            {(["normal", "imminent", "fresh"] as HomeCondition[]).map((condition) => (
              <button key={condition} type="button" className={homeCondition === condition ? base.segmentActive : ""} onClick={() => { setHomeCondition(condition); setActiveTab("home"); }}>
                {condition === "normal" ? "Normal" : condition === "imminent" ? "≤4h" : "Fresh"}
              </button>
            ))}
          </div>
        </div>

        <div className={base.controlGroup}>
          <span className={base.controlLabel}>Jump to screen</span>
          <div className={base.screenButtons}>{tabs.map((tab) => <button key={tab.key} type="button" onClick={() => goTo(tab.key)}>{tab.label}</button>)}</div>
        </div>

        <div className={base.labNotes}>
          <strong>V4 review focus</strong>
          <span>Starter / Journey / Specialty dùng chung Practice Resource structure.</span>
          <span>Mỗi sheet bundle có notation + hand map + audio.</span>
          <span>Sheet player yêu cầu landscape và có fingering / listen / record-submit tools.</span>
          <span>Founder/TOS là authoring surface cho sheet, hand-map worksheet và audio assets.</span>
        </div>
      </aside>

      <section className={base.deviceStage}>
        <div className={base.device}>
          <header className={base.appHeader}>
            <button type="button" className={base.studentButton} onClick={() => setOverlay({ type: "students" })}>
              <span className={base.avatar}>{student.avatar}</span>
              <span className={base.studentMeta}><strong>{student.name}</strong><small>{student.membershipLabel} · {student.membershipNote}</small></span>
              <span className={base.chevron}>⌄</span>
            </button>
            <span className={base.wordmark}>PINO</span>
          </header>

          <div className={base.screen}>
            {activeTab === "home" && <HomeScreen student={student} condition={homeCondition} onJourney={openJourney} onCollection={() => goTo("collection")} onExplore={() => goTo("explore")} onPremium={() => setOverlay({ type: "premium" })} onTouchpoint={() => setOverlay({ type: "touchpoint" })} />}
            {activeTab === "journey" && <JourneyScreen student={student} activePath={activePath} setActivePath={setActivePath} onPremium={() => setOverlay({ type: "premium" })} onPractice={(resource) => setOverlay({ type: "practice", resource })} />}
            {activeTab === "collection" && <CollectionScreen student={student} filter={collectionFilter} setFilter={setCollectionFilter} onOpen={(story) => setOverlay({ type: "collection", story })} onPremium={() => setOverlay({ type: "premium" })} />}
            {activeTab === "explore" && <ExploreScreen student={student} campaignIndex={campaignIndex} setCampaignIndex={setCampaignIndex} onCampaign={(campaign) => setOverlay({ type: "campaign", campaign })} onPremium={() => setOverlay({ type: "premium" })} />}
          </div>

          <nav className={base.bottomNav}>
            {tabs.map((tab) => <button key={tab.key} type="button" className={activeTab === tab.key ? base.navActive : ""} onClick={() => goTo(tab.key)}><span>{tab.icon}</span><small>{tab.label}</small></button>)}
          </nav>

          {overlay && (
            <div className={base.overlayBackdrop} onMouseDown={() => setOverlay(null)}>
              <div className={`${base.sheet} ${overlay.type === "practice" ? v4.practiceSheetShell : ""}`} onMouseDown={(event) => event.stopPropagation()}>
                <div className={base.sheetHandle} />
                {overlay.type === "students" && <StudentSwitcher students={householdStudents} activeKey={student.key} onChoose={(key) => { setScenarioKey(key); setOverlay(null); }} onClose={() => setOverlay(null)} />}
                {overlay.type === "premium" && <PremiumSheet onClose={() => setOverlay(null)} />}
                {overlay.type === "collection" && <CollectionDetail student={student} story={overlay.story} onPremium={() => setOverlay({ type: "premium" })} onClose={() => setOverlay(null)} />}
                {overlay.type === "touchpoint" && <TouchpointSheet student={student} onClose={() => setOverlay(null)} />}
                {overlay.type === "campaign" && <CampaignDetail campaign={overlay.campaign} onClose={() => setOverlay(null)} />}
                {overlay.type === "practice" && <PracticeSheet resource={overlay.resource} onClose={() => setOverlay(null)} />}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function HomeScreen({ student, condition, onJourney, onCollection, onExplore, onPremium, onTouchpoint }: {
  student: StudentScenario;
  condition: HomeCondition;
  onJourney: (path: PathKey) => void;
  onCollection: () => void;
  onExplore: () => void;
  onPremium: () => void;
  onTouchpoint: () => void;
}) {
  const isFree = student.mode === "FREE_EXPLORE";
  const isExpired = student.mode === "EXPIRED_PREMIUM";
  const promoteTouchpoint = condition === "imminent" && student.nextTouchpoint;
  const promoteFresh = condition === "fresh" && student.collection.some((item) => item.owned);

  let eyebrow = student.home.eyebrow;
  let title = student.home.title;
  let description = student.home.description;
  let cta = student.home.cta;
  let meta = student.home.meta;
  let action = isFree && student.exploreStatus === "eligible" ? onExplore : isExpired ? onCollection : student.defaultPath ? () => onJourney(student.defaultPath as PathKey) : onExplore;

  if (promoteTouchpoint && student.nextTouchpoint) {
    eyebrow = "Sắp đến PINO";
    title = student.nextTouchpoint.title;
    description = `${student.nextTouchpoint.time} · ${student.nextTouchpoint.detail}`;
    cta = "Xem buổi hôm nay";
    meta = "Committed physical touchpoint · trong 4 giờ";
    action = onTouchpoint;
  } else if (promoteFresh) {
    eyebrow = "Vừa được thêm";
    title = student.home.freshTitle;
    description = student.home.freshDescription;
    cta = "Xem trong Collection";
    meta = "Fresh outcome tạm thời được ưu tiên";
    action = onCollection;
  }

  return (
    <div className={base.stack}>
      <section className={`${base.heroCard} ${isFree ? base.heroFree : ""} ${isExpired ? base.heroExpired : ""}`}>
        <span className={base.eyebrow}>{eyebrow}</span><h2>{title}</h2><p>{description}</p>
        <button type="button" className={base.primaryButton} onClick={action}>{cta} <span>→</span></button><small>{meta}</small>
      </section>

      {isExpired && <section className={`${base.noticeCard} ${base.lockNotice}`}><div className={base.noticeIcon}>🔒</div><div><span className={base.eyebrow}>Progression locked</span><h3>Trial đã hết hạn</h3><p>Lịch sử đã đạt vẫn xem được; progression mới cần Premium active.</p><button type="button" className={base.textButton} onClick={onPremium}>Tiếp tục với Premium →</button></div></section>}

      {student.paths.length > 0 ? <section className={`${base.sectionBlock} ${v3.safeBlock}`}><div className={base.sectionHeading}><div><span className={base.eyebrow}>Journey glance</span><h3>Con đang ở đâu?</h3></div></div><div className={base.glanceGrid}>{student.paths.map((path) => <button type="button" className={base.glanceCard} key={path.key} onClick={() => onJourney(path.key)}><span className={base.pathMark}>{path.key === "PIANOHOUSE" ? "♬" : path.key === "ARTCHITECT" ? "✎" : path.key === "LPP" ? "♫" : "✿"}</span><span className={base.glanceCopy}><strong>{path.label}</strong><small>{path.summary}</small></span><span className={base.arrow}>→</span></button>)}</div></section> : <section className={base.aspirationCard}><span className={base.eyebrow}>Journey</span><h3>Journey bắt đầu khi con bước vào một Path Premium.</h3><p>Free vẫn là một Explore experience hoàn chỉnh.</p><button type="button" className={base.secondaryButton} onClick={onPremium}>Khám phá Premium</button></section>}

      {storiesFor(student).length > 0 && <section className={`${base.sectionBlock} ${v3.safeBlock}`}><div className={base.sectionHeading}><div><span className={base.eyebrow}>Fresh / meaningful</span><h3>{student.home.freshTitle}</h3></div><button type="button" className={base.textButton} onClick={onCollection}>Collection</button></div><button type="button" className={base.freshCard} onClick={onCollection}><span className={base.freshVisual}>{student.home.freshEmoji}</span><span><strong>{student.home.freshTitle}</strong><small>{student.home.freshDescription}</small></span><span>→</span></button></section>}

      <section className={base.returnCard}><div><span className={base.eyebrow}>Return to PINO</span><h3>{student.nextTouchpoint ? student.nextTouchpoint.time : "Khám phá một buổi phù hợp"}</h3><p>{student.nextTouchpoint ? `${student.nextTouchpoint.title} · ${student.nextTouchpoint.detail}` : student.exploreNote}</p></div><button type="button" className={base.circleButton} onClick={student.nextTouchpoint ? onTouchpoint : onExplore}>→</button></section>
    </div>
  );
}

function JourneyScreen({ student, activePath, setActivePath, onPremium, onPractice }: {
  student: StudentScenario;
  activePath: PathKey | null;
  setActivePath: (path: PathKey) => void;
  onPremium: () => void;
  onPractice: (resource: PracticeResource) => void;
}) {
  if (!student.paths.length || !activePath) {
    return <div className={base.stack}><div className={base.pageTitle}><span className={base.eyebrow}>Journey</span><h2>Hành trình dài hạn bắt đầu với Premium.</h2><p>Open Studio là Explore — không tạo curriculum progress giả cho Free.</p></div><section className={base.aspirationCard}><h3>Preview Journey</h3><p>Journey thật bám theo Path, package và canonical progress của Student.</p><button type="button" className={base.primaryButton} onClick={onPremium}>Khám phá Premium →</button></section></div>;
  }

  const path = student.paths.find((candidate) => candidate.key === activePath) ?? student.paths[0];

  return (
    <div className={`${base.stack} ${v3.journeyStack}`}>
      <div className={base.pageTitle}><span className={base.eyebrow}>Journey</span><h2>Hành trình của {student.shortName}</h2><p>Package-relative surface, canonical Path progress.</p></div>
      {student.paths.length > 1 && <div className={base.pathSwitcher}>{student.paths.map((candidate) => <button type="button" key={candidate.key} className={activePath === candidate.key ? base.pathActive : ""} onClick={() => setActivePath(candidate.key)}>{candidate.label}</button>)}</div>}
      <PackagePeriodCard student={student} path={path} onPremium={onPremium} />
      {activePath === "PIANOHOUSE" && <PianoJourney expired={student.mode === "EXPIRED_PREMIUM"} onPremium={onPremium} onPractice={onPractice} />}
      {activePath === "ARTCHITECT" && <ArtJourney student={student} />}
      {activePath === "LPA" && <LittlePinerArtJourney />}
      {activePath === "LPP" && <LittlePinerPianoJourney onPractice={onPractice} />}
    </div>
  );
}

function PackagePeriodCard({ student, path, onPremium }: { student: StudentScenario; path: JourneyPath; onPremium: () => void }) {
  const schedule = packageSchedule(student, path.key);
  const expired = path.package.status === "EXPIRED";
  const trial = path.package.status === "TRIAL";
  return (
    <section className={`${base.packageCard} ${expired ? base.packageExpired : ""} ${v3.safeBlock}`}>
      <div className={base.packageTop}><span className={base.eyebrow}>{trial ? "Trial period" : expired ? "Access period ended" : "Current package"}</span>{trial && <span className={base.trialBadge}>TRIAL</span>}{expired && <span className={base.lockBadge}>LOCKED</span>}</div>
      <div className={base.dateRow}><span><small>Bắt đầu</small><strong>{path.package.start}</strong></span><span className={base.dateArrow}>→</span><span><small>Hết gói</small><strong>{path.package.end}</strong></span></div>
      <div className={v3.scheduleGrid}>
        <span><small>Lịch học</small><strong>{schedule.days}</strong></span>
        <span><small>Giờ học</small><strong>{schedule.time}</strong></span>
        <span><small>Hình thức</small><strong>{schedule.mode}</strong></span>
      </div>
      <p>{path.package.note}</p>
      {(trial || expired) && <button type="button" className={base.textButton} onClick={onPremium}>{expired ? "Tiếp tục với Premium" : "Xem quyền lợi Premium"} →</button>}
    </section>
  );
}

function ScheduledTopicRail({ topics }: { topics: ScheduledTopic[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const current = viewport.querySelector<HTMLElement>("[data-current='true']");
    if (!current) return;
    const left = current.offsetLeft - viewport.clientWidth / 2 + current.clientWidth / 2;
    viewport.scrollTo({ left: Math.max(0, left), behavior: "auto" });
  }, [topics]);

  return (
    <div ref={viewportRef} className={v3.topicViewport} aria-label="Scheduled syllabus topics">
      <div className={v3.topicTrack}>
        {topics.map((topic) => (
          <article key={topic.slot} data-current={topic.attendance === "current" ? "true" : "false"} className={`${v3.topicCard} ${topic.attendance === "attended" ? v3.topicAttended : topic.attendance === "missed_excused" ? v3.topicMissedExcused : topic.attendance === "missed" ? v3.topicMissed : topic.attendance === "current" ? v3.topicCurrent : v3.topicUpcoming}`}>
            <div className={v3.topicTop}><small>Buổi {topic.slot}</small><span>{occurrenceCode(topic)}</span></div>
            <strong>{topic.title}</strong>
            <em>{attendanceLabel(topic.attendance)}</em>
          </article>
        ))}
      </div>
    </div>
  );
}

function ArtJourney({ student }: { student: StudentScenario }) {
  const [expandedCluster, setExpandedCluster] = useState<string | null>(student.key === "minh-premium" ? "Character" : null);
  const current = acPackageTopics.find((topic) => topic.attendance === "current") ?? acPackageTopics[0];
  return (
    <>
      <section className={`${base.journeyHero} ${v3.safeBlock}`}><span className={base.eyebrow}>{student.mode === "TRIAL_PREMIUM" ? "Trial Premium · real Journey" : "Current project"}</span><div className={base.journeyHeroRow}><div><h3>{student.key === "minh-premium" ? "Character exploration" : "Khu rừng trong mơ"}</h3><p>Buổi {current.slot} · {occurrenceCode(current)} · {current.title}</p></div><span className={base.bigGlyph}>✎</span></div><p className={base.footnote}>Buổi 1 = buổi đầu tiên của gói. Mã occurrence được giữ như reference nhỏ cho Team; Parent không cần hiểu global Syllabus week.</p></section>

      <section className={`${base.sectionBlock} ${v3.safeBlock}`}><div className={base.sectionHeading}><div><span className={base.eyebrow}>Foundation · package timeline</span><h3>12 buổi theo lịch của gói</h3></div><small>current được center</small></div><ScheduledTopicRail topics={acPackageTopics} /><p className={base.footnote}>Rail chỉ scroll ngang bên trong section. Vắng vẫn giữ topic; attendance không tự grant skill exposure.</p><div className={base.skillChips}><span>Line ✓</span><span>Shape ✓</span><span>Value</span><span>Color ✓</span><span>Composition</span><span>Texture</span></div></section>

      <section className={`${base.sectionBlock} ${v3.safeBlock}`}><div className={base.sectionHeading}><div><span className={base.eyebrow}>Specialization roadmap</span><h3>L1 cluster → child specializations</h3></div></div><div className={base.clusterGrid}><button type="button" className={`${base.clusterCard} ${base.clusterCompleted}`} onClick={() => setExpandedCluster(expandedCluster === "Illustration" ? null : "Illustration")}><small>L1 cluster</small><strong>Illustration</strong><span>Click để xem child-level state</span></button><button type="button" className={`${base.clusterCard} ${base.clusterActive}`} onClick={() => setExpandedCluster(expandedCluster === "Character" ? null : "Character")}><small>L1 cluster</small><strong>Character</strong><span>2 completed · 1 active · 2 future</span></button></div>{expandedCluster === "Character" && <div className={base.clusterDetail}><div className={base.clusterDetailHead}><strong>Character · L1 children</strong><small>child-level projection</small></div><div className={base.childGrid}>{characterChildren.map((child) => <div key={child.label} className={`${base.childNode} ${child.state === "completed" ? base.childCompleted : child.state === "active" ? base.childActive : child.state === "locked" ? base.childLocked : ""}`}><span>{child.state === "completed" ? "✓" : child.state === "active" ? "◉" : child.state === "locked" ? "🔒" : "○"}</span><strong>{child.label}</strong><small>{child.state}</small></div>)}</div></div>}{expandedCluster === "Illustration" && <div className={base.clusterDetail}><strong>Illustration children</strong><p>Taxonomy chưa được invent trong prototype. Surface đã hỗ trợ drill-down khi Founder chốt child definitions.</p></div>}</section>
    </>
  );
}

function LittlePinerArtJourney() {
  return (
    <>
      <section className={`${base.journeyHero} ${v3.safeBlock}`}><span className={base.eyebrow}>Syllabus / package journey</span><div className={base.journeyHeroRow}><div><h3>12 chủ đề của gói hiện tại</h3><p>Elapsed topics và attendance là hai lớp khác nhau.</p></div><span className={base.bigGlyph}>✿</span></div><p className={base.footnote}>Little Checkpoint vẫn tính qualifying attended sessions ở mốc 4 / 8 / 12.</p></section>
      <section className={`${base.sectionBlock} ${v3.safeBlock}`}><div className={base.sectionHeading}><div><span className={base.eyebrow}>Current package</span><h3>Chủ đề theo Syllabus</h3></div><small>scroll trái / phải</small></div><ScheduledTopicRail topics={lpaPackageTopics} /><div className={base.attendanceLegend}><span>● Đã tham dự</span><span>— Vắng có phép</span><span>◎ Current</span><span>○ Sắp tới</span></div></section>
      <section className={base.checkpointCard}><span className={base.eyebrow}>Little Checkpoints · attended counter</span><div className={base.checkpointRow}><div className={base.checkpointDone}><span>🌸</span><strong>4</strong><small>earned</small></div><div className={base.checkpointCurrent}><span>🌼</span><strong>8</strong><small>next</small></div><div><span>✿</span><strong>12</strong><small>EVIP close</small></div></div></section>
      <section className={`${base.sneakPeekCard} ${v3.safeBlock}`}><span className={base.eyebrow}>Sneak peek · kỳ tiếp theo</span><h3>Những chủ đề đang chờ phía trước</h3><div className={v3.futureViewport}><div className={v3.futureTrack}>{lpaFutureTopics.map((topic) => <div key={topic}><span>✦</span><strong>{topic}</strong><small>Preview để tạo orientation / re-enroll motivation, không unlock resource sớm.</small></div>)}</div></div></section>
    </>
  );
}

function PianoJourney({ expired, onPremium, onPractice }: { expired: boolean; onPremium: () => void; onPractice: (resource: PracticeResource) => void }) {
  return (
    <>
      {expired && <section className={base.lockBanner}><span>🔒</span><div><strong>Progression mới đang khóa</strong><p>L4 và achievement cũ vẫn giữ. L5+ cần Premium active.</p><button type="button" onClick={onPremium}>Mở lại Journey →</button></div></section>}
      <section className={base.journeyHero}><span className={base.eyebrow}>Current repertoire</span><div className={base.journeyHeroRow}><div><h3>Always With Me</h3><p>{expired ? "L4 · retained" : "L4 · Fundamental · active"}</p></div><span className={base.bigGlyph}>♬</span></div><div className={base.levelLadder}>{Array.from({ length: 10 }, (_, index) => { const level = index + 1; return <div key={level} className={`${base.levelNode} ${level <= 4 ? base.levelDone : ""} ${level === 4 ? base.levelCurrent : ""} ${expired && level > 4 ? base.levelLocked : ""}`}><strong>L{level}</strong><small>{expired && level > 4 ? "🔒" : level <= 5 ? "Fund." : "Exp."}</small></div>; })}</div></section>
      <PracticeSupport title="Practice support" description="Journey Sheet và Specialty Sheet dùng cùng một player; khác nhau ở resource family và unlock context." resources={pianoPracticeResources} expired={expired} onOpen={onPractice} />
    </>
  );
}

function LittlePinerPianoJourney({ onPractice }: { onPractice: (resource: PracticeResource) => void }) {
  return (
    <>
      <section className={base.journeyHero}><span className={base.eyebrow}>Starter collection</span><div className={base.journeyHeroRow}><div><h3>ABC Song</h3><p>Self-paced · independent LPP definition</p></div><span className={base.bigGlyph}>♫</span></div><p className={base.footnote}>LPP không có một resource system riêng. Starter Sheet dùng cùng Practice Resource contract với PianoHouse Journey/Specialty.</p></section>
      <section className={base.sectionBlock}><div className={base.sectionHeading}><div><span className={base.eyebrow}>Songs</span><h3>Những bài đang giữ</h3></div></div><div className={base.songList}><div className={base.songCurrent}><span>🎵</span><strong>ABC Song</strong><small>Current · Starter resource mở</small></div><div><span>♪</span><strong>Twinkle Twinkle</strong><small>Available</small></div><div className={base.songLocked}><span>◇</span><strong>Next familiar song</strong><small>Future visibility</small></div></div></section>
      <PracticeSupport title="Practice support" description="Starter Sheet, hand-position worksheet và audio reference được bundle vào cùng một practice player." resources={lppPracticeResources} expired={false} onOpen={onPractice} />
    </>
  );
}

function PracticeSupport({ title, description, resources, expired, onOpen }: { title: string; description: string; resources: PracticeResource[]; expired: boolean; onOpen: (resource: PracticeResource) => void }) {
  return (
    <section className={`${base.sectionBlock} ${v3.safeBlock}`}>
      <div className={base.sectionHeading}><div><span className={base.eyebrow}>Practice support</span><h3>{title}</h3></div><small>Founder-managed</small></div>
      <p className={v4.practiceIntro}>{description}</p>
      <div className={v4.practiceList}>
        {resources.map((resource) => {
          const locked = expired || !resource.available;
          return (
            <button type="button" key={resource.id} className={`${v4.practiceCard} ${locked ? v4.practiceLocked : ""}`} onClick={locked ? undefined : () => onOpen(resource)}>
              <span className={`${v4.resourceKind} ${resource.kind === "STARTER" ? v4.kindStarter : resource.kind === "SPECIALTY" ? v4.kindSpecialty : v4.kindJourney}`}>{resource.kind}</span>
              <span className={v4.practiceCopy}><strong>{resource.title}</strong><small>{resource.subtitle}</small><em>{resource.progressLabel}</em></span>
              <span className={v4.practiceAssets}><small>♩ Sheet</small><small>☝ Hand map</small><small>▶ Audio</small></span>
              <span className={v4.founderChip}>{resource.founderStatus === "PUBLISHED" ? "Founder · published" : "Founder · draft"}</span>
              <span className={v4.practiceArrow}>{locked ? "🔒" : "→"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PracticeSheet({ resource, onClose }: { resource: PracticeResource; onClose: () => void }) {
  const [landscape, setLandscape] = useState(false);
  const [showFingering, setShowFingering] = useState(false);
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState<RecordingState>("idle");

  function toggleRecording() {
    if (recording === "recording") setRecording("ready");
    else setRecording("recording");
  }

  return (
    <div className={`${base.sheetContent} ${v4.practiceSheetContent}`}>
      <div className={base.sheetTitleRow}>
        <div><span className={base.eyebrow}>{resource.kind} · Practice Sheet</span><h3>{resource.title}</h3></div>
        <button type="button" onClick={onClose}>×</button>
      </div>

      {!landscape ? (
        <div className={v4.orientationGate}>
          <div className={v4.orientationPhone}><span>↻</span></div>
          <strong>Lật ngang điện thoại để mở sheet</strong>
          <p>Notation và practice tools được tối ưu cho landscape. Prototype dùng nút dưới để mô phỏng orientation change.</p>
          <button type="button" className={base.primaryButton} onClick={() => setLandscape(true)}>Mô phỏng đã xoay ngang →</button>
        </div>
      ) : (
        <div className={v4.landscapePlayer}>
          <div className={v4.playerTopbar}>
            <div><small>{resource.progressLabel}</small><strong>{resource.sheetLabel}</strong></div>
            <span>{resource.sheetCode}</span>
          </div>

          <div className={v4.scorePaper}>
            <div className={v4.scoreHeader}><strong>{resource.title}</strong><small>{resource.subtitle}</small></div>
            {[0, 1].map((system) => (
              <div key={system} className={v4.scoreSystem}>
                {[0, 1, 2, 3, 4].map((line) => <span key={line} className={v4.staffLine} style={{ top: `${18 + line * 10}%` }} />)}
                {[12, 26, 40, 55, 70, 84].map((left, index) => (
                  <span key={left} className={v4.note} style={{ left: `${left}%`, top: `${34 + ((index + system) % 3) * 10}%` }}>
                    {showFingering && <em>{(index % 5) + 1}</em>}●
                  </span>
                ))}
              </div>
            ))}
          </div>

          <div className={v4.practiceToolbar}>
            <button type="button" className={showFingering ? v4.toolActive : ""} onClick={() => setShowFingering((value) => !value)}><span>☝</span><strong>Xếp ngón</strong><small>{resource.handMapLabel}</small></button>
            <button type="button" className={listening ? v4.toolActive : ""} onClick={() => setListening((value) => !value)}><span>{listening ? "❚❚" : "▶"}</span><strong>{listening ? "Đang nghe" : "Nghe đoạn"}</strong><small>{resource.audioLabel}</small></button>
            <button type="button" className={recording === "recording" ? v4.recordingActive : recording === "submitted" ? v4.toolSubmitted : ""} onClick={recording === "submitted" ? undefined : toggleRecording}><span>{recording === "recording" ? "■" : recording === "submitted" ? "✓" : "●"}</span><strong>{recording === "recording" ? "Dừng ghi" : recording === "submitted" ? "Đã gửi" : "Ghi âm"}</strong><small>{recording === "ready" ? "Recording sẵn sàng submit" : "Luyện tập tại nhà"}</small></button>
          </div>

          {recording === "ready" && <button type="button" className={v4.submitPracticeButton} onClick={() => setRecording("submitted")}>Gửi bài luyện tập →</button>}
          {recording === "submitted" && <div className={v4.submitNotice}><strong>Đã gửi luyện tập</strong><span>Practice submission không tự level-up; nó chỉ tạo submission/evidence candidate để hệ thống xử lý tiếp.</span></div>}

          <div className={v4.assetSource}>
            <span className={base.eyebrow}>Founder content source</span>
            <div><span>♩ <strong>Sheet</strong><small>{resource.sheetLabel}</small></span><span>☝ <strong>Hand-position worksheet</strong><small>{resource.handMapLabel}</small></span><span>▶ <strong>Audio</strong><small>{resource.audioLabel}</small></span></div>
          </div>
        </div>
      )}
    </div>
  );
}

function CollectionScreen({ student, filter, setFilter, onOpen, onPremium }: {
  student: StudentScenario;
  filter: "All" | CollectionKind;
  setFilter: (filter: "All" | CollectionKind) => void;
  onOpen: (story: CollectionStory) => void;
  onPremium: () => void;
}) {
  const stories = storiesFor(student);
  const visible = filter === "All" ? stories : stories.filter((story) => story.kind === filter);
  return (
    <div className={base.stack}>
      <div className={base.pageTitle}><span className={base.eyebrow}>Collection</span><h2>Những gì {student.shortName} đã tạo và đạt.</h2><p>Group theo outcome/item. Free/Premium gating có thể nằm ở từng media bên trong item.</p></div>
      <div className={base.filterRow}>{collectionKinds.map((kind) => <button type="button" key={kind} className={filter === kind ? base.filterActive : ""} onClick={() => setFilter(kind)}>{kind}</button>)}</div>
      <div className={v3.storyGrid}>
        {visible.map((story) => {
          const openCount = story.media.filter((media) => mediaAccess(student, media) !== "LOCKED").length;
          return <button type="button" key={story.id} className={v3.storyCard} onClick={() => onOpen(story)}><div className={v3.storyStack}>{story.media.slice(0, 3).map((media, index) => { const access = mediaAccess(student, media); return <span key={media.id} style={{ transform: `translate(${index * 7}px, ${index * -3}px) rotate(${index * 2 - 2}deg)` }} className={access === "LOCKED" ? v3.storyThumbLocked : ""}>{access === "LOCKED" ? "🔒" : media.emoji}</span>; })}</div><span className={base.collectionKind}>{story.kind}</span><strong>{story.title}</strong><small>{story.subtitle}</small><em>{openCount}/{story.media.length} nội dung đang mở</em></button>;
        })}
      </div>
      {student.mode === "FREE_EXPLORE" && <section className={base.premiumDiscoveryCard}><span className={base.eyebrow}>Trong cùng một tác phẩm</span><h3>Free vẫn xem phần Free; Premium chỉ khóa phần nội dung Premium.</h3><p>Không tách Collection thành hai lane làm mất ngữ cảnh của một outcome.</p><button type="button" className={base.secondaryButton} onClick={onPremium}>Khám phá Premium</button></section>}
      {student.mode === "TRIAL_PREMIUM" && <section className={base.noticeCard}><span className={base.eyebrow}>Trial Premium</span><p>Premium media đang mở thật và có badge Trial nhẹ trong detail view.</p><button type="button" className={base.textButton} onClick={onPremium}>Xem quyền lợi Premium →</button></section>}
      <section className={base.collectionDoctrine}><strong>Access expires. Achievement does not.</strong><p>Owned historical media vẫn được giữ; gating chỉ áp vào nội dung chưa có quyền truy cập.</p></section>
    </div>
  );
}

function ExploreScreen({ student, campaignIndex, setCampaignIndex, onCampaign, onPremium }: {
  student: StudentScenario;
  campaignIndex: number;
  setCampaignIndex: (index: number) => void;
  onCampaign: (campaign: Campaign) => void;
  onPremium: () => void;
}) {
  const blocked = student.exploreStatus === "confirmed";
  const campaign = campaigns[campaignIndex];
  const previous = () => setCampaignIndex((campaignIndex - 1 + campaigns.length) % campaigns.length);
  const next = () => setCampaignIndex((campaignIndex + 1) % campaigns.length);

  return (
    <div className={base.stack}>
      <div className={base.pageTitle}><span className={base.eyebrow}>Explore</span><h2>Quay lại PINO để thử điều mới.</h2><p>Campaign, Open Studio và Premium discovery nằm cùng một return-to-PINO surface.</p></div>

      <section className={v3.campaignHero}>
        <div className={v3.campaignTop}><span className={v3.campaignVisibility}>{campaign.visibility === "PUBLIC" ? "PUBLIC + PINER" : "PINER ONLY"}</span><span className={v3.campaignCount}>{campaignIndex + 1}/{campaigns.length}</span></div>
        <div className={v3.campaignBody}><span className={v3.campaignEmoji}>{campaign.emoji}</span><div><span className={base.eyebrow}>{campaign.eyebrow}</span><h3>{campaign.title}</h3><p>{campaign.description}</p><button type="button" className={base.primaryButton} onClick={() => onCampaign(campaign)}>{campaign.cta} →</button></div></div>
        <div className={v3.campaignControls}><button type="button" onClick={previous} aria-label="Campaign trước">←</button><div>{campaigns.map((item, index) => <button type="button" key={item.id} aria-label={`Campaign ${index + 1}`} className={index === campaignIndex ? v3.campaignDotActive : ""} onClick={() => setCampaignIndex(index)} />)}</div><button type="button" onClick={next} aria-label="Campaign tiếp">→</button></div>
      </section>

      <section className={`${base.eligibilityCard} ${blocked ? base.eligibilityBlocked : ""}`}><span className={base.eyebrow}>{student.membershipLabel}</span><h3>{blocked ? "Tuần này đã có Open Studio được xác nhận" : student.exploreStatus === "premium" ? "Premium đang mở thêm quyền lợi" : "Tuần này có thể khám phá"}</h3><p>{student.exploreNote}</p>{blocked && <button type="button" className={base.primaryButton} onClick={onPremium}>Khám phá quyền lợi Premium →</button>}</section>

      <section className={`${base.sectionBlock} ${v3.safeBlock}`}><div className={base.sectionHeading}><div><span className={base.eyebrow}>Upcoming</span><h3>Open Studio gần nhất</h3></div></div><div className={base.osList}>{openStudioSessions.map((session) => <div key={session.id} className={base.osCard}><span className={base.osEmoji}>{session.emoji}</span><div><small>{session.path} · {session.age}</small><strong>{session.title}</strong><span>{session.time}</span></div><button type="button" disabled={blocked}>{blocked ? "Đã dùng" : "Yêu cầu"}</button></div>)}</div></section>

      <section className={base.premiumDiscoveryCard}><span className={base.eyebrow}>Đi xa hơn Explore</span><h3>Premium biến những lần ghé PINO thành Journey dài hạn.</h3><p>Pricing/plan comparison có thể phát triển theo hướng SaaS khi pricing và payment policy được chốt.</p><button type="button" className={base.secondaryButton} onClick={onPremium}>Xem Free vs Premium</button></section>
    </div>
  );
}

function CollectionDetail({ student, story, onPremium, onClose }: { student: StudentScenario; story: CollectionStory; onPremium: () => void; onClose: () => void }) {
  return (
    <div className={base.sheetContent}>
      <div className={base.sheetTitleRow}><div><span className={base.eyebrow}>{story.kind}</span><h3>{story.title}</h3></div><button type="button" onClick={onClose}>×</button></div>
      <p className={v3.detailIntro}>{story.subtitle} · {story.meta}</p>
      <div className={v3.mediaGrid}>{story.media.map((media) => { const access = mediaAccess(student, media); return <button type="button" key={media.id} className={`${v3.mediaTile} ${access === "LOCKED" ? v3.mediaLocked : ""}`} onClick={access === "LOCKED" ? onPremium : undefined}><span>{access === "LOCKED" ? "🔒" : media.emoji}</span><strong>{media.label}</strong><small>{media.tier === "FREE" ? "Free" : access === "TRIAL" ? "Premium · TRIAL" : media.tier === "PREMIUM" ? "Premium" : ""}</small>{access === "TRIAL" && <em>TRIAL</em>}</button>; })}</div>
      <p className={base.sheetNote}>Một Collection item có thể chứa nhiều representation/media với access khác nhau. Item không bị tách thành Free/Premium lane.</p>
    </div>
  );
}

function CampaignDetail({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  return <div className={base.sheetContent}><div className={base.sheetTitleRow}><div><span className={base.eyebrow}>Explore CMS item</span><h3>{campaign.title}</h3></div><button type="button" onClick={onClose}>×</button></div><div className={v3.campaignDetailVisual}>{campaign.emoji}</div><p>{campaign.description}</p><div className={base.detailFacts}><span><small>Visibility</small><strong>{campaign.visibility === "PUBLIC" ? "Public + Piner" : "Piner only"}</strong></span><span><small>CMS key</small><strong>{campaign.cmsSlug}</strong></span></div><p className={base.sheetNote}>Target architecture: content được quản lý trong TOS; public item có projection lên pino-web, Piner-only item chỉ xuất hiện trong authenticated/member Explore surface.</p></div>;
}

function StudentSwitcher({ students, activeKey, onChoose, onClose }: { students: StudentScenario[]; activeKey: string; onChoose: (key: string) => void; onClose: () => void }) {
  return <div className={base.sheetContent}><div className={base.sheetTitleRow}><div><span className={base.eyebrow}>Household</span><h3>Các bé của bạn</h3></div><button type="button" onClick={onClose}>×</button></div><div className={base.studentList}>{students.map((candidate) => <button type="button" key={candidate.key} onClick={() => onChoose(candidate.key)}><span className={base.avatar}>{candidate.avatar}</span><span><strong>{candidate.name}</strong><small>{candidate.membershipLabel} · {candidate.membershipNote}</small></span><em>{candidate.key === activeKey ? "●" : "○"}</em></button>)}</div><div className={base.householdActions}><button type="button">Tài khoản phụ huynh <span>›</span></button><button type="button">Hồ sơ & bảo mật <span>›</span></button><button type="button">Đăng xuất <span>›</span></button></div></div>;
}

function PremiumSheet({ onClose }: { onClose: () => void }) {
  return <div className={base.sheetContent}><div className={base.sheetTitleRow}><div><span className={base.eyebrow}>Future pricing direction</span><h3>Free vs Premium</h3></div><button type="button" onClick={onClose}>×</button></div><div className={base.planGrid}><div className={base.planCard}><span>FREE</span><strong>Explore</strong><ul><li>Open Studio theo eligibility hiện hành</li><li>Free-access media trong Collection</li><li>Khám phá Path</li></ul></div><div className={`${base.planCard} ${base.planPremium}`}><span>PREMIUM</span><strong>Learn · Progress · Create · Belong</strong><ul><li>Persistent Path Journey</li><li>Premium media / richer Collection</li><li>Practice / continuation theo Path</li><li>Quyền lợi khác theo policy được duyệt</li></ul></div></div><button type="button" className={base.primaryButton} disabled>Nâng cấp Premium · pricing chưa chốt</button><p className={base.sheetNote}>Prototype chỉ chốt UX direction kiểu SaaS plan comparison; chưa invent giá, payment hay Premium OS quantity.</p></div>;
}

function TouchpointSheet({ student, onClose }: { student: StudentScenario; onClose: () => void }) {
  return <div className={base.sheetContent}><div className={base.sheetTitleRow}><div><span className={base.eyebrow}>Next touchpoint</span><h3>{student.nextTouchpoint?.title ?? "PINO"}</h3></div><button type="button" onClick={onClose}>×</button></div>{student.nextTouchpoint ? <div className={base.touchpointDetail}><span className={base.bigGlyph}>⌂</span><strong>{student.nextTouchpoint.time}</strong><p>{student.nextTouchpoint.detail}</p><small>{student.nextTouchpoint.subtitle}</small></div> : <p>Chưa có committed physical touchpoint.</p>}</div>;
}
