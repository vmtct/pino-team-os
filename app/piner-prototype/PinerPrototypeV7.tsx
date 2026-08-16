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
  if (text.includes("Expansion")) return null;
  if (text.includes("Film Music Specialty")) {
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
  if (mode === "TRIAL_EXPIRED") return "TRIAL ĐÃ HẾT HẠN";
  if (mode === "ATTRITION") return "PREMIUM ĐÃ KẾT THÚC";
  return "PREMIUM REQUIRED";
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
          onClick={() => setResource({ family: "JOURNEY", title: "Always With Me", context: "V7 multipage demo", mode: "ACTIVE_PREMIUM" })}
        >
          V7 · Active demo
        </button>
        <button
          type="button"
          onClick={() => setResource({ family: "STARTER", title: "Giai điệu quen thuộc", context: "Khởi Hành · Trial hết hạn", mode: "TRIAL_EXPIRED" })}
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
                <button
                  type="button"
                  disabled={!worksheetAvailable || resourceLocked}
                  className={showWorksheet && worksheetAvailable && !resourceLocked ? v6.activeTool : ""}
                  onClick={() => setShowWorksheet((value) => !value)}
                >
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
                <div className={v7.expiredAccessBadge}>
                  <span>{endedAccessLabel(resource.mode)}</span>
                  <small>{resource.family === "STARTER" ? "Khởi Hành vẫn mở · tay trái cần Premium" : "Hành Trình / Chuyên Đề đang khóa"}</small>
                </div>
              ) : resource.mode === "FREE" ? (
                <div className={v7.expiredAccessBadge}><span>KHỞI HÀNH · MIỄN PHÍ</span><small>Tay phải mở · tay trái cần Premium</small></div>
              ) : (
                <div className={v6.accessPreview}>
                  <span>Quyền truy cập</span>
                  <button type="button" className={!premiumUnlocked ? v6.accessActive : ""} onClick={() => setPremiumUnlocked(false)}>Miễn phí</button>
                  <button type="button" className={premiumUnlocked ? v6.accessActive : ""} onClick={() => setPremiumUnlocked(true)}>Premium</button>
                </div>
              )}
            </div>

            <div className={v7.pageTabs} aria-label="Các trang luyện tập">
              {PAGES.map((candidate) => (
                <button
                  type="button"
                  key={candidate.page}
                  disabled={resourceLocked}
                  className={activePage === candidate.page ? v7.pageTabActive : ""}
                  onClick={() => {
                    setActivePage(candidate.page);
                    setRecording("idle");
                    setListening(false);
                  }}
                >
                  <strong>Trang {candidate.page}</strong>
                  <small>{resourceLocked ? "🔒 Premium" : candidate.worksheetUrl ? "Bản nhạc + hướng dẫn" : "Chỉ bản nhạc"}</small>
                </button>
              ))}
            </div>

            <div className={v6.viewerHint}>
              <strong>{resourceLocked ? `${familyLabel(resource.family)} đang khóa` : `Trang ${activePage} · tập theo từng câu`}</strong>
              <span>{resourceLocked ? "Khởi Hành vẫn là lớp luyện tập mở; Hành Trình và Chuyên Đề cần Premium đang hoạt động." : worksheetAvailable ? "Bản nhạc full width · phiếu hướng dẫn ngay bên dưới từng câu." : "Trang này chỉ có bản nhạc; không cần phiếu hướng dẫn."}</span>
            </div>

            {resourceLocked ? (
              <div className={v7.pageLockState}>
                <div className={v7.bigLock}>🔒</div>
                <span className={v7.lockEyebrow}>{endedAccessLabel(resource.mode)}</span>
                <h2>{familyLabel(resource.family)} thuộc phần luyện tập Premium</h2>
                <p>{resource.mode === "TRIAL_EXPIRED" ? "Trial đã kết thúc. Hành Trình và Chuyên Đề đã từng xuất hiện vẫn được giữ trong lịch sử nhưng nội dung luyện tập đang khóa." : resource.mode === "ATTRITION" ? "Gói Premium đã kết thúc. Tài nguyên Hành Trình và Chuyên Đề vẫn hiện như lịch sử đã có nhưng cần tiếp tục Premium để mở lại." : "Tài nguyên này thuộc Premium. Khởi Hành vẫn có thể luyện miễn phí với phần tay trái được khóa."}</p>
                <button type="button" onClick={resumePremium}>Tiếp tục với Premium →</button>
                <small>Prototype: CTA mô phỏng khôi phục quyền Premium để review nội dung sau khi mở lại.</small>
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

            {!resourceLocked && recording === "ready" && (
              <button type="button" className={v6.submitButton} onClick={() => setRecording("submitted")}>Gửi bài luyện tập →</button>
            )}
            {!resourceLocked && recording === "submitted" && (
              <div className={v6.submitNotice}>
                <strong>Đã gửi bài luyện tập</strong>
                <span>Bài gửi không tự tăng cấp; đây là practice/evidence candidate để PINO xử lý tiếp.</span>
              </div>
            )}

            <footer className={v6.viewerFooter}>
              <span>Nội dung do PINO quản lý</span>
              <small>Prototype đang reuse sample asset cho nhiều trang để test UX. Production access state lấy từ Core.</small>
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
