"use client";

import { MouseEvent, useState } from "react";
import PinerPrototypeV4 from "./PinerPrototypeV4";
import v6 from "./piner-prototype-v6.module.css";
import v7 from "./piner-prototype-v7.module.css";

type PracticeFamily = "STARTER" | "JOURNEY" | "SPECIALTY";
type RecordingState = "idle" | "recording" | "ready" | "submitted";
type ViewerMode = "ACTIVE_PREMIUM" | "FREE" | "TRIAL_EXPIRED" | "ATTRITION";

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

type LockCopy = {
  eyebrow: string;
  title: string;
  body: string;
  retained?: string;
  cta: string;
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

function familyLabel(family: PracticeFamily) {
  if (family === "STARTER") return "KHỞI HÀNH";
  if (family === "JOURNEY") return "HÀNH TRÌNH";
  return "CHUYÊN ĐỀ";
}

function resourceFromButton(text: string, mode: ViewerMode): ViewerResource | null {
  if (!text.includes("Founder · published")) return null;
  if (text.includes("Expansion") || text.includes("Mở rộng")) return null;
  if (text.includes("Film Music Specialty") || text.includes("Film Âm nhạc Specialty") || (text.includes("CHUYÊN ĐỀ") && text.includes("Film"))) {
    return { family: "SPECIALTY", title: "Film Music Specialty", context: "Chuyên Đề · L2", mode };
  }
  if (text.includes("Giai điệu quen thuộc") || text.includes("ABC Song")) {
    return { family: "STARTER", title: text.includes("Giai điệu quen thuộc") ? "Giai điệu quen thuộc" : "ABC Song", context: "Khởi Hành · tay phải", mode };
  }
  if (text.includes("Twinkle Twinkle")) {
    return { family: "STARTER", title: "Twinkle Twinkle", context: "Khởi Hành · có thể luyện", mode };
  }
  if (text.includes("Always With Me")) {
    return { family: "JOURNEY", title: "Always With Me", context: "L4 · Cơ bản", mode };
  }
  return null;
}

function currentViewerMode(): ViewerMode {
  if (typeof document === "undefined") return "FREE";
  const scenario = document.querySelector<HTMLSelectElement>("#scenario")?.value ?? "";
  if (scenario === "leo-expired") return "TRIAL_EXPIRED";
  if (scenario === "leo-attrition") return "ATTRITION";
  if (scenario === "an-free" || scenario === "an-free-confirmed") return "FREE";
  return "ACTIVE_PREMIUM";
}

function endedAccessLabel(mode: ViewerMode) {
  if (mode === "TRIAL_EXPIRED") return "TRẢI NGHIỆM ĐÃ KẾT THÚC";
  if (mode === "ATTRITION") return "PREMIUM ĐÃ KẾT THÚC";
  return "PREMIUM";
}

function lockCopy(resource: ViewerResource): LockCopy {
  const family = familyLabel(resource.family);
  if (resource.mode === "TRIAL_EXPIRED") {
    return {
      eyebrow: "TRẢI NGHIỆM ĐÃ KẾT THÚC",
      title: `${family} vẫn được giữ trong Hành trình`,
      body: "Thời gian Trải nghiệm đã kết thúc. Tài liệu con đã thấy vẫn được lưu trong lịch sử, nhưng nội dung luyện tập Hành Trình và Chuyên Đề cần Premium đang hoạt động để mở lại.",
      retained: "Tiến độ và lịch sử của con vẫn được giữ nguyên.",
      cta: "Nâng cấp Premium →",
    };
  }
  if (resource.mode === "ATTRITION") {
    return {
      eyebrow: "PREMIUM ĐÃ KẾT THÚC",
      title: `${family} vẫn được giữ trong Hành trình`,
      body: "Gói Premium đã kết thúc. Các tài liệu Hành Trình và Chuyên Đề vẫn hiện trong lịch sử của con; tiếp tục Premium để mở lại nội dung luyện tập.",
      retained: "Không mất Thành quả, tiến độ hay lịch sử đã có.",
      cta: "Tiếp tục Premium →",
    };
  }
  return {
    eyebrow: "PREMIUM",
    title: `${family} thuộc phần luyện tập Premium`,
    body: "Khởi Hành vẫn có thể luyện ở chế độ Khám Phá. Hành Trình và Chuyên Đề mở khi hồ sơ có Premium đang hoạt động.",
    cta: "Khám phá Premium →",
  };
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
        <button type="button" onClick={() => setResource({ family: "JOURNEY", title: "Always With Me", context: "V7 multipage demo", mode: "ACTIVE_PREMIUM" })}>
          V7 · Active demo
        </button>
        <button type="button" onClick={() => setResource({ family: "STARTER", title: "Giai điệu quen thuộc", context: "Khởi Hành · Trải nghiệm đã kết thúc", mode: "TRIAL_EXPIRED" })}>
          V7 · Leo experience ended
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
  const [premiumUnlocked, setPremiumUnlocked] = useState(resource.mode === "ACTIVE_PREMIUM");
  const [membershipResumed, setMembershipResumed] = useState(false);
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState<RecordingState>("idle");

  const page = PAGES.find((candidate) => candidate.page === activePage) ?? PAGES[0];
  const endedAccess = resource.mode === "TRIAL_EXPIRED" || resource.mode === "ATTRITION";
  const freeAccess = resource.mode === "FREE";
  const resourceLocked = !membershipResumed && resource.family !== "STARTER" && (endedAccess || freeAccess);
  const effectivePremium = membershipResumed || premiumUnlocked;
  const worksheetAvailable = Boolean(page.worksheetUrl);
  const lockedCopy = lockCopy(resource);

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
            <span className={v6.familyBadge}>{familyLabel(resource.family)}</span>
            <strong>{resource.title}</strong>
            <small>{resource.context}</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng trình luyện tập">×</button>
        </header>

        {!landscape ? (
          <div className={v6.orientationGate}>
            <div className={v6.phoneGlyph}>↻</div>
            <h2>Lật ngang điện thoại để luyện tập</h2>
            <p>Trình luyện tập hiển thị từng câu nhạc full chiều ngang và ghép phiếu hướng dẫn tương ứng ngay bên dưới.</p>
            <button type="button" onClick={() => setLandscape(true)}>Mô phỏng đã xoay ngang →</button>
          </div>
        ) : (
          <div className={v6.landscapeWorkspace}>
            <div className={v6.stickyTools}>
              <div className={v6.viewTools}>
                <button type="button" disabled={!worksheetAvailable || resourceLocked} className={showWorksheet && worksheetAvailable && !resourceLocked ? v6.activeTool : ""} onClick={() => setShowWorksheet((value) => !value)}>
                  {!worksheetAvailable ? "Không có phiếu hướng dẫn" : showWorksheet ? "Ẩn phiếu hướng dẫn" : "Hiện phiếu hướng dẫn"}
                </button>
                <button type="button" disabled={resourceLocked} className={listening ? v6.activeTool : ""} onClick={() => setListening((value) => !value)}>
                  {listening ? "❚❚ Đang nghe" : "▶ Nghe mẫu"}
                </button>
                <button type="button" disabled={resourceLocked || recording === "submitted"} className={recording === "recording" ? v6.recordingTool : ""} onClick={toggleRecording}>
                  {recording === "recording" ? "■ Dừng ghi" : recording === "submitted" ? "✓ Đã gửi" : "● Ghi âm"}
                </button>
              </div>

              {endedAccess ? (
                <div className={v7.expiredAccessBadge} data-practice-ended-state={resource.mode === "TRIAL_EXPIRED" ? "trial" : "attrition"}>
                  <span>{endedAccessLabel(resource.mode)}</span>
                  <small>{resource.family === "STARTER" ? "Khởi Hành vẫn mở · tay phải có thể luyện" : "Hành Trình / Chuyên Đề đang khóa"}</small>
                </div>
              ) : resource.mode === "FREE" ? (
                <div className={v7.expiredAccessBadge} data-practice-ended-state="explore">
                  <span>KHÁM PHÁ · KHỞI HÀNH</span>
                  <small>Tay phải mở · hướng dẫn tay trái cần Premium</small>
                </div>
              ) : (
                <div className={v6.accessPreview}>
                  <span>Bản thử quyền truy cập</span>
                  <button type="button" className={!premiumUnlocked ? v6.accessActive : ""} onClick={() => setPremiumUnlocked(false)}>Khám Phá</button>
                  <button type="button" className={premiumUnlocked ? v6.accessActive : ""} onClick={() => setPremiumUnlocked(true)}>Premium</button>
                </div>
              )}
            </div>

            <div className={v7.pageTabs} aria-label="Các trang luyện tập">
              {PAGES.map((candidate) => (
                <button type="button" key={candidate.page} disabled={resourceLocked} className={activePage === candidate.page ? v7.pageTabActive : ""} onClick={() => {
                  setActivePage(candidate.page);
                  setRecording("idle");
                  setListening(false);
                }}>
                  <strong>Trang {candidate.page}</strong>
                  <small>{resourceLocked ? "🔒 Premium" : candidate.worksheetUrl ? "Bản nhạc + hướng dẫn" : "Chỉ bản nhạc"}</small>
                </button>
              ))}
            </div>

            {resourceLocked ? (
              <div className={v7.pageLockState} data-practice-lock-state={resource.mode.toLowerCase()}>
                <div className={v7.bigLock}>🔒</div>
                <span className={v7.lockEyebrow}>{lockedCopy.eyebrow}</span>
                <h2>{lockedCopy.title}</h2>
                <p>{lockedCopy.body}</p>
                {lockedCopy.retained && <div className={v7.retainedNote}>✓ {lockedCopy.retained}</div>}
                <button type="button" onClick={resumePremium}>{lockedCopy.cta}</button>
              </div>
            ) : (
              <div className={v6.phraseScroller} key={activePage}>
                {ROWS.map((rowIndex) => (
                  <article className={v6.phrasePair} key={rowIndex}>
                    <div className={v6.phraseHeading}>
                      <span>Câu {rowIndex + 1}</span>
                      <small>{showWorksheet && worksheetAvailable ? "Bản nhạc + bàn phím hướng dẫn" : "Chỉ bản nhạc"}</small>
                    </div>

                    <RowCrop src={page.sheetUrl} rowIndex={rowIndex} alt={`${resource.title} trang ${activePage} câu ${rowIndex + 1}`} />

                    {showWorksheet && page.worksheetUrl && (
                      <div className={v6.worksheetRow}>
                        <RowCrop src={page.worksheetUrl} rowIndex={rowIndex} alt={`${resource.title} phiếu hướng dẫn trang ${activePage} câu ${rowIndex + 1}`} />
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

            {!resourceLocked && recording === "ready" && <button type="button" className={v6.submitButton} onClick={() => setRecording("submitted")}>Gửi bài luyện tập →</button>}
            {!resourceLocked && recording === "submitted" && (
              <div className={v6.submitNotice}>
                <strong>Đã gửi bài luyện tập</strong>
                <span>PINO đã nhận bài để mentor xem lại. Việc gửi bài không tự thay đổi cấp độ của con.</span>
              </div>
            )}

            <footer className={v6.viewerFooter}>
              <span>Nội dung do PINO quản lý</span>
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
      <img src={src} alt={alt} draggable={false} style={{ top: `${-rowIndex * 100}%` }} />
    </div>
  );
}