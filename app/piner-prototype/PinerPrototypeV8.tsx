"use client";

import { FormEvent, MouseEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PinerPrototypeV4 from "./PinerPrototypeV4";
import v6 from "./piner-prototype-v6.module.css";
import v7 from "./piner-prototype-v7.module.css";
import v8 from "./piner-prototype-v8.module.css";

const PINER_ICON_BASE = "https://assets.pinohouse.art/site/shared/piner-space-icon-";

function PinerGlyph({ name, size = 18 }: { name: string; size?: number }) {
  return (
    // Native img keeps the shared R2 SVG pack provider-neutral for this prototype.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`${PINER_ICON_BASE}${name}.svg`} alt="" aria-hidden="true" width={size} height={size} />
  );
}

type PracticeFamily = "STARTER" | "JOURNEY" | "SPECIALTY";
type RecordingState = "idle" | "recording" | "ready" | "submitted";
type ViewerMode = "ACTIVE" | "EXPIRED_TRIAL";
type AppSurface = "home" | "journey" | "collection" | "explore";
type PracticeLoopStage = "SUBMITTED" | "ACKNOWLEDGED";

type ViewerResource = {
  family: PracticeFamily;
  title: string;
  context: string;
  mode: ViewerMode;
  premiumAccess: boolean;
};

type PracticePage = {
  page: number;
  sheetUrl: string;
  worksheetUrl?: string;
};

type PracticeLoopState = {
  stage: PracticeLoopStage;
  title: string;
  page: number;
  context: string;
};

const SHEET_URL = "https://assets.pinohouse.art/draft/Piano%20Sheet%20-%20176.250%20(1).png";
const WORKSHEET_URL = "https://assets.pinohouse.art/draft/Piano%20Sheet%20-%20176.250.png";
const ROWS = Array.from({ length: 8 }, (_, index) => index);

const PAGES: PracticePage[] = [
  { page: 1, sheetUrl: SHEET_URL, worksheetUrl: WORKSHEET_URL },
  { page: 2, sheetUrl: SHEET_URL, worksheetUrl: WORKSHEET_URL },
  { page: 3, sheetUrl: SHEET_URL, worksheetUrl: WORKSHEET_URL },
  { page: 4, sheetUrl: SHEET_URL },
];

function resourceFromButton(button: HTMLButtonElement, mode: ViewerMode, premiumAccess: boolean): ViewerResource | null {
  if (button.dataset.v21PracticeCard !== "true" || button.dataset.v18Access === "locked") return null;
  const text = button.textContent ?? "";
  const family = button.dataset.v18Family;
  if (family === "starter") {
    const title = text.includes("Twinkle Twinkle") ? "Twinkle Twinkle" : "ABC Song";
    return { family: "STARTER", title, context: "Khởi Hành · đang học", mode, premiumAccess };
  }
  if (family === "specialty") return { family: "SPECIALTY", title: "Chuyên đề nhạc phim", context: "Chuyên Đề · L2", mode, premiumAccess };
  if (family === "journey") return { family: "JOURNEY", title: "Always With Me", context: "L4 · Cơ bản", mode, premiumAccess };
  return null;
}

function currentViewerMode(): ViewerMode {
  if (typeof document === "undefined") return "ACTIVE";
  return document.querySelector<HTMLSelectElement>("#scenario")?.value === "leo-expired" ? "EXPIRED_TRIAL" : "ACTIVE";
}

const PREMIUM_PRACTICE_SCENARIOS = new Set(["minh-premium", "mia-lpa", "han-trial-ac", "leo-trial", "leo-reenrolled", "bo-lpp"]);
function currentViewerPremiumAccess() {
  if (typeof document === "undefined") return false;
  const key = document.querySelector<HTMLSelectElement>("#scenario")?.value ?? "";
  return PREMIUM_PRACTICE_SCENARIOS.has(key);
}

function surfaceFromButton(text: string): AppSurface | null {
  if (text.includes("Home") || text.includes("Trang chủ")) return "home";
  if (text.includes("Journey") || text.includes("Hành trình")) return "journey";
  if (text.includes("Collection") || text.includes("Thành quả")) return "collection";
  if (text.includes("Explore") || text.includes("Khám phá")) return "explore";
  return null;
}

export default function PinerPrototypeV8() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [resource, setResource] = useState<ViewerResource | null>(null);
  const [surface, setSurface] = useState<AppSurface>("home");
  const [practiceLoop, setPracticeLoop] = useState<PracticeLoopState | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const nav = rootRef.current?.querySelector("nav");
    const screen = nav?.previousElementSibling;
    setPortalTarget(screen instanceof HTMLElement ? screen : null);
  }, []);

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const button = target.closest("button");
    if (!button) return;
    const text = button.textContent ?? "";

    const nextSurface = surfaceFromButton(text);
    if (nextSurface) setSurface(nextSurface);

    const next = resourceFromButton(button, currentViewerMode(), currentViewerPremiumAccess());
    if (!next) return;

    event.preventDefault();
    event.stopPropagation();
    setSurface("journey");
    setResource(next);
  }

  function handleChangeCapture(event: FormEvent<HTMLDivElement>) {
    const target = event.target as HTMLSelectElement;
    if (target.id !== "scenario") return;
    setPracticeLoop(null);
    setSurface("home");
  }

  function openDemo(mode: ViewerMode) {
    setSurface("journey");
    setResource({
      family: "JOURNEY",
      title: "Always With Me",
      context: mode === "EXPIRED_TRIAL" ? "Leo · Trial đã hết hạn" : "L4 · Fundamental",
      mode,
      premiumAccess: mode === "ACTIVE",
    });
  }

  function acknowledgePractice() {
    setPracticeLoop((current) => current ? { ...current, stage: "ACKNOWLEDGED" } : current);
  }

  return (
    <div ref={rootRef} className={v6.v6Root} onClickCapture={handleClickCapture} onChangeCapture={handleChangeCapture}>
      <PinerPrototypeV4 />

      <div className={v7.demoLauncherGroup}>
        <button type="button" onClick={() => openDemo("ACTIVE")}>V8 · Practice loop</button>
        <button type="button" onClick={() => openDemo("EXPIRED_TRIAL")}>V8 · Leo expired</button>
        {practiceLoop && <button type="button" onClick={() => setPracticeLoop(null)}>Reset practice</button>}
      </div>

      {portalTarget && practiceLoop && !resource && (surface === "home" || surface === "journey") && createPortal(
        <PracticeContinuityCard state={practiceLoop} surface={surface} onAcknowledge={acknowledgePractice} />,
        portalTarget,
      )}

      {resource && (
        <MultipagePracticeViewer
          resource={resource}
          onClose={() => setResource(null)}
          onSubmitted={(page) => setPracticeLoop({
            stage: "SUBMITTED",
            title: resource.title,
            page,
            context: resource.context,
          })}
        />
      )}
    </div>
  );
}

