"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./piner-prototype.module.css";
import {
  CollectionItem,
  CollectionKind,
  HomeCondition,
  PathKey,
  StudentScenario,
  householdKeys,
  openStudioSessions,
  scenarios,
} from "./fixtures";

type AppTab = "home" | "journey" | "collection" | "explore";
type Overlay =
  | { type: "students" }
  | { type: "premium" }
  | { type: "collection"; item: CollectionItem }
  | { type: "touchpoint" }
  | null;

const tabLabels: Array<{ key: AppTab; label: string; icon: string }> = [
  { key: "home", label: "Home", icon: "⌂" },
  { key: "journey", label: "Journey", icon: "◇" },
  { key: "collection", label: "Collection", icon: "▦" },
  { key: "explore", label: "Explore", icon: "✦" },
];

const collectionKinds: Array<"All" | CollectionKind> = [
  "All",
  "Artwork",
  "Music",
  "Milestone",
  "Moment",
];

function modeLabel(mode: StudentScenario["mode"]) {
  if (mode === "ACTIVE_PREMIUM") return "Active Premium";
  if (mode === "TRIAL_PREMIUM") return "Trial Premium";
  if (mode === "EXPIRED_PREMIUM") return "Expired Premium";
  return "Free Explore";
}

function getScenario(key: string) {
  return scenarios.find((scenario) => scenario.key === key) ?? scenarios[0];
}

