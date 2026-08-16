"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./piner-prototype-v2.module.css";
import {
  acPackageTopics,
  characterChildren,
  CollectionItem,
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
  AttendanceState,
} from "./fixtures-v2";

type AppTab = "home" | "journey" | "collection" | "explore";
type Overlay =
  | { type: "students" }
  | { type: "premium" }
  | { type: "collection"; item: CollectionItem }
  | { type: "touchpoint" }
  | null;

const tabs: Array<{ key: AppTab; label: string; icon: string }> = [
  { key: "home", label: "Home", icon: "⌂" },
  { key: "journey", label: "Journey", icon: "◇" },
  { key: "collection", label: "Collection", icon: "▦" },
  { key: "explore", label: "Explore", icon: "✦" },
];

const collectionKinds: Array<"All" | CollectionKind> = ["All", "Artwork", "Music", "Milestone", "Moment"];

function getScenario(key: string) {
  return scenarios.find((scenario) => scenario.key === key) ?? scenarios[0];
}

export default function PinerPrototypeV2() {
  const [scenarioKey, setScenarioKey] = useState("minh-premium");
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [homeCondition, setHomeCondition] = useState<HomeCondition>("normal");
  const [activePath, setActivePath] = useState<PathKey | null>("PIANOHOUSE");
  const [collectionFilter, setCollectionFilter] = useState<"All" | CollectionKind>("All");
  const [overlay, setOverlay] = useState<Overlay>(null);

  const student = useMemo(() => getScenario(scenarioKey), [scenarioKey]);
  const householdStudents = useMemo(() => {
    const base = householdKeys.map(getScenario);
    return base.some((candidate) => candidate.key === student.key) ? base : [student, ...base];
  }, [student]);

  useEffect(() => {
    setActivePath(student.defaultPath);
    setActiveTab("home");
    setHomeCondition("normal");
    setCollectionFilter("All");
    setOverlay(null);
  }, [student.key, student.defaultPath]);

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
    <main className={styles.prototype}>
      <aside className={styles.labPanel}>
        <div className={styles.labBadge}>LOCAL PROTOTYPE · V2</div>
        <h1>Piner Member Space</h1>
        <p>Mock data only. V2 tập trung package-aligned Journey, Collection gating và trial/expiry states.</p>

        <label htmlFor="scenario" className={styles.controlLabel}>Student / membership state</label>
        <select id="scenario" className={styles.controlSelect} value={scenarioKey} onChange={(event) => setScenarioKey(event.target.value)}>
          {scenarios.map((scenario) => (
            <option key={scenario.key} value={scenario.key}>{scenario.name} — {scenario.membershipLabel} · {scenario.membershipNote}</option>
          ))}
        </select>

        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Home condition</span>
          <div className={styles.segmented}>
            {(["normal", "imminent", "fresh"] as HomeCondition[]).map((condition) => (
              <button key={condition} type="button" className={homeCondition === condition ? styles.segmentActive : ""} onClick={() => { setHomeCondition(condition); setActiveTab("home"); }}>
                {condition === "normal" ? "Normal" : condition === "imminent" ? "≤4h" : "Fresh"}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Jump to screen</span>
          <div className={styles.screenButtons}>
            {tabs.map((tab) => <button key={tab.key} type="button" onClick={() => goTo(tab.key)}>{tab.label}</button>)}
          </div>
        </div>

        <div className={styles.labNotes}>
          <strong>V2 changes</strong>
          <span>Syllabus/package timeline ≠ attendance counter.</span>
          <span>Package slot 1 = learner's first scheduled session.</span>
          <span>Missed sessions stay visible.</span>
          <span>Free/Premium Collection are explicit lanes.</span>
        </div>
      </aside>

      <section className={styles.deviceStage}>
        <div className={styles.device}>
          <header className={styles.appHeader}>
            <button type="button" className={styles.studentButton} onClick={() => setOverlay({ type: "students" })}>
              <span className={styles.avatar}>{student.avatar}</span>
              <span className={styles.studentMeta}>
                <strong>{student.name}</strong>
                <small>{student.membershipLabel} · {student.membershipNote}</small>
              </span>
              <span className={styles.chevron}>⌄</span>
            </button>
            <span className={styles.wordmark}>PINO</span>
          </header>

          <div className={styles.screen}>
            {activeTab === "home" && (
              <HomeScreen
                student={student}
                condition={homeCondition}
                onJourney={openJourney}
                onCollection={() => goTo("collection")}
                onExplore={() => goTo("explore")}
                onPremium={() => setOverlay({ type: "premium" })}
                onTouchpoint={() => setOverlay({ type: "touchpoint" })}
              />
            )}
            {activeTab === "journey" && (
              <JourneyScreen student={student} activePath={activePath} setActivePath={setActivePath} onPremium={() => setOverlay({ type: "premium" })} />
            )}
            {activeTab === "collection" && (
              <CollectionScreen student={student} filter={collectionFilter} setFilter={setCollectionFilter} onOpen={(item) => setOverlay({ type: "collection", item })} onPremium={() => setOverlay({ type: "premium" })} />
            )}
            {activeTab === "explore" && <ExploreScreen student={student} onPremium={() => setOverlay({ type: "premium" })} />}
          </div>

          <nav className={styles.bottomNav}>
            {tabs.map((tab) => (
              <button key={tab.key} type="button" className={activeTab === tab.key ? styles.navActive : ""} onClick={() => goTo(tab.key)}>
                <span>{tab.icon}</span><small>{tab.label}</small>
              </button>
            ))}
          </nav>

          {overlay && (
            <div className={styles.overlayBackdrop} onMouseDown={() => setOverlay(null)}>
              <div className={styles.sheet} onMouseDown={(event) => event.stopPropagation()}>
                <div className={styles.sheetHandle} />
                {overlay.type === "students" && <StudentSwitcher students={householdStudents} activeKey={student.key} onChoose={(key) => { setScenarioKey(key); setOverlay(null); }} onClose={() => setOverlay(null)} />}
                {overlay.type === "premium" && <PremiumSheet onClose={() => setOverlay(null)} />}
                {overlay.type === "collection" && <CollectionDetail item={overlay.item} onClose={() => setOverlay(null)} />}
                {overlay.type === "touchpoint" && <TouchpointSheet student={student} onClose={() => setOverlay(null)} />}
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
    <div className={styles.stack}>
      <section className={`${styles.heroCard} ${isFree ? styles.heroFree : ""} ${isExpired ? styles.heroExpired : ""}`}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
        <button type="button" className={styles.primaryButton} onClick={action}>{cta} <span>→</span></button>
        <small>{meta}</small>
      </section>

      {isExpired && (
        <section className={`${styles.noticeCard} ${styles.lockNotice}`}>
          <div className={styles.noticeIcon}>🔒</div>
          <div>
            <span className={styles.eyebrow}>Progression locked</span>
            <h3>Trial đã hết hạn</h3>
            <p>Lịch sử đã đạt vẫn xem được; bước tiến mới và unlock mới cần Premium active.</p>
            <button type="button" className={styles.textButton} onClick={onPremium}>Khám phá Premium →</button>
          </div>
        </section>
      )}

      {student.paths.length > 0 ? (
        <section className={styles.sectionBlock}>
          <div className={styles.sectionHeading}>
            <div><span className={styles.eyebrow}>Journey glance</span><h3>Con đang ở đâu?</h3></div>
          </div>
          <div className={styles.glanceGrid}>
            {student.paths.map((path) => (
              <button type="button" className={styles.glanceCard} key={path.key} onClick={() => onJourney(path.key)}>
                <span className={styles.pathMark}>{path.key === "PIANOHOUSE" ? "♬" : path.key === "ARTCHITECT" ? "✎" : path.key === "LPP" ? "♫" : "✿"}</span>
                <span className={styles.glanceCopy}><strong>{path.label}</strong><small>{path.summary}</small><MiniJourney path={path.key} student={student} /></span>
                <span className={styles.arrow}>→</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className={styles.aspirationCard}>
          <span className={styles.eyebrow}>Journey</span>
          <h3>Journey bắt đầu khi con bước vào một Path Premium.</h3>
          <p>Free vẫn là một trải nghiệm Explore hoàn chỉnh; Premium mới mở persistent learning journey.</p>
          <button type="button" className={styles.secondaryButton} onClick={onPremium}>Khám phá Premium</button>
        </section>
      )}

      {student.collection.some((item) => item.owned) && (
        <section className={styles.sectionBlock}>
          <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Fresh / meaningful</span><h3>{student.home.freshTitle}</h3></div><button type="button" className={styles.textButton} onClick={onCollection}>Collection</button></div>
          <button type="button" className={styles.freshCard} onClick={onCollection}>
            <span className={styles.freshVisual}>{student.home.freshEmoji}</span>
            <span><strong>{student.home.freshTitle}</strong><small>{student.home.freshDescription}</small></span><span>→</span>
          </button>
        </section>
      )}

      <section className={styles.returnCard}>
        <div><span className={styles.eyebrow}>Return to PINO</span><h3>{student.nextTouchpoint ? student.nextTouchpoint.time : "Khám phá một buổi phù hợp"}</h3><p>{student.nextTouchpoint ? `${student.nextTouchpoint.title} · ${student.nextTouchpoint.detail}` : student.exploreNote}</p></div>
        <button type="button" className={styles.circleButton} onClick={student.nextTouchpoint ? onTouchpoint : onExplore}>→</button>
      </section>

      {student.mode === "TRIAL_PREMIUM" && (
        <section className={styles.noticeCard}>
          <span className={styles.eyebrow}>Trial Premium</span>
          <p>Trial đang dùng Journey thật. CTA Premium được giữ nhẹ để không biến learner Home thành sales page.</p>
          <button type="button" className={styles.textButton} onClick={onPremium}>Xem quyền lợi Premium →</button>
        </section>
      )}
    </div>
  );
}

function MiniJourney({ path, student }: { path: PathKey; student: StudentScenario }) {
  if (path === "PIANOHOUSE") return <div className={styles.miniDots}>{Array.from({ length: 10 }, (_, index) => <span key={index} className={index < 4 ? styles.dotDone : index === 4 ? styles.dotCurrent : ""} />)}</div>;
  if (path === "ARTCHITECT") return <div className={styles.miniTree}><span className={styles.treeDone}>●</span><span>—</span><span className={styles.treeDone}>●</span><span>—</span><span className={styles.treeCurrent}>◉</span><span>—</span><span>○</span></div>;
  if (path === "LPA") return <div className={styles.miniLabel}>{student.shortName === "Mía" ? "6 topics elapsed · 5 attended" : "Syllabus timeline"}</div>;
  return <div className={styles.miniLabel}>Starter song · self-paced</div>;
}

function JourneyScreen({ student, activePath, setActivePath, onPremium }: {
  student: StudentScenario;
  activePath: PathKey | null;
  setActivePath: (path: PathKey) => void;
  onPremium: () => void;
}) {
  if (!student.paths.length || !activePath) {
    return <div className={styles.stack}><div className={styles.pageTitle}><span className={styles.eyebrow}>Journey</span><h2>Hành trình dài hạn bắt đầu với Premium.</h2><p>Open Studio là Explore — không tạo curriculum progress giả cho Free.</p></div><section className={styles.aspirationCard}><h3>Preview Journey</h3><p>Journey thật sẽ bám theo Path, package và canonical progress của chính Student.</p><button type="button" className={styles.primaryButton} onClick={onPremium}>Khám phá Premium →</button></section></div>;
  }

  const path = student.paths.find((candidate) => candidate.key === activePath) ?? student.paths[0];

  return (
    <div className={styles.stack}>
      <div className={styles.pageTitle}><span className={styles.eyebrow}>Journey</span><h2>Hành trình của {student.shortName}</h2><p>Package-relative surface, canonical Path progress.</p></div>
      {student.paths.length > 1 && <div className={styles.pathSwitcher}>{student.paths.map((candidate) => <button type="button" key={candidate.key} className={activePath === candidate.key ? styles.pathActive : ""} onClick={() => setActivePath(candidate.key)}>{candidate.label}</button>)}</div>}
      <PackagePeriodCard path={path} mode={student.mode} onPremium={onPremium} />
      {activePath === "PIANOHOUSE" && <PianoJourney expired={student.mode === "EXPIRED_PREMIUM"} onPremium={onPremium} />}
      {activePath === "ARTCHITECT" && <ArtJourney student={student} />}
      {activePath === "LPA" && <LittlePinerArtJourney />}
      {activePath === "LPP" && <LittlePinerPianoJourney />}
    </div>
  );
}

function PackagePeriodCard({ path, mode, onPremium }: { path: JourneyPath; mode: StudentScenario["mode"]; onPremium: () => void }) {
  const expired = path.package.status === "EXPIRED";
  const trial = path.package.status === "TRIAL";
  return (
    <section className={`${styles.packageCard} ${expired ? styles.packageExpired : ""}`}>
      <div className={styles.packageTop}><span className={styles.eyebrow}>{trial ? "Trial period" : expired ? "Access period ended" : "Current package"}</span>{trial && <span className={styles.trialBadge}>TRIAL</span>}{expired && <span className={styles.lockBadge}>LOCKED</span>}</div>
      <div className={styles.dateRow}><span><small>Bắt đầu</small><strong>{path.package.start}</strong></span><span className={styles.dateArrow}>→</span><span><small>Hết gói</small><strong>{path.package.end}</strong></span></div>
      <p>{path.package.note}</p>
      {(trial || mode === "EXPIRED_PREMIUM") && <button type="button" className={styles.textButton} onClick={onPremium}>{expired ? "Tiếp tục với Premium" : "Xem quyền lợi Premium"} →</button>}
    </section>
  );
}

function PianoJourney({ expired, onPremium }: { expired: boolean; onPremium: () => void }) {
  return (
    <>
      {expired && <section className={styles.lockBanner}><span>🔒</span><div><strong>Progression mới đang khóa</strong><p>L4, recording và achievement cũ vẫn ở đây. L5+ và unlock mới cần Premium active.</p><button type="button" onClick={onPremium}>Mở lại Journey →</button></div></section>}
      <section className={styles.journeyHero}>
        <span className={styles.eyebrow}>Current repertoire</span><div className={styles.journeyHeroRow}><div><h3>Always With Me</h3><p>{expired ? "L4 · retained" : "L4 · Fundamental · active"}</p></div><span className={styles.bigGlyph}>♬</span></div>
        <div className={styles.levelLadder}>{Array.from({ length: 10 }, (_, index) => { const level = index + 1; return <div key={level} className={`${styles.levelNode} ${level <= 4 ? styles.levelDone : ""} ${level === 4 ? styles.levelCurrent : ""} ${expired && level > 4 ? styles.levelLocked : ""}`}><strong>L{level}</strong><small>{expired && level > 4 ? "🔒" : level <= 5 ? "Fund." : "Exp."}</small></div>; })}</div>
        <p className={styles.footnote}>Per-piece progress được giữ khi repertoire rotate; access expiry không xóa achievement.</p>
      </section>
      <section className={styles.sectionBlock}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Practice support</span><h3>Resources theo progress</h3></div></div><div className={styles.resourceGrid}><div><span>♩</span><strong>Sheet</strong><small>Verse 1 + Chorus</small></div><div><span>☝</span><strong>Hand map</strong><small>Two-hand guide</small></div><div><span>▶</span><strong>Listen</strong><small>Reference audio</small></div><div className={styles.resourceLocked}><span>◇</span><strong>Expansion</strong><small>{expired ? "Locked by access" : "Mở từ L6"}</small></div></div></section>
    </>
  );
}

function ArtJourney({ student }: { student: StudentScenario }) {
  const [expandedCluster, setExpandedCluster] = useState<string | null>(student.key === "minh-premium" ? "Character" : null);
  return (
    <>
      <section className={styles.journeyHero}><span className={styles.eyebrow}>{student.mode === "TRIAL_PREMIUM" ? "Trial Premium · real Journey" : "Current project"}</span><div className={styles.journeyHeroRow}><div><h3>{student.key === "minh-premium" ? "Character exploration" : "Khu rừng trong mơ"}</h3><p>Package slot 6 · Syllabus W13</p></div><span className={styles.bigGlyph}>✎</span></div><p className={styles.footnote}>Buổi 1 trên surface = buổi đầu của gói. Topic title vẫn lấy từ Syllabus tuần thực tế của PINO.</p></section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Foundation · package timeline</span><h3>12 buổi theo lịch của gói</h3></div><small>slot ≠ skill mastery</small></div>
        <ScheduledTopicRail topics={acPackageTopics} />
        <p className={styles.footnote}>Vắng vẫn giữ slot/topic trên Journey. Skill exposure chỉ được ghi khi có participation/evidence phù hợp; Journey không giả định rằng một slot đã chạy = skill đã đạt.</p>
        <div className={styles.skillChips}><span>Line ✓</span><span>Shape ✓</span><span>Value</span><span>Color ✓</span><span>Composition</span><span>Texture</span></div>
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Specialization roadmap</span><h3>L1 là cluster, không phải một node phẳng</h3></div></div>
        <div className={styles.clusterGrid}>
          <button type="button" className={`${styles.clusterCard} ${styles.clusterCompleted}`} onClick={() => setExpandedCluster(expandedCluster === "Illustration" ? null : "Illustration")}><small>L1 cluster</small><strong>Illustration</strong><span>Children taxonomy cấu hình riêng</span></button>
          <button type="button" className={`${styles.clusterCard} ${styles.clusterActive}`} onClick={() => setExpandedCluster(expandedCluster === "Character" ? null : "Character")}><small>L1 cluster</small><strong>Character</strong><span>2 completed · 1 active · 2 future</span></button>
        </div>
        {expandedCluster === "Character" && <div className={styles.clusterDetail}><div className={styles.clusterDetailHead}><strong>Character · L1 children</strong><small>Click cluster → chi tiết</small></div><div className={styles.childGrid}>{characterChildren.map((child) => <div key={child.label} className={`${styles.childNode} ${child.state === "completed" ? styles.childCompleted : child.state === "active" ? styles.childActive : child.state === "locked" ? styles.childLocked : ""}`}><span>{child.state === "completed" ? "✓" : child.state === "active" ? "●" : child.state === "locked" ? "🔒" : "○"}</span><strong>{child.label}</strong><small>{child.state}</small></div>)}</div></div>}
        {expandedCluster === "Illustration" && <div className={styles.clusterDetail}><strong>Illustration · L1 children</strong><p>Prototype giữ cluster/drill-down behavior nhưng không invent taxonomy Illustration khi Founder chưa chốt danh sách children cụ thể.</p></div>}
        <div className={styles.roadmapNext}><div className={styles.roadLocked}><small>L2</small><strong>World</strong><span>Requires qualifying L1 progress ở Illustration + Character</span></div><div className={styles.roadLocked}><small>L2</small><strong>Deep branch</strong><span>Locked</span></div></div>
      </section>
    </>
  );
}

function LittlePinerArtJourney() {
  return (
    <>
      <section className={styles.journeyHero}><span className={styles.eyebrow}>Syllabus-aligned package journey</span><div className={styles.journeyHeroRow}><div><h3>6 / 12 chủ đề đã đi qua</h3><p>5 tham dự · 1 vắng có phép</p></div><span className={styles.bigGlyph}>✿</span></div><p className={styles.footnote}>Journey chính bám theo 12 scheduled syllabus topics của gói. Attendance counter vẫn tồn tại riêng cho Little Checkpoints.</p></section>
      <section className={styles.sectionBlock}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Current package</span><h3>12 chủ đề theo Syllabus</h3></div><small>swipe để xem tương lai</small></div><ScheduledTopicRail topics={lpaPackageTopics} /><div className={styles.attendanceLegend}><span>✓ Tham dự</span><span>◌ Vắng có phép</span><span>! Vắng</span><span>→ Sắp tới</span></div></section>
      <section className={styles.checkpointCard}><span className={styles.eyebrow}>Little Checkpoints · attendance counter</span><div className={styles.checkpointRow}><div className={styles.checkpointDone}><span>🌸</span><strong>4</strong><small>earned</small></div><div className={styles.checkpointCurrent}><span>🌼</span><strong>8</strong><small>5/8 attended</small></div><div><span>✿</span><strong>12</strong><small>future</small></div></div><p className={styles.footnote}>Checkpoint vẫn tính theo đủ buổi tham dự; một buổi vắng không biến mất khỏi Syllabus Journey nhưng cũng không cộng attendance counter.</p></section>
      <section className={styles.sneakPeekCard}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Sneak peek · kỳ/gói tiếp theo</span><h3>Còn nhiều chủ đề phía trước</h3></div></div><div className={styles.futureRail}>{lpaFutureTopics.map((topic) => <div key={topic}><span>✦</span><strong>{topic}</strong><small>Preview để tạo động lực tái đăng ký</small></div>)}</div></section>
    </>
  );
}

function LittlePinerPianoJourney() {
  return <><section className={styles.journeyHero}><span className={styles.eyebrow}>Starter collection</span><div className={styles.journeyHeroRow}><div><h3>ABC Song</h3><p>Self-paced · independent LPP level definition</p></div><span className={styles.bigGlyph}>♫</span></div><p className={styles.footnote}>LPP vẫn dùng song/self-paced progression riêng; package dates ở trên giúp PH hiểu thời hạn entitlement.</p></section><section className={styles.sectionBlock}><div className={styles.songList}><div className={styles.songCurrent}><span>🎵</span><strong>ABC Song</strong><small>Current · worksheet mở</small></div><div><span>♪</span><strong>Twinkle Twinkle</strong><small>Starter · available</small></div><div className={styles.songLocked}><span>◇</span><strong>Next familiar song</strong><small>Future visibility</small></div></div></section></>;
}

function ScheduledTopicRail({ topics }: { topics: Array<{ slot: number; syllabusWeek: number; title: string; attendance: AttendanceState }> }) {
  return <div className={styles.topicRail}>{topics.map((topic) => <div key={topic.slot} className={`${styles.topicCard} ${topic.attendance === "attended" ? styles.topicAttended : topic.attendance === "missed_excused" ? styles.topicMissedExcused : topic.attendance === "missed" ? styles.topicMissed : topic.attendance === "current" ? styles.topicCurrent : styles.topicUpcoming}`}><div className={styles.topicTop}><small>Buổi {topic.slot}</small><span>W{topic.syllabusWeek}</span></div><strong>{topic.title}</strong><em>{attendanceLabel(topic.attendance)}</em></div>)}</div>;
}

function attendanceLabel(state: AttendanceState) {
  if (state === "attended") return "✓ Tham dự";
  if (state === "missed_excused") return "◌ Vắng có phép";
  if (state === "missed") return "! Vắng";
  if (state === "current") return "● Tiếp theo";
  return "→ Sắp tới";
}

function CollectionScreen({ student, filter, setFilter, onOpen, onPremium }: {
  student: StudentScenario;
  filter: "All" | CollectionKind;
  setFilter: (filter: "All" | CollectionKind) => void;
  onOpen: (item: CollectionItem) => void;
  onPremium: () => void;
}) {
  const matches = (item: CollectionItem) => filter === "All" || item.kind === filter;
  const freeItems = student.collection.filter((item) => item.tier === "FREE" && matches(item));
  const premiumItems = student.collection.filter((item) => item.tier === "PREMIUM" && matches(item));
  const trial = student.mode === "TRIAL_PREMIUM";
  const expired = student.mode === "EXPIRED_PREMIUM";
  const free = student.mode === "FREE_EXPLORE";

  return (
    <div className={styles.stack}>
      <div className={styles.pageTitle}><span className={styles.eyebrow}>Collection</span><h2>Những gì {student.shortName} đã tạo và đạt.</h2><p>Free và Premium là hai lane rõ ràng; owned history không bị xóa khi access hết hạn.</p></div>
      <div className={styles.filterRow}>{collectionKinds.map((kind) => <button key={kind} type="button" className={filter === kind ? styles.filterActive : ""} onClick={() => setFilter(kind)}>{kind}</button>)}</div>

      <CollectionLane title="Free Collection" badge="FREE" items={freeItems} locked={false} onOpen={onOpen} onPremium={onPremium} />

      <section className={`${styles.collectionLane} ${free ? styles.premiumLaneLocked : ""}`}>
        <div className={styles.laneHead}><div><span className={styles.eyebrow}>Premium Collection</span><h3>{trial ? "Đang mở trong Trial" : expired ? "History retained · new progression locked" : free ? "Mở với Premium" : "Premium learner-owned outcomes"}</h3></div>{trial && <span className={styles.trialBadge}>TRIAL</span>}{expired && <span className={styles.lockBadge}>PROGRESSION LOCKED</span>}</div>
        {premiumItems.length ? <div className={styles.collectionGrid}>{premiumItems.map((item) => { const locked = !item.owned; return <button key={item.id} type="button" className={`${styles.collectionCard} ${item.featured ? styles.collectionFeatured : ""} ${locked ? styles.collectionLocked : ""}`} onClick={locked ? onPremium : () => onOpen(item)}><span className={styles.collectionVisual}>{locked ? "🔒" : item.emoji}</span><span className={styles.collectionKind}>{item.kind}</span><strong>{item.title}</strong><small>{item.subtitle}</small><em>{item.meta}</em>{item.trial && !locked && <span className={styles.itemBadge}>TRIAL</span>}</button>; })}</div> : <div className={styles.emptyState}><span>◇</span><strong>Chưa có Premium item ở filter này.</strong></div>}
        {(free || trial || expired) && <div className={styles.laneCta}><p>{free ? "Free content vẫn xem bình thường. Premium lane được preview có chủ đích thay vì giả vờ đã sở hữu." : trial ? "Trial content đang mở thật. CTA chỉ nhắc nhẹ về continuation, không đe dọa mất achievement đã đạt." : "Owned Premium history vẫn mở; chỉ future progression/unlocks đang khóa."}</p><button type="button" className={styles.secondaryButton} onClick={onPremium}>{free ? "Khám phá Premium" : trial ? "Xem quyền lợi Premium" : "Tiếp tục Premium"}</button></div>}
      </section>

      <section className={styles.collectionDoctrine}><strong>Access expires. Achievement does not.</strong><p>Owned artwork, recording, milestone và artifact không biến mất chỉ vì Trial/Subscription kết thúc.</p></section>
    </div>
  );
}

function CollectionLane({ title, badge, items, locked, onOpen, onPremium }: { title: string; badge: string; items: CollectionItem[]; locked: boolean; onOpen: (item: CollectionItem) => void; onPremium: () => void }) {
  return <section className={styles.collectionLane}><div className={styles.laneHead}><div><span className={styles.eyebrow}>{badge}</span><h3>{title}</h3></div></div>{items.length ? <div className={styles.collectionGrid}>{items.map((item) => <button key={item.id} type="button" className={styles.collectionCard} onClick={locked ? onPremium : () => onOpen(item)}><span className={styles.collectionVisual}>{item.emoji}</span><span className={styles.collectionKind}>{item.kind}</span><strong>{item.title}</strong><small>{item.subtitle}</small><em>{item.meta}</em></button>)}</div> : <div className={styles.emptyState}><span>◇</span><strong>Chưa có item ở filter này.</strong></div>}</section>;
}

function ExploreScreen({ student, onPremium }: { student: StudentScenario; onPremium: () => void }) {
  const blocked = student.exploreStatus === "confirmed";
  return <div className={styles.stack}><div className={styles.pageTitle}><span className={styles.eyebrow}>Explore</span><h2>Quay lại PINO để thử điều mới.</h2><p>Open Studio là Explore ngoài Journey chính. Eligibility được Core quyết định.</p></div><section className={`${styles.eligibilityCard} ${blocked ? styles.eligibilityBlocked : ""}`}><span className={styles.eyebrow}>{student.membershipLabel}</span><h3>{blocked ? "Tuần này đã có Open Studio được xác nhận" : student.exploreStatus === "premium" ? "Explore benefits đang khả dụng" : "Tuần này có thể khám phá"}</h3><p>{student.exploreNote}</p>{blocked && <button type="button" className={styles.primaryButton} onClick={onPremium}>Khám phá quyền lợi Premium →</button>}</section><section className={styles.sectionBlock}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Upcoming</span><h3>Open Studio gần nhất</h3></div></div><div className={styles.osList}>{openStudioSessions.map((session) => <div key={session.id} className={styles.osCard}><span className={styles.osEmoji}>{session.emoji}</span><div><small>{session.path} · {session.age}</small><strong>{session.title}</strong><span>{session.time}</span></div><button type="button" disabled={blocked}>{blocked ? "Đã dùng" : "Yêu cầu"}</button></div>)}</div></section><section className={styles.premiumDiscoveryCard}><span className={styles.eyebrow}>Đi xa hơn Explore</span><h3>Premium biến những lần ghé PINO thành Journey dài hạn.</h3><p>Pricing/plan comparison có thể phát triển theo hướng SaaS khi pricing và payment policy được chốt.</p><button type="button" className={styles.secondaryButton} onClick={onPremium}>Xem Free vs Premium</button></section></div>;
}

function StudentSwitcher({ students, activeKey, onChoose, onClose }: { students: StudentScenario[]; activeKey: string; onChoose: (key: string) => void; onClose: () => void }) {
  return <div className={styles.sheetContent}><div className={styles.sheetTitleRow}><div><span className={styles.eyebrow}>Household</span><h3>Các bé của bạn</h3></div><button type="button" onClick={onClose}>×</button></div><div className={styles.studentList}>{students.map((candidate) => <button type="button" key={candidate.key} onClick={() => onChoose(candidate.key)}><span className={styles.avatar}>{candidate.avatar}</span><span><strong>{candidate.name}</strong><small>{candidate.membershipLabel} · {candidate.membershipNote}</small></span><em>{candidate.key === activeKey ? "●" : "○"}</em></button>)}</div><div className={styles.householdActions}><button type="button">Tài khoản phụ huynh <span>›</span></button><button type="button">Hồ sơ & bảo mật <span>›</span></button><button type="button">Đăng xuất <span>›</span></button></div></div>;
}

function PremiumSheet({ onClose }: { onClose: () => void }) {
  return <div className={styles.sheetContent}><div className={styles.sheetTitleRow}><div><span className={styles.eyebrow}>Future pricing direction</span><h3>Free vs Premium</h3></div><button type="button" onClick={onClose}>×</button></div><div className={styles.planGrid}><div className={styles.planCard}><span>FREE</span><strong>Explore</strong><ul><li>Open Studio theo eligibility hiện hành</li><li>Free Collection</li><li>Khám phá Path</li></ul></div><div className={`${styles.planCard} ${styles.planPremium}`}><span>PREMIUM</span><strong>Learn · Progress · Create · Belong</strong><ul><li>Persistent Path Journey</li><li>Premium Collection</li><li>Practice / continuation theo Path</li><li>Quyền lợi khác theo policy được duyệt</li></ul></div></div><button type="button" className={styles.primaryButton} disabled>Nâng cấp Premium · pricing chưa chốt</button><p className={styles.sheetNote}>Prototype chỉ chốt UX direction kiểu SaaS plan comparison; chưa invent giá, payment hay Premium OS quantity.</p></div>;
}

function CollectionDetail({ item, onClose }: { item: CollectionItem; onClose: () => void }) {
  return <div className={styles.sheetContent}><div className={styles.sheetTitleRow}><div><span className={styles.eyebrow}>{item.tier} · {item.kind}</span><h3>{item.title}</h3></div><button type="button" onClick={onClose}>×</button></div><div className={styles.detailVisual}>{item.emoji}</div><strong>{item.subtitle}</strong><p>{item.meta}</p><div className={styles.detailFacts}><span><small>Ownership</small><strong>{item.owned ? "Student-owned" : "Preview only"}</strong></span><span><small>Retention</small><strong>{item.owned ? "Durable" : "Not owned"}</strong></span></div></div>;
}

function TouchpointSheet({ student, onClose }: { student: StudentScenario; onClose: () => void }) {
  return <div className={styles.sheetContent}><div className={styles.sheetTitleRow}><div><span className={styles.eyebrow}>Next touchpoint</span><h3>{student.nextTouchpoint?.title ?? "PINO"}</h3></div><button type="button" onClick={onClose}>×</button></div>{student.nextTouchpoint ? <div className={styles.touchpointDetail}><span className={styles.bigGlyph}>⌂</span><strong>{student.nextTouchpoint.time}</strong><p>{student.nextTouchpoint.detail}</p><small>{student.nextTouchpoint.subtitle}</small></div> : <p>Chưa có committed physical touchpoint.</p>}</div>;
}