function PracticeContinuityCard({ state, surface, onAcknowledge }: {
  state: PracticeLoopState;
  surface: AppSurface;
  onAcknowledge: () => void;
}) {
  const acknowledged = state.stage === "ACKNOWLEDGED";
  return (
    <section className={`${v8.continuityCard} ${acknowledged ? v8.continuityAcknowledged : ""}`}>
      <div className={v8.continuityIcon}>{acknowledged ? "✓" : "●"}</div>
      <div className={v8.continuityCopy}>
        <span>{surface === "home" ? "Luyện tập gần đây" : "Practice continuity"}</span>
        <strong>{acknowledged ? "PINO đã ghi nhận bài luyện tập" : "Đã gửi bài luyện tập"}</strong>
        <p>{state.title} · Trang {state.page} · {state.context}</p>
        <small>{acknowledged ? "Journey vẫn giữ nguyên level cho đến khi có Assessment/Achievement hợp lệ." : "Submission đang chờ được xem. Không tự level-up và chưa tự trở thành Collection item."}</small>
      </div>
      {state.stage === "SUBMITTED" && (
        <button type="button" onClick={onAcknowledge}>Mô phỏng PINO ghi nhận →</button>
      )}
    </section>
  );
}

function MultipagePracticeViewer({ resource, onClose, onSubmitted }: {
  resource: ViewerResource;
  onClose: () => void;
  onSubmitted: (page: number) => void;
}) {
  const [landscape, setLandscape] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [showWorksheet, setShowWorksheet] = useState(true);
  const [premiumUnlocked, setPremiumUnlocked] = useState(resource.premiumAccess);
  const [membershipResumed, setMembershipResumed] = useState(false);
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState<RecordingState>("idle");

  const page = PAGES.find((candidate) => candidate.page === activePage) ?? PAGES[0];
  const expiredTrial = resource.mode === "EXPIRED_TRIAL" && !membershipResumed;
  const pageLocked = expiredTrial && activePage > 1;
  const retainedTrialPage = expiredTrial && activePage === 1;
  const effectivePremium = premiumUnlocked || retainedTrialPage || membershipResumed;
  const worksheetAvailable = Boolean(page.worksheetUrl);

  function toggleRecording() {
    if (recording === "recording") setRecording("ready");
    else setRecording("recording");
  }

  function resumePremium() {
    setMembershipResumed(true);
    setPremiumUnlocked(true);
  }

  function submitPractice() {
    setRecording("submitted");
    onSubmitted(activePage);
  }

  return (
    <div className={v6.viewerBackdrop}>
      <section className={v6.viewerShell}>
        <header className={v6.viewerHeader}>
          <div>
            <span className={v6.familyBadge}>{resource.family}</span>
            <strong>{resource.title}</strong>
            <small>{resource.context}</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng trình luyện tập"><PinerGlyph name="close" /></button>
        </header>

        {!landscape ? (
          <div className={v6.orientationGate}>
            <div className={v6.phoneGlyph}><PinerGlyph name="practice-rotate" size={42} /></div>
            <h2>Lật ngang điện thoại để luyện tập</h2>
            <p>Xoay ngang để xem bản nhạc rõ hơn, nghe mẫu và ghi lại phần luyện tập của con.</p>
            <button type="button" onClick={() => setLandscape(true)}><PinerGlyph name="practice-rotate" /> <span>Đã xoay ngang</span></button>
          </div>
        ) : (
          <div className={v6.landscapeWorkspace}>
            <div className={v6.stickyTools}>
              <div className={v6.viewTools}>
                <button
                  type="button"
                  disabled={!worksheetAvailable || pageLocked}
                  className={showWorksheet && worksheetAvailable && !pageLocked ? v6.activeTool : ""}
                  onClick={() => setShowWorksheet((value) => !value)}
                >
                  <PinerGlyph name="practice-sheet" /> <span>{!worksheetAvailable ? "Không có hướng dẫn" : showWorksheet ? "Ẩn hướng dẫn" : "Hiện hướng dẫn"}</span>
                </button>
                <button type="button" disabled={pageLocked} className={listening ? v6.activeTool : ""} onClick={() => setListening((value) => !value)}>
                  <PinerGlyph name={listening ? "practice-pause" : "practice-listen"} /> <span>{listening ? "Tạm dừng" : "Nghe mẫu"}</span>
                </button>
                <button type="button" disabled={pageLocked || recording === "submitted"} className={recording === "recording" ? v6.recordingTool : ""} onClick={toggleRecording}>
                  <PinerGlyph name={recording === "submitted" ? "check" : "practice-record"} /> <span>{recording === "recording" ? "Dừng ghi" : recording === "submitted" ? "Đã gửi" : "Ghi âm"}</span>
                </button>
              </div>

              {resource.mode === "EXPIRED_TRIAL" && !membershipResumed ? (
                <div className={v7.expiredAccessBadge}><span>TRIAL ĐÃ HẾT HẠN</span><small>Trang 1 đã tập vẫn được giữ</small></div>
              ) : (
                <div className={v6.accessPreview}>
                  <span>Quyền luyện tập</span>
                  <b>{effectivePremium ? "Premium" : "Khám Phá"}</b>
                </div>
              )}
            </div>

            <div className={v7.pageTabs} aria-label="Practice pages">
              {PAGES.map((candidate) => {
                const locked = expiredTrial && candidate.page > 1;
                return (
                  <button
                    type="button"
                    key={candidate.page}
                    className={activePage === candidate.page ? v7.pageTabActive : ""}
                    onClick={() => {
                      setActivePage(candidate.page);
                      setRecording("idle");
                      setListening(false);
                    }}
                  >
                    <strong>Trang {candidate.page}</strong>
                    <small>{locked ? "Premium" : candidate.worksheetUrl ? "Bản nhạc + hướng dẫn" : "Bản nhạc"}</small>
                  </button>
                );
              })}
            </div>

            <div className={v6.viewerHint}>
              <strong>{pageLocked ? `Trang ${activePage} đang khóa` : `Trang ${activePage} · tập theo từng câu`}</strong>
              <span>{worksheetAvailable ? "Bản nhạc ở trên · hướng dẫn thế tay ngay bên dưới từng câu." : "Trang này chỉ có bản nhạc."}</span>
            </div>

            {pageLocked ? (
              <div className={v7.pageLockState}>
                <div className={v7.bigLock}><PinerGlyph name="lock" size={34} /></div>
                <span className={v7.lockEyebrow}>TRIAL ĐÃ HẾT HẠN</span>
                <h2>Trang {activePage} thuộc phần luyện tập Premium</h2>
                <p>Leo vẫn xem được Trang 1 của bài đã tập qua. Các trang tiếp theo mở lại khi tiếp tục Premium.</p>
                <button type="button" onClick={resumePremium}>Tiếp tục với Premium →</button>
                <small>Tiếp tục Premium để mở lại phần luyện tập này.</small>
              </div>
            ) : (
              <div className={v6.phraseScroller} key={activePage}>
                {ROWS.map((rowIndex) => (
                  <article className={v6.phrasePair} key={rowIndex}>
                    <div className={v6.phraseHeading}>
                      <span>Câu {rowIndex + 1}</span>
                      <small>{showWorksheet && worksheetAvailable ? "Sheet + keyboard mapping" : "Sheet only"}</small>
                    </div>

                    <RowCrop src={page.sheetUrl} rowIndex={rowIndex} alt={`${resource.title} trang ${activePage} câu ${rowIndex + 1}`} />

                    {showWorksheet && page.worksheetUrl && (
                      <div className={v6.worksheetRow}>
                        <RowCrop src={page.worksheetUrl} rowIndex={rowIndex} alt={`${resource.title} worksheet trang ${activePage} câu ${rowIndex + 1}`} />
                        {!effectivePremium && (
                          <div className={`${v6.leftHandLock} ${v7.strongLeftHandLock}`}>
                            <div className={`${v6.lockMessage} ${v7.largeLockMessage}`}>
                              <span>🔒</span>
                              <strong>Mở hướng dẫn tay trái</strong>
                              <small>Premium · luyện đủ 2 tay</small>
                              <button type="button" onClick={() => setPremiumUnlocked(true)}>Khám phá Premium →</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}

            {!pageLocked && recording === "ready" && (
              <button type="button" className={v6.submitButton} onClick={submitPractice}>Gửi bài luyện tập →</button>
            )}
            {!pageLocked && recording === "submitted" && (
              <div className={`${v6.submitNotice} ${v8.viewerSubmitNotice}`}>
                <div>
                  <strong>Đã gửi bài luyện tập</strong>
                  <span>PINO đã ghi nhận bài luyện tập. Tiến trình sẽ được cập nhật sau khi giáo viên xem lại.</span>
                </div>
                <button type="button" onClick={onClose}>Quay lại Journey →</button>
              </div>
            )}

            <footer className={v6.viewerFooter}>
              <span>Luyện tập · Gửi bài · Theo dõi tiến trình</span>
              <small>Gửi bài không tự động tăng cấp; giáo viên vẫn là người xác nhận tiến trình học.</small>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}

function RowCrop({ src, rowIndex, alt }: { src: string; rowIndex: number; alt: string }) {
  return (
    <div className={v6.rowCrop}>
      {/* Native img is intentional: CSS crops one source sheet into phrase rows. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} draggable={false} style={{ top: `${-rowIndex * 100}%` }} />
    </div>
  );
}