export default function PinerPrototype() {
  const [scenarioKey, setScenarioKey] = useState("minh-premium");
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [homeCondition, setHomeCondition] = useState<HomeCondition>("normal");
  const [activePath, setActivePath] = useState<PathKey | null>("PIANOHOUSE");
  const [collectionFilter, setCollectionFilter] = useState<"All" | CollectionKind>("All");
  const [overlay, setOverlay] = useState<Overlay>(null);

  const student = useMemo(() => getScenario(scenarioKey), [scenarioKey]);

  useEffect(() => {
    setActivePath(student.defaultPath);
    setActiveTab("home");
    setHomeCondition("normal");
    setCollectionFilter("All");
    setOverlay(null);
  }, [student.key, student.defaultPath]);

  const householdStudents = useMemo(() => {
    const base = householdKeys.map(getScenario);
    if (base.some((item) => item.key === student.key)) return base;
    return [student, ...base];
  }, [student]);

  function chooseScenario(nextKey: string) {
    setScenarioKey(nextKey);
  }

  function goTo(tab: AppTab) {
    setActiveTab(tab);
    setOverlay(null);
  }

  return (
    <main className={styles.prototypePage}>
      <aside className={styles.labPanel} aria-label="Prototype controls">
        <div className={styles.labBadge}>LOCAL PROTOTYPE</div>
        <h1>Piner Member Space</h1>
        <p className={styles.labIntro}>
          Mock data only. Dùng panel này để review các state trước khi backend/API được implement.
        </p>

        <label className={styles.controlLabel} htmlFor="scenario">
          Student / membership state
        </label>
        <select
          id="scenario"
          className={styles.controlSelect}
          value={scenarioKey}
          onChange={(event) => chooseScenario(event.target.value)}
        >
          {scenarios.map((scenario) => (
            <option key={scenario.key} value={scenario.key}>
              {scenario.name} — {scenario.membershipLabel} · {scenario.membershipNote}
            </option>
          ))}
        </select>

        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Home condition</span>
          <div className={styles.segmented}>
            {(["normal", "imminent", "fresh"] as HomeCondition[]).map((condition) => (
              <button
                type="button"
                key={condition}
                className={homeCondition === condition ? styles.segmentActive : ""}
                onClick={() => {
                  setHomeCondition(condition);
                  setActiveTab("home");
                }}
              >
                {condition === "normal" ? "Normal" : condition === "imminent" ? "≤4h" : "Fresh"}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Jump to screen</span>
          <div className={styles.screenButtons}>
            {tabLabels.map((tab) => (
              <button key={tab.key} type="button" onClick={() => goTo(tab.key)}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.labNotes}>
          <strong>Prototype doctrine</strong>
          <span>Parent owns account. Student owns experience.</span>
          <span>Core owns truth. Piner renders it.</span>
          <span>Access expires. Achievement does not.</span>
        </div>
      </aside>

      <section className={styles.deviceStage}>
        <div className={styles.device}>
          <header className={styles.appHeader}>
            <button className={styles.studentButton} type="button" onClick={() => setOverlay({ type: "students" })}>
              <span className={styles.avatar}>{student.avatar}</span>
              <span className={styles.studentMeta}>
                <strong>{student.name}</strong>
                <small>
                  {student.membershipLabel} · {student.membershipNote}
                </small>
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
                onJourney={() => goTo("journey")}
                onCollection={() => goTo("collection")}
                onExplore={() => goTo("explore")}
                onPremium={() => setOverlay({ type: "premium" })}
                onTouchpoint={() => setOverlay({ type: "touchpoint" })}
              />
            )}
            {activeTab === "journey" && (
              <JourneyScreen
                student={student}
                activePath={activePath}
                setActivePath={setActivePath}
                onPremium={() => setOverlay({ type: "premium" })}
              />
            )}
            {activeTab === "collection" && (
              <CollectionScreen
                student={student}
                filter={collectionFilter}
                setFilter={setCollectionFilter}
                onOpen={(item) => setOverlay({ type: "collection", item })}
              />
            )}
            {activeTab === "explore" && (
              <ExploreScreen student={student} onPremium={() => setOverlay({ type: "premium" })} />
            )}
          </div>

          <nav className={styles.bottomNav} aria-label="Piner navigation">
            {tabLabels.map((tab) => (
              <button
                type="button"
                key={tab.key}
                className={activeTab === tab.key ? styles.navActive : ""}
                onClick={() => goTo(tab.key)}
              >
                <span>{tab.icon}</span>
                <small>{tab.label}</small>
              </button>
            ))}
          </nav>

          {overlay && (
            <div className={styles.overlayBackdrop} onMouseDown={() => setOverlay(null)}>
              <div className={styles.sheet} onMouseDown={(event) => event.stopPropagation()}>
                <div className={styles.sheetHandle} />
                {overlay.type === "students" && (
                  <StudentSwitcher
                    students={householdStudents}
                    activeKey={student.key}
                    onChoose={(key) => {
                      chooseScenario(key);
                      setOverlay(null);
                    }}
                    onClose={() => setOverlay(null)}
                  />
                )}
                {overlay.type === "premium" && <PremiumSheet onClose={() => setOverlay(null)} />}
                {overlay.type === "collection" && (
                  <CollectionDetail item={overlay.item} onClose={() => setOverlay(null)} />
                )}
                {overlay.type === "touchpoint" && (
                  <TouchpointSheet student={student} onClose={() => setOverlay(null)} />
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function HomeScreen({
  student,
  condition,
  onJourney,
  onCollection,
  onExplore,
  onPremium,
  onTouchpoint,
}: {
  student: StudentScenario;
  condition: HomeCondition;
  onJourney: () => void;
  onCollection: () => void;
  onExplore: () => void;
  onPremium: () => void;
  onTouchpoint: () => void;
}) {
  const isFree = student.mode === "FREE_EXPLORE";
  const isExpired = student.mode === "EXPIRED_PREMIUM";
  const canPromoteTouchpoint = condition === "imminent" && student.nextTouchpoint;
  const promoteFresh = condition === "fresh" && student.collection.length > 0;

  let eyebrow = student.home.eyebrow;
  let title = student.home.title;
  let description = student.home.description;
  let cta = student.home.cta;
  let meta = student.home.meta;
  let action = isFree && student.exploreStatus === "eligible" ? onExplore : isExpired ? onCollection : () => undefined;

  if (!isFree && !isExpired) {
    action = student.paths.length ? onJourney : onExplore;
  }

  if (canPromoteTouchpoint && student.nextTouchpoint) {
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
    <div className={styles.screenStack}>
      <section className={`${styles.heroCard} ${isFree ? styles.heroFree : ""} ${isExpired ? styles.heroExpired : ""}`}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
        <button type="button" className={styles.primaryButton} onClick={action}>
          {cta} <span>→</span>
        </button>
        <small>{meta}</small>
      </section>

      {student.paths.length > 0 ? (
        <section className={styles.sectionBlock}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>Journey glance</span>
              <h3>Con đang ở đâu?</h3>
            </div>
            <button type="button" className={styles.textButton} onClick={onJourney}>
              Mở Journey
            </button>
          </div>
          <div className={styles.journeyGlanceGrid}>
            {student.paths.map((path) => (
              <button type="button" className={styles.glanceCard} key={path.key} onClick={onJourney}>
                <span className={styles.pathMark}>{path.key === "PIANOHOUSE" ? "♬" : path.key === "ARTCHITECT" ? "✎" : "✿"}</span>
                <strong>{path.label}</strong>
                <small>{path.summary}</small>
                <MiniJourney path={path.key} student={student} />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className={styles.aspirationCard}>
          <span className={styles.eyebrow}>Journey</span>
          <h3>Journey bắt đầu khi con bước vào một Path Premium.</h3>
          <p>Free vẫn là một trải nghiệm khám phá hoàn chỉnh — không có progress giả hay một màn hình toàn ổ khóa.</p>
          <button type="button" className={styles.secondaryButton} onClick={onPremium}>
            Khám phá Premium
          </button>
        </section>
      )}

      {student.collection.length > 0 && (
        <section className={styles.sectionBlock}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>Fresh / meaningful</span>
              <h3>{student.home.freshTitle}</h3>
            </div>
            <button type="button" className={styles.textButton} onClick={onCollection}>
              Collection
            </button>
          </div>
          <button type="button" className={styles.freshCard} onClick={onCollection}>
            <span className={styles.freshArt}>{student.home.freshEmoji}</span>
            <span>
              <strong>{student.home.freshTitle}</strong>
              <small>{student.home.freshDescription}</small>
            </span>
            <span className={styles.arrow}>→</span>
          </button>
        </section>
      )}

      <section className={styles.returnCard}>
        <div>
          <span className={styles.eyebrow}>Return to PINO</span>
          <h3>{student.nextTouchpoint ? student.nextTouchpoint.time : "Khám phá một buổi phù hợp"}</h3>
          <p>
            {student.nextTouchpoint
              ? `${student.nextTouchpoint.title} · ${student.nextTouchpoint.detail}`
              : student.exploreNote}
          </p>
        </div>
        <button type="button" className={styles.circleButton} onClick={student.nextTouchpoint ? onTouchpoint : onExplore}>
          →
        </button>
      </section>

      {(student.mode === "TRIAL_PREMIUM" || isExpired || (isFree && student.exploreStatus === "confirmed")) && (
        <section className={styles.noticeCard}>
          <span>{student.mode === "TRIAL_PREMIUM" ? "Trial" : isExpired ? "Journey retained" : "Free weekly limit"}</span>
          <p>
            {student.mode === "TRIAL_PREMIUM"
              ? "Trial đang dùng Journey Premium thật. Progress hợp lệ trong Trial là lịch sử thật của Student."
              : isExpired
                ? "Những gì đã đạt vẫn được giữ lại. Chỉ progression mới tạm dừng khi access hết hạn."
                : "Tuần này đã có một Open Studio Free được xác nhận. Có thể khám phá Premium để mở thêm quyền lợi."}
          </p>
          <button type="button" className={styles.textButton} onClick={onPremium}>
            {student.mode === "TRIAL_PREMIUM" ? "Hiểu về Premium" : "Khám phá Premium"}
          </button>
        </section>
      )}
    </div>
  );
}

function MiniJourney({ path, student }: { path: PathKey; student: StudentScenario }) {
  if (path === "PIANOHOUSE") {
    const active = student.mode === "EXPIRED_PREMIUM" ? 4 : 4;
    return (
      <div className={styles.miniDots} aria-label={`PianoHouse level ${active}`}>
        {Array.from({ length: 10 }, (_, index) => (
          <span key={index} className={index < active ? styles.dotDone : index === active ? styles.dotCurrent : ""} />
        ))}
      </div>
    );
  }
  if (path === "LPA") {
    return (
      <div className={styles.miniDots}>
        {Array.from({ length: 12 }, (_, index) => (
          <span key={index} className={index < 6 ? styles.dotDone : ""} />
        ))}
      </div>
    );
  }
  if (path === "LPP") {
    return <div className={styles.miniLabel}>ABC Song · self-paced</div>;
  }
  return (
    <div className={styles.miniTree}>
      <span className={styles.treeDone}>●</span>
      <span>—</span>
      <span className={styles.treeCurrent}>◉</span>
      <span>—</span>
      <span>○</span>
    </div>
  );
}

function JourneyScreen({
  student,
  activePath,
  setActivePath,
  onPremium,
}: {
  student: StudentScenario;
  activePath: PathKey | null;
  setActivePath: (path: PathKey) => void;
  onPremium: () => void;
}) {
  if (student.paths.length === 0 || activePath === null) {
    return (
      <div className={styles.screenStack}>
        <div className={styles.pageTitle}>
          <span className={styles.eyebrow}>Journey</span>
          <h2>Hành trình dài hạn bắt đầu với Premium.</h2>
          <p>Open Studio là Explore — không tạo một curriculum journey giả cho Free.</p>
        </div>
        <div className={styles.freeJourneyPreview}>
          <div className={styles.previewFog}>
            <span>✦</span>
            <span>◇</span>
            <span>✿</span>
          </div>
          <strong>Chọn một Path, rồi progress sẽ thuộc về chính con.</strong>
          <p>PianoHouse, ArtChitect và Little Piner giữ progression khác nhau thay vì ép vào một level chung.</p>
          <button type="button" className={styles.primaryButton} onClick={onPremium}>
            Khám phá Premium →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screenStack}>
      <div className={styles.pageTitle}>
        <span className={styles.eyebrow}>Journey</span>
        <h2>Hành trình của {student.shortName}</h2>
        <p>One canonical learner state, many projections.</p>
      </div>

      {student.paths.length > 1 && (
        <div className={styles.pathSwitcher}>
          {student.paths.map((path) => (
            <button
              type="button"
              key={path.key}
              className={activePath === path.key ? styles.pathActive : ""}
              onClick={() => setActivePath(path.key)}
            >
              {path.label}
            </button>
          ))}
        </div>
      )}

      {activePath === "PIANOHOUSE" && <PianoJourney expired={student.mode === "EXPIRED_PREMIUM"} />}
      {activePath === "ARTCHITECT" && <ArtJourney trial={student.mode === "TRIAL_PREMIUM"} />}
      {activePath === "LPA" && <LittlePinerArtJourney />}
      {activePath === "LPP" && <LittlePinerPianoJourney />}
    </div>
  );
}

function PianoJourney({ expired }: { expired: boolean }) {
  const levels = Array.from({ length: 10 }, (_, index) => index + 1);
  return (
    <>
      <section className={styles.journeyHero}>
        <span className={styles.eyebrow}>Current repertoire</span>
        <div className={styles.journeyHeroRow}>
          <div>
            <h3>Always With Me</h3>
            <p>{expired ? "L4 · retained / progression paused" : "L4 · Fundamental · active"}</p>
          </div>
          <span className={styles.bigGlyph}>♬</span>
        </div>
        <div className={styles.levelLadder}>
          {levels.map((level) => (
            <div
              key={level}
              className={`${styles.levelNode} ${level <= 4 ? styles.levelDone : ""} ${level === 4 ? styles.levelCurrent : ""} ${level > 5 ? styles.levelExpansion : ""}`}
            >
              <strong>L{level}</strong>
              <small>{level <= 5 ? "Fund." : "Exp."}</small>
            </div>
          ))}
        </div>
        <p className={styles.journeyFootnote}>
          Level là per-piece state. Khi repertoire đổi, progress của piece được freeze và mở lại ở đúng vị trí khi piece quay lại.
        </p>
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>Practice support</span>
            <h3>Thứ đang mở ở L4</h3>
          </div>
        </div>
        <div className={styles.resourceGrid}>
          <div><span>♩</span><strong>Sheet</strong><small>Verse 1 + Chorus</small></div>
          <div><span>☝</span><strong>Hand map</strong><small>Two-hand guide</small></div>
          <div><span>▶</span><strong>Listen</strong><small>Reference audio</small></div>
          <div className={styles.resourceLocked}><span>◇</span><strong>Expansion</strong><small>Mở từ L6</small></div>
        </div>
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>Repertoire history</span>
            <h3>Những piece đã đi qua</h3>
          </div>
        </div>
        <div className={styles.historyList}>
          <div><span>♬</span><strong>Always With Me</strong><small>Current · L4</small></div>
          <div><span>❄</span><strong>Married Life</strong><small>Frozen · L3</small></div>
          <div><span>❄</span><strong>River Flows in You</strong><small>Frozen · L2</small></div>
        </div>
      </section>

      <section className={styles.eviCard}>
        <span className={styles.eyebrow}>EVI · music profile</span>
        <h3>Development snapshots</h3>
        <p>EVI theo dõi năng lực dài hạn qua nhiều repertoire; nó không được suy ra trực tiếp từ level của một piece.</p>
        <div className={styles.eviBars}>
          <span style={{ width: "78%" }} />
          <span style={{ width: "62%" }} />
          <span style={{ width: "70%" }} />
          <span style={{ width: "56%" }} />
          <span style={{ width: "66%" }} />
        </div>
      </section>

      <section className={styles.specialtyCard}>
        <span className={styles.eyebrow}>Separate track</span>
        <h3>Film Music Specialty</h3>
        <p>4 levels · 8 sessions. Vinyl Artifact ở milestone L2 và L4.</p>
        <div className={styles.specialtyLevels}>
          <span className={styles.specialtyDone}>L1</span>
          <span className={styles.specialtyCurrent}>L2 · Vinyl</span>
          <span>L3</span>
          <span>L4 · Vinyl</span>
        </div>
      </section>
    </>
  );
}

function ArtJourney({ trial }: { trial: boolean }) {
  const worksheets = Array.from({ length: 12 }, (_, index) => ({
    index: index + 1,
    state: index < 5 ? "done" : index === 5 ? "current" : "future",
  }));
  return (
    <>
      <section className={styles.journeyHero}>
        <span className={styles.eyebrow}>{trial ? "Trial Premium · real Journey" : "Current project"}</span>
        <div className={styles.journeyHeroRow}>
          <div>
            <h3>Khu rừng trong mơ</h3>
            <p>Illustration · L1 Explore · Silhouette & Shape</p>
          </div>
          <span className={styles.bigGlyph}>✎</span>
        </div>
        <p className={styles.journeyFootnote}>ArtChitect là rolling-entry, flexible-studio-window: learner state không phụ thuộc giờ bắt đầu của learner khác trong cùng studio.</p>
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.eyebrow}>Foundation</span><h3>12 learning sessions</h3></div>
          <small>worksheet ≠ skill</small>
        </div>
        <div className={styles.worksheetGrid}>
          {worksheets.map((worksheet) => (
            <div
              key={worksheet.index}
              className={worksheet.state === "done" ? styles.worksheetDone : worksheet.state === "current" ? styles.worksheetCurrent : ""}
            >
              <strong>{worksheet.index}</strong>
              <small>{worksheet.state === "done" ? "seen" : worksheet.state === "current" ? "now" : ""}</small>
            </div>
          ))}
        </div>
        <div className={styles.skillChips}>
          <span>Line ✓</span><span>Shape ✓</span><span>Value</span><span>Color</span><span>Composition</span><span>Texture</span>
        </div>
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.eyebrow}>Specialization roadmap</span><h3>Không có global ArtChitect level</h3></div>
        </div>
        <div className={styles.roadmap}>
          <div className={`${styles.roadNode} ${styles.roadDone}`}><small>L1</small><strong>Illustration</strong><span>Mark ✓</span></div>
          <div className={`${styles.roadNode} ${styles.roadCurrent}`}><small>L1</small><strong>Character</strong><span>Active</span></div>
          <div className={styles.roadConnector}>↘</div>
          <div className={styles.roadConnector}>↙</div>
          <div className={`${styles.roadNode} ${styles.roadLocked}`}><small>L2</small><strong>World</strong><span>Requires both L1 Marks</span></div>
          <div className={`${styles.roadNode} ${styles.roadLocked}`}><small>L2</small><strong>Deep Illustration</strong><span>Locked</span></div>
        </div>
        <div className={styles.modalityRow}><span>Traditional</span><span>Digital where configured</span></div>
      </section>

      <section className={styles.eviCard}>
        <span className={styles.eyebrow}>EVI · visual-art profile</span>
        <h3>Longitudinal development</h3>
        <p>Roadmap Mark nói learner đã hoàn tất curriculum milestone nào; EVI nói underlying capability đang phát triển ra sao.</p>
        <div className={styles.eviBars}>
          <span style={{ width: "66%" }} /><span style={{ width: "74%" }} /><span style={{ width: "58%" }} /><span style={{ width: "82%" }} /><span style={{ width: "61%" }} />
        </div>
      </section>
    </>
  );
}

function LittlePinerArtJourney() {
  return (
    <>
      <section className={styles.journeyHero}>
        <span className={styles.eyebrow}>Personal attended-session journey</span>
        <div className={styles.journeyHeroRow}>
          <div><h3>6 / 12 buổi khám phá</h3><p>Attendance-led · không phải mastery exam</p></div>
          <span className={styles.bigGlyph}>✿</span>
        </div>
        <div className={styles.discoveryGrid}>
          {Array.from({ length: 12 }, (_, index) => {
            const number = index + 1;
            return (
              <div key={number} className={number <= 6 ? styles.discoveryDone : ""}>
                <span>{number <= 6 ? "●" : "○"}</span>
                <small>{[4, 8, 12].includes(number) ? "✿" : number}</small>
              </div>
            );
          })}
        </div>
        <p className={styles.journeyFootnote}>Little Checkpoints ở attended sessions 4, 8 và 12. Work completion không phải điều kiện để nhận participation marker.</p>
      </section>

      <section className={styles.checkpointCard}>
        <span className={styles.eyebrow}>Little Checkpoints</span>
        <div className={styles.checkpointRow}>
          <div className={styles.checkpointDone}><span>🌸</span><strong>4</strong><small>earned</small></div>
          <div className={styles.checkpointCurrent}><span>🌼</span><strong>8</strong><small>next</small></div>
          <div><span>✿</span><strong>12</strong><small>EVIP close</small></div>
        </div>
      </section>

      <section className={styles.eviCard}>
        <span className={styles.eyebrow}>EVIP / EVI snapshot</span>
        <h3>Developmental observation</h3>
        <p>Snapshot được đóng ở checkpoint cuối của personal attended-session cycle và giữ nguyên meaning/version lúc capture.</p>
        <div className={styles.eviBars}>
          <span style={{ width: "72%" }} /><span style={{ width: "64%" }} /><span style={{ width: "79%" }} /><span style={{ width: "68%" }} /><span style={{ width: "74%" }} />
        </div>
      </section>
    </>
  );
}

function LittlePinerPianoJourney() {
  return (
    <>
      <section className={styles.journeyHero}>
        <span className={styles.eyebrow}>Starter collection</span>
        <div className={styles.journeyHeroRow}>
          <div><h3>ABC Song</h3><p>Self-paced · independent LPP level definition</p></div>
          <span className={styles.bigGlyph}>♫</span>
        </div>
        <p className={styles.journeyFootnote}>Little Piner Piano không reuse PianoHouse L1–L10. Exact LPP level count/rubric vẫn là Founder-configurable definition.</p>
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Songs</span><h3>Những bài Bơ đang giữ</h3></div></div>
        <div className={styles.songList}>
          <div className={styles.songCurrent}><span>🎵</span><strong>ABC Song</strong><small>Current · worksheet mở</small></div>
          <div><span>♪</span><strong>Twinkle Twinkle</strong><small>Starter · available</small></div>
          <div className={styles.songLocked}><span>◇</span><strong>Next familiar song</strong><small>Future visibility</small></div>
        </div>
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Home support</span><h3>Practice resources</h3></div></div>
        <div className={styles.resourceGrid}>
          <div><span>♩</span><strong>Starter sheet</strong><small>Current song</small></div>
          <div><span>☝</span><strong>Hand map</strong><small>Position guide</small></div>
          <div><span>▤</span><strong>Worksheet</strong><small>Unlocked</small></div>
          <div className={styles.resourceLocked}><span>◇</span><strong>Next step</strong><small>Locked</small></div>
        </div>
      </section>

      <section className={styles.eviCard}>
        <span className={styles.eyebrow}>EVI · early-years music</span>
        <h3>Development across songs</h3>
        <p>EVI tiếp tục qua nhiều Starter songs thay vì reset theo mỗi bài.</p>
        <div className={styles.eviBars}>
          <span style={{ width: "70%" }} /><span style={{ width: "61%" }} /><span style={{ width: "76%" }} /><span style={{ width: "65%" }} /><span style={{ width: "69%" }} />
        </div>
      </section>
    </>
  );
}

function CollectionScreen({
  student,
  filter,
  setFilter,
  onOpen,
}: {
  student: StudentScenario;
  filter: "All" | CollectionKind;
  setFilter: (filter: "All" | CollectionKind) => void;
  onOpen: (item: CollectionItem) => void;
}) {
  const visibleItems = filter === "All" ? student.collection : student.collection.filter((item) => item.kind === filter);
  return (
    <div className={styles.screenStack}>
      <div className={styles.pageTitle}>
        <span className={styles.eyebrow}>Collection</span>
        <h2>Những gì {student.shortName} đã tạo và đạt.</h2>
        <p>Collection là learner-owned durable value, không phải raw staff evidence feed.</p>
      </div>

      <div className={styles.filterRow}>
        {collectionKinds.map((kind) => (
          <button type="button" key={kind} className={filter === kind ? styles.filterActive : ""} onClick={() => setFilter(kind)}>
            {kind}
          </button>
        ))}
      </div>

      {visibleItems.length ? (
        <div className={styles.collectionGrid}>
          {visibleItems.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={`${styles.collectionCard} ${item.featured || index === 0 ? styles.collectionFeatured : ""}`}
              onClick={() => onOpen(item)}
            >
              <span className={styles.collectionVisual}>{item.emoji}</span>
              <span className={styles.collectionKind}>{item.kind}</span>
              <strong>{item.title}</strong>
              <small>{item.subtitle}</small>
              <em>{item.meta}</em>
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <span>◇</span>
          <strong>Chưa có item ở nhóm này.</strong>
          <p>Không fabricate Collection content để lấp màn hình.</p>
        </div>
      )}

      <section className={styles.collectionDoctrine}>
        <strong>Access expires. Achievement does not.</strong>
        <p>Artwork, recordings, milestones và durable artifacts đã thuộc về learner vẫn ở đây khi Premium tạm dừng hoặc hết hạn.</p>
      </section>
    </div>
  );
}

function ExploreScreen({ student, onPremium }: { student: StudentScenario; onPremium: () => void }) {
  const blocked = student.exploreStatus === "confirmed";
  return (
    <div className={styles.screenStack}>
      <div className={styles.pageTitle}>
        <span className={styles.eyebrow}>Explore</span>
        <h2>Quay lại PINO để thử điều mới.</h2>
        <p>Open Studio là Explore ngoài Journey chính. Eligibility được Core quyết định.</p>
      </div>

      <section className={`${styles.eligibilityCard} ${blocked ? styles.eligibilityBlocked : ""}`}>
        <span className={styles.eyebrow}>{student.membershipLabel}</span>
        <h3>{blocked ? "Tuần này đã có Open Studio được xác nhận" : student.exploreStatus === "premium" ? "Explore benefits đang khả dụng" : "Tuần này có thể khám phá"}</h3>
        <p>{student.exploreNote}</p>
        {blocked && (
          <button type="button" className={styles.primaryButton} onClick={onPremium}>
            Khám phá quyền lợi Premium →
          </button>
        )}
      </section>

      {student.nextTouchpoint && student.nextTouchpoint.title.includes("Open Studio") && (
        <section className={styles.confirmedBooking}>
          <span className={styles.bookingStatus}>Confirmed</span>
          <strong>{student.nextTouchpoint.title}</strong>
          <small>{student.nextTouchpoint.time}</small>
          <p>{student.nextTouchpoint.detail}</p>
        </section>
      )}

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.eyebrow}>Upcoming</span><h3>Open Studio gần nhất</h3></div>
        </div>
        <div className={styles.osList}>
          {openStudioSessions.map((session) => (
            <div key={session.id} className={styles.osCard}>
              <span className={styles.osEmoji}>{session.emoji}</span>
              <div>
                <small>{session.path} · {session.age}</small>
                <strong>{session.title}</strong>
                <span>{session.time}</span>
              </div>
              <button type="button" disabled={blocked} title={blocked ? "Weekly Free allowance đã được sử dụng" : "Prototype only"}>
                {blocked ? "Đã dùng" : "Yêu cầu"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.premiumDiscoveryCard}>
        <span className={styles.eyebrow}>Đi xa hơn Explore</span>
        <h3>Premium biến những lần ghé PINO thành một Journey dài hạn.</h3>
        <p>So sánh Free và Premium theo lợi ích thật; exact pricing và số lượng access chưa được hard-code trong prototype.</p>
        <button type="button" className={styles.secondaryButton} onClick={onPremium}>
          Xem Free vs Premium
        </button>
      </section>
    </div>
  );
}

function StudentSwitcher({
  students,
  activeKey,
  onChoose,
  onClose,
}: {
  students: StudentScenario[];
  activeKey: string;
  onChoose: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <div className={styles.sheetContent}>
      <div className={styles.sheetTitleRow}>
        <div><span className={styles.eyebrow}>Household</span><h3>Các bé của bạn</h3></div>
        <button type="button" onClick={onClose}>×</button>
      </div>
      <div className={styles.studentList}>
        {students.map((candidate) => (
          <button type="button" key={candidate.key} onClick={() => onChoose(candidate.key)}>
            <span className={styles.avatar}>{candidate.avatar}</span>
            <span><strong>{candidate.name}</strong><small>{candidate.membershipLabel} · {candidate.membershipNote}</small></span>
            <em>{candidate.key === activeKey ? "●" : "○"}</em>
          </button>
        ))}
      </div>
      <div className={styles.householdActions}>
        <button type="button">Tài khoản phụ huynh <span>›</span></button>
        <button type="button">Hồ sơ & bảo mật <span>›</span></button>
        <button type="button">Đăng xuất <span>›</span></button>
      </div>
      <p className={styles.sheetNote}>Switching Student reloads Home, Journey, Collection và Explore. Sibling state không được merge.</p>
    </div>
  );
}

function PremiumSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.sheetContent}>
      <div className={styles.sheetTitleRow}>
        <div><span className={styles.eyebrow}>Future pricing direction</span><h3>Free vs Premium</h3></div>
        <button type="button" onClick={onClose}>×</button>
      </div>
      <div className={styles.planGrid}>
        <div className={styles.planCard}>
          <span>FREE</span>
          <strong>Explore</strong>
          <ul>
            <li>Open Studio theo eligibility hiện hành</li>
            <li>Free souvenirs khi có</li>
            <li>Khám phá các Path</li>
          </ul>
        </div>
        <div className={`${styles.planCard} ${styles.planPremium}`}>
          <span>PREMIUM</span>
          <strong>Learn · Progress · Create · Belong</strong>
          <ul>
            <li>Persistent Path Journey</li>
            <li>Continue / practice theo Path</li>
            <li>Long-term Collection & milestones</li>
            <li>Thêm quyền lợi tham gia theo policy được duyệt</li>
          </ul>
        </div>
      </div>
      <button type="button" className={styles.primaryButton} disabled>
        Nâng cấp Premium · pricing chưa chốt
      </button>
      <p className={styles.sheetNote}>Prototype chỉ chốt direction kiểu SaaS plan comparison; chưa invent giá, billing hay số Open Studio Premium.</p>
    </div>
  );
}

function CollectionDetail({ item, onClose }: { item: CollectionItem; onClose: () => void }) {
  return (
    <div className={styles.sheetContent}>
      <div className={styles.sheetTitleRow}>
        <div><span className={styles.eyebrow}>{item.kind}</span><h3>{item.title}</h3></div>
        <button type="button" onClick={onClose}>×</button>
      </div>
      <div className={styles.detailVisual}>{item.emoji}</div>
      <strong className={styles.detailSubtitle}>{item.subtitle}</strong>
      <p>{item.meta}</p>
      <div className={styles.detailFacts}>
        <span><small>Ownership</small><strong>Student-owned</strong></span>
        <span><small>Retention</small><strong>Durable</strong></span>
      </div>
      <p className={styles.sheetNote}>Raw internal review, evidence obligations và audit trail vẫn ở TOS/Core; Collection chỉ render learner-facing durable outcome.</p>
    </div>
  );
}

function TouchpointSheet({ student, onClose }: { student: StudentScenario; onClose: () => void }) {
  return (
    <div className={styles.sheetContent}>
      <div className={styles.sheetTitleRow}>
        <div><span className={styles.eyebrow}>Next touchpoint</span><h3>{student.nextTouchpoint?.title ?? "PINO"}</h3></div>
        <button type="button" onClick={onClose}>×</button>
      </div>
      {student.nextTouchpoint ? (
        <div className={styles.touchpointDetail}>
          <span className={styles.bigGlyph}>⌂</span>
          <strong>{student.nextTouchpoint.time}</strong>
          <p>{student.nextTouchpoint.detail}</p>
          <small>{student.nextTouchpoint.subtitle}</small>
        </div>
      ) : (
        <p>Chưa có committed physical touchpoint.</p>
      )}
      <p className={styles.sheetNote}>Piner không surface internal attendance/session IDs ở đây; chỉ learner/parent-readable context.</p>
    </div>
  );
}
