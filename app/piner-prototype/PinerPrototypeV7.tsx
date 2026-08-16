"use client";

import { MouseEvent, useState } from "react";
import PinerPrototypeV4 from "./PinerPrototypeV4";
import v6 from "./piner-prototype-v6.module.css";
import v7 from "./piner-prototype-v7.module.css";

type PracticeFamily = "STARTER" | "JOURNEY" | "SPECIALTY";
type RecordingState = "idle" | "recording" | "ready" | "submitted";
type ViewerMode = "ACTIVE" | "EXPIRED_TRIAL";

type ViewerResource = {
  family: PracticeFamily;
  title: string;
  context: string;
  mode: ViewerMode;
};

type PracticePage = {
  page: number;
  sheetUrl: string;
  worksheetUrl?: string;
};

const SHEET_URL = "https://assets.pinohouse.art/draft/Piano%20Sheet%20-%20176.250%20(1).png";
const WORKSHEET_URL = "https://assets.pinohouse.art/draft/Piano%20Sheet%20-%20176.250.png";
const ROWS = Array.from({ length: 8 }, (_, index) => index);

// V7 deliberately reuses the supplied sample assets for pages 2-4 so the
// multipage/access interaction can be reviewed before real page assets exist.
const PAGES: PracticePage[] = [
  { page: 1, sheetUrl: SHEET_URL, worksheetUrl: WORKSHEET_URL },
  { page: 2, sheetUrl: SHEET_URL, worksheetUrl: WORKSHEET_URL },
  { page: 3, sheetUrl: SHEET_URL, worksheetUrl: WORKSHEET_URL },
  { page: 4, sheetUrl: SHEET_URL },
];

function resourceFromButton(text: string, mode: ViewerMode): ViewerResource | null {
  if (!text.includes("Founder · published")) return null;
  if (text.includes("Expansion")) return null;
  if (text.includes("Film Music Specialty")) {
    return { family: "SPECIALTY", title: "Film Music Specialty", context: "Specialty · L2", mode };
  }
  if (text.includes("ABC Song")) {
    return { family: "STARTER", title: "ABC Song", context: "Starter · đang học", mode };
  }
  if (text.includes("Twinkle Twinkle")) {
    return { family: "STARTER", title: "Twinkle Twinkle", context: "Starter · available", mode };
  }
  if (text.includes("Always With Me")) {
    return { family: "JOURNEY", title: "Always With Me", context: "L4 · Fundamental", mode };
  }
  return null;
}

function currentViewerMode(): ViewerMode {
  if (typeof document === "undefined") return "ACTIVE";
  const scenario = document.querySelector<HTMLSelectElement>("#scenario")?.value;
  return scenario === "leo-expired" ? "EXPIRED_TRIAL" : "ACTIVE";
}

export default function PinerPrototypeV7() {
  const [resource, setResource] = useState<ViewerResource | null>(null);

  function interceptPracticeOpen(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const button = target.closest("button");
    if (!button) return;
    const next = resourceFromButton(button.textContent ?? "", currentViewerMode());
    if (!next) return;

    event.preventDefault();
    event.stopPropagation();
    setResource(next);
  }

  return (
    <div className={v6.v6Root} onClickCapture={interceptPracticeOpen}>
      <PinerPrototypeV4 />

      <div className={v7.demoLauncherGroup}>
        <button
          type="button"
          onClick={() => setResource({ family: "JOURNEY", title: "Always With Me", context: "V7 multipage demo", mode: "ACTIVE" })}
        >
          V7 · Active demo
        </button>
        <button
          type="button"
          onClick={() => setResource({ family: "JOURNEY", title: "Always With Me", context: "Leo · Trial đã hết hạn", mode: "EXPIRED_TRIAL" })}
        >
          V7 · Leo expired
        </button>
      </div>

      {resource && <MultipagePracticeViewer resource={resource} onClose={() => setResource(null)} />}
    </div>
  );
}

