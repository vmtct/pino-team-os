"use client";

import { MouseEvent, useState } from "react";
import PinerPrototypeV4 from "./PinerPrototypeV4";
import v5 from "./piner-prototype-v5.module.css";

type PracticeFamily = "STARTER" | "JOURNEY" | "SPECIALTY";
type RecordingState = "idle" | "recording" | "ready" | "submitted";

type ViewerResource = {
  family: PracticeFamily;
  title: string;
  context: string;
};

const SHEET_URL = "https://assets.pinohouse.art/draft/Piano%20Sheet%20-%20176.250%20(1).png";
const WORKSHEET_URL = "https://assets.pinohouse.art/draft/Piano%20Sheet%20-%20176.250.png";

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

export default function PinerPrototypeV5() {
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
    <div className={v5.v5Root} onClickCapture={interceptPracticeOpen}>
      <PinerPrototypeV4 />

      <button
        type="button"
        className={v5.demoLauncher}
        onClick={() => setResource({ family: "JOURNEY", title: "Terravia · sample sheet", context: "Paired-image viewer demo" })}
      >
        V5 · mở notation demo
      </button>

      {resource && <PairedPracticeViewer resource={resource} onClose={() => setResource(null)} />}
    </div>
  );
}

function PairedPracticeViewer({ resource, onClose }: { resource: ViewerResource; onClose: () => void }) {
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
    <div className={v5.viewerBackdrop}>
      <section className={v5.viewerShell}>
        <header className={v5.viewerHeader}>
          <div>
            <span className={v5.familyBadge}>{resource.family}</span>
            <strong>{resource.title}</strong>
            <small>{resource.context}</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng practice viewer">×</button>
        </header>

        {!landscape ? (
          <div className={v5.orientationGate}>
            <div className={v5.phoneGlyph}>↻</div>
            <h2>Lật ngang điện thoại để luyện tập</h2>
            <p>App tái tạo đúng grammar của sheet hardcopy tại PINO. Landscape giúp đặt sheet và keyboard worksheet cạnh nhau theo đúng từng dòng.</p>
            <button type="button" onClick={() => setLandscape(true)}>Mô phỏng đã xoay ngang →</button>
          </div>
        ) : (
          <div className={v5.landscapeWorkspace}>
            <div className={v5.practiceTopbar}>
              <div className={v5.viewTools}>
                <button type="button" className={showWorksheet ? v5.activeTool : ""} onClick={() => setShowWorksheet((value) => !value)}>
                  {showWorksheet ? "Ẩn worksheet" : "Hiện worksheet"}
                </button>
                <button type="button" className={listening ? v5.activeTool : ""} onClick={() => setListening((value) => !value)}>
                  {listening ? "❚❚ Đang nghe" : "▶ Nghe mẫu"}
                </button>
                <button type="button" className={recording === "recording" ? v5.recordingTool : ""} onClick={recording === "submitted" ? undefined : toggleRecording}>
                  {recording === "recording" ? "■ Dừng ghi" : recording === "submitted" ? "✓ Đã gửi" : "● Ghi âm"}
                </button>
              </div>

              <div className={v5.accessPreview}>
                <span>Prototype access</span>
                <button type="button" className={!premiumUnlocked ? v5.accessActive : ""} onClick={() => setPremiumUnlocked(false)}>Free</button>
                <button type="button" className={premiumUnlocked ? v5.accessActive : ""} onClick={() => setPremiumUnlocked(true)}>Premium</button>
              </div>
            </div>

            <div className={v5.physicalMirrorNote}>
              <strong>Cùng layout với sheet tại PINO</strong>
              <span>2 ảnh 176:250 · 8 dòng · mapping 1:1 · một viewport scroll chung.</span>
            </div>

            <div className={v5.pairedViewport}>
              <div className={`${v5.pairedGrid} ${showWorksheet ? "" : v5.sheetOnly}`}>
                <div className={v5.assetPane}>
                  <div className={v5.paneLabel}><span>SHEET</span><small>Bản nhạc</small></div>
                  <img src={SHEET_URL} alt="PINO piano notation sheet" />
                </div>

                {showWorksheet && (
                  <div className={v5.assetPane}>
                    <div className={v5.paneLabel}><span>WORKSHEET</span><small>Keyboard mapping</small></div>
                    <img src={WORKSHEET_URL} alt="PINO piano keyboard fingering worksheet" />
                    {!premiumUnlocked && (
                      <div className={v5.leftHandLock}>
                        <div className={v5.lockMessage}>
                          <span>🔒</span>
                          <strong>Tay trái · Premium</strong>
                          <small>Mở hướng dẫn đủ 2 tay</small>
                          <button type="button" onClick={() => setPremiumUnlocked(true)}>Xem Premium</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {recording === "ready" && (
              <button type="button" className={v5.submitButton} onClick={() => setRecording("submitted")}>Gửi bài luyện tập →</button>
            )}
            {recording === "submitted" && (
              <div className={v5.submitNotice}>
                <strong>Đã gửi bài luyện tập</strong>
                <span>Submission không tự tăng level; đây là practice/evidence candidate để xử lý tiếp.</span>
              </div>
            )}

            <footer className={v5.viewerFooter}>
              <span>Founder-managed assets</span>
              <small>Sheet PNG · Worksheet PNG · reference audio. Production access state lấy từ Core; toggle Free/Premium chỉ phục vụ prototype.</small>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}
