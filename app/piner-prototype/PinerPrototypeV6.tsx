"use client";

import { MouseEvent, useState } from "react";
import PinerPrototypeV4 from "./PinerPrototypeV4";
import v6 from "./piner-prototype-v6.module.css";

type PracticeFamily = "STARTER" | "JOURNEY" | "SPECIALTY";
type RecordingState = "idle" | "recording" | "ready" | "submitted";

type ViewerResource = {
  family: PracticeFamily;
  title: string;
  context: string;
};

const SHEET_URL = "https://assets.pinohouse.art/draft/Piano%20Sheet%20-%20176.250%20(1).png";
const WORKSHEET_URL = "https://assets.pinohouse.art/draft/Piano%20Sheet%20-%20176.250.png";
const ROWS = Array.from({ length: 8 }, (_, index) => index);

function resourceFromButton(text: string): ViewerResource | null {
  if (!text.includes("Founder · published")) return null;
  if (text.includes("Expansion")) return null;
  if (text.includes("Film Music Specialty")) {
    return { family: "SPECIALTY", title: "Film Music Specialty", context: "Specialty · L2" };
  }
  if (text.includes("ABC Song")) {
    return { family: "STARTER", title: "ABC Song", context: "Starter · đang học" };
  }
  if (text.includes("Twinkle Twinkle")) {
    return { family: "STARTER", title: "Twinkle Twinkle", context: "Starter · available" };
  }
  if (text.includes("Always With Me")) {
    return { family: "JOURNEY", title: "Always With Me", context: "L4 · Fundamental" };
  }
  return null;
}

export default function PinerPrototypeV6() {
  const [resource, setResource] = useState<ViewerResource | null>(null);

  function interceptPracticeOpen(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const button = target.closest("button");
    if (!button) return;
    const next = resourceFromButton(button.textContent ?? "");
    if (!next) return;

    event.preventDefault();
    event.stopPropagation();
    setResource(next);
  }

  return (
    <div className={v6.v6Root} onClickCapture={interceptPracticeOpen}>
      <PinerPrototypeV4 />

      <button
        type="button"
        className={v6.demoLauncher}
        onClick={() => setResource({ family: "JOURNEY", title: "Always With Me", context: "V6 phrase viewer demo" })}
      >
        V6 · mở notation demo
      </button>

      {resource && <PhrasePracticeViewer resource={resource} onClose={() => setResource(null)} />}
    </div>
  );
}

function PhrasePracticeViewer({ resource, onClose }: { resource: ViewerResource; onClose: () => void }) {
  const [landscape, setLandscape] = useState(false);
  const [showWorksheet, setShowWorksheet] = useState(true);
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState<RecordingState>("idle");

  function toggleRecording() {
    if (recording === "recording") setRecording("ready");
    else setRecording("recording");
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
            <p>V6 hiển thị từng câu nhạc full chiều ngang, sau đó đặt keyboard worksheet ngay bên dưới câu tương ứng.</p>
            <button type="button" onClick={() => setLandscape(true)}>Mô phỏng đã xoay ngang →</button>
          </div>
        ) : (
          <div className={v6.landscapeWorkspace}>
            <div className={v6.stickyTools}>
              <div className={v6.viewTools}>
                <button type="button" className={showWorksheet ? v6.activeTool : ""} onClick={() => setShowWorksheet((value) => !value)}>
                  {showWorksheet ? "Ẩn worksheet" : "Hiện worksheet"}
                </button>
                <button type="button" className={listening ? v6.activeTool : ""} onClick={() => setListening((value) => !value)}>
                  {listening ? "❚❚ Đang nghe" : "▶ Nghe mẫu"}
                </button>
                <button type="button" className={recording === "recording" ? v6.recordingTool : ""} onClick={recording === "submitted" ? undefined : toggleRecording}>
                  {recording === "recording" ? "■ Dừng ghi" : recording === "submitted" ? "✓ Đã gửi" : "● Ghi âm"}
                </button>
              </div>

              <div className={v6.accessPreview}>
                <span>Prototype access</span>
                <button type="button" className={!premiumUnlocked ? v6.accessActive : ""} onClick={() => setPremiumUnlocked(false)}>Free</button>
                <button type="button" className={premiumUnlocked ? v6.accessActive : ""} onClick={() => setPremiumUnlocked(true)}>Premium</button>
              </div>
            </div>

            <div className={v6.viewerHint}>
              <strong>Tập theo từng câu</strong>
              <span>Bản nhạc full width · worksheet nằm ngay dưới · 2 ảnh 176:250 chia đều 8 dòng.</span>
            </div>

            <div className={v6.phraseScroller}>
              {ROWS.map((rowIndex) => (
                <article className={v6.phrasePair} key={rowIndex}>
                  <div className={v6.phraseHeading}>
                    <span>Câu {rowIndex + 1}</span>
                    <small>{showWorksheet ? "Sheet + keyboard mapping" : "Sheet only"}</small>
                  </div>

                  <RowCrop src={SHEET_URL} rowIndex={rowIndex} alt={`PINO piano notation câu ${rowIndex + 1}`} />

                  {showWorksheet && (
                    <div className={v6.worksheetRow}>
                      <RowCrop src={WORKSHEET_URL} rowIndex={rowIndex} alt={`PINO keyboard worksheet câu ${rowIndex + 1}`} />
                      {!premiumUnlocked && (
                        <div className={v6.leftHandLock}>
                          <div className={v6.lockMessage}>
                            <span>🔒</span>
                            <strong>Tay trái · Premium</strong>
                            <small>Mở hướng dẫn đủ 2 tay</small>
                            <button type="button" onClick={() => setPremiumUnlocked(true)}>Xem Premium</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>

            {recording === "ready" && (
              <button type="button" className={v6.submitButton} onClick={() => setRecording("submitted")}>Gửi bài luyện tập →</button>
            )}
            {recording === "submitted" && (
              <div className={v6.submitNotice}>
                <strong>Đã gửi bài luyện tập</strong>
                <span>Submission không tự tăng level; đây là practice/evidence candidate để xử lý tiếp.</span>
              </div>
            )}

            <footer className={v6.viewerFooter}>
              <span>Founder-managed assets</span>
              <small>Sheet PNG · Worksheet PNG · reference audio. Production access state lấy từ Core; Free/Premium toggle chỉ phục vụ prototype.</small>
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