function MultipagePracticeViewer({ resource, onClose }: { resource: ViewerResource; onClose: () => void }) {
  const [landscape, setLandscape] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [showWorksheet, setShowWorksheet] = useState(true);
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
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

  return (
    <div className={v6.viewerBackdrop}>
      <section className={v6.viewerShell}>
        <header className={v6.viewerHeader}>
          <div>
            <span className={v6.familyBadge}>{resource.family}</span>
            <strong>{resource.title}</strong>
            <small>{resource.context}</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng practice viewer">×</button>
        </header>

        {!landscape ? (
          <div className={v6.orientationGate}>
            <div className={v6.phoneGlyph}>↻</div>
            <h2>Lật ngang điện thoại để luyện tập</h2>
            <p>V7 giữ phrase-first viewer và bổ sung nhiều trang trong cùng một bài, page-level access và trường hợp trang không có worksheet.</p>
            <button type="button" onClick={() => setLandscape(true)}>Mô phỏng đã xoay ngang →</button>
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
                  {!worksheetAvailable ? "Không có worksheet" : showWorksheet ? "Ẩn worksheet" : "Hiện worksheet"}
                </button>
                <button type="button" disabled={pageLocked} className={listening ? v6.activeTool : ""} onClick={() => setListening((value) => !value)}>
                  {listening ? "❚❚ Đang nghe" : "▶ Nghe mẫu"}
                </button>
                <button type="button" disabled={pageLocked || recording === "submitted"} className={recording === "recording" ? v6.recordingTool : ""} onClick={toggleRecording}>
                  {recording === "recording" ? "■ Dừng ghi" : recording === "submitted" ? "✓ Đã gửi" : "● Ghi âm"}
                </button>
              </div>

              {resource.mode === "EXPIRED_TRIAL" && !membershipResumed ? (
                <div className={v7.expiredAccessBadge}><span>TRIAL ĐÃ HẾT HẠN</span><small>Trang 1 đã tập vẫn được giữ</small></div>
              ) : (
                <div className={v6.accessPreview}>
                  <span>Prototype access</span>
                  <button type="button" className={!premiumUnlocked ? v6.accessActive : ""} onClick={() => setPremiumUnlocked(false)}>Free</button>
                  <button type="button" className={premiumUnlocked ? v6.accessActive : ""} onClick={() => setPremiumUnlocked(true)}>Premium</button>
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
                    <small>{locked ? "🔒 Premium" : candidate.worksheetUrl ? "Sheet + worksheet" : "Sheet only"}</small>
                  </button>
                );
              })}
            </div>

            <div className={v6.viewerHint}>
              <strong>{pageLocked ? `Trang ${activePage} đang khóa` : `Trang ${activePage} · tập theo từng câu`}</strong>
              <span>{worksheetAvailable ? "Bản nhạc full width · worksheet ngay bên dưới từng câu." : "Trang này chỉ có sheet; không cần worksheet."}</span>
            </div>

            {pageLocked ? (
              <div className={v7.pageLockState}>
                <div className={v7.bigLock}>🔒</div>
                <span className={v7.lockEyebrow}>TRIAL ĐÃ HẾT HẠN</span>
                <h2>Trang {activePage} thuộc phần luyện tập Premium</h2>
                <p>Leo vẫn xem được Trang 1 của bài đã tập qua. Các trang tiếp theo mở lại khi tiếp tục Premium.</p>
                <button type="button" onClick={resumePremium}>Tiếp tục với Premium →</button>
                <small>Prototype: CTA này mô phỏng trạng thái đã nâng cấp để review phần nội dung sau lock.</small>
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
              <button type="button" className={v6.submitButton} onClick={() => setRecording("submitted")}>Gửi bài luyện tập →</button>
            )}
            {!pageLocked && recording === "submitted" && (
              <div className={v6.submitNotice}>
                <strong>Đã gửi bài luyện tập</strong>
                <span>Submission không tự tăng level; đây là practice/evidence candidate để xử lý tiếp.</span>
              </div>
            )}

            <footer className={v6.viewerFooter}>
              <span>Founder-managed assets</span>
              <small>V7 mock: Trang 2-4 đang reuse sample Sheet PNG để test multipage UX; Trang 4 mô phỏng resource không có Worksheet PNG. Production access state lấy từ Core.</small>
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
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{ top: `${-rowIndex * 100}%` }}
      />
    </div>
  );
}
