"use client";

import { FormEvent, MouseEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PinerPrototypeV8 from "./PinerPrototypeV8";
import { openStudioSessions } from "./fixtures-v2";
import v9 from "./piner-prototype-v9.module.css";

type AppSurface = "home" | "journey" | "collection" | "explore";
type RequestStage = "REQUESTED" | "CONFIRMED";
type FlowView = "ELIGIBILITY" | "REQUESTED" | "CONFIRMED" | "BLOCKED";

type OpenStudioSession = (typeof openStudioSessions)[number];

type OpenStudioRequest = {
  stage: RequestStage;
  session: OpenStudioSession;
};

type FlowModal = {
  view: FlowView;
  session: OpenStudioSession;
} | null;

function surfaceFromButton(text: string): AppSurface | null {
  const normalized = text.trim();
  if (normalized === "Home" || normalized.startsWith("Home")) return "home";
  if (normalized === "Journey" || normalized.startsWith("Journey")) return "journey";
  if (normalized === "Collection" || normalized.startsWith("Collection")) return "collection";
  if (normalized === "Explore" || normalized.startsWith("Explore")) return "explore";
  return null;
}

function sessionFromButton(button: HTMLButtonElement): OpenStudioSession | null {
  const cardText = button.parentElement?.textContent ?? button.textContent ?? "";
  return openStudioSessions.find((session) => cardText.includes(session.title)) ?? null;
}

function currentScenarioKey() {
  if (typeof document === "undefined") return "";
  return document.querySelector<HTMLSelectElement>("#scenario")?.value ?? "";
}

function freeExploreScenario(key: string) {
  return key === "an-free" || key === "an-free-confirmed" || key === "leo-expired";
}

export default function PinerPrototypeV9() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [surface, setSurface] = useState<AppSurface>("home");
  const [request, setRequest] = useState<OpenStudioRequest | null>(null);
  const [flowModal, setFlowModal] = useState<FlowModal>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const nav = rootRef.current?.querySelector("nav");
    const screen = nav?.previousElementSibling;
    setPortalTarget(screen instanceof HTMLElement ? screen : null);
  }, []);

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const button = target.closest("button") as HTMLButtonElement | null;
    if (!button) return;

    const text = button.textContent ?? "";
    const nextSurface = surfaceFromButton(text);
    if (nextSurface) setSurface(nextSurface);

    if (!text.includes("Yêu cầu")) return;
    const scenarioKey = currentScenarioKey();
    if (!freeExploreScenario(scenarioKey)) return;

    const session = sessionFromButton(button);
    if (!session) return;

    event.preventDefault();
    event.stopPropagation();

    const fixtureAlreadyConfirmed = scenarioKey === "an-free-confirmed";
    if (fixtureAlreadyConfirmed || request?.stage === "CONFIRMED") {
      setFlowModal({ view: "BLOCKED", session });
      return;
    }

    if (request?.stage === "REQUESTED") {
      setFlowModal({ view: "REQUESTED", session: request.session });
      return;
    }

    setFlowModal({ view: "ELIGIBILITY", session });
  }

  function handleChangeCapture(event: FormEvent<HTMLDivElement>) {
    const target = event.target as HTMLSelectElement;
    if (target.id !== "scenario") return;
    setRequest(null);
    setFlowModal(null);
    setSurface("home");
  }

  function submitRequest(session: OpenStudioSession) {
    const next = { stage: "REQUESTED" as const, session };
    setRequest(next);
    setFlowModal({ view: "REQUESTED", session });
  }

  function confirmRequest(session: OpenStudioSession) {
    const next = { stage: "CONFIRMED" as const, session };
    setRequest(next);
    setFlowModal({ view: "CONFIRMED", session });
  }

  function goToSurface(next: AppSurface) {
    const nav = rootRef.current?.querySelector("nav");
    const button = Array.from(nav?.querySelectorAll("button") ?? []).find((candidate) => (candidate.textContent ?? "").includes(next === "home" ? "Home" : next === "explore" ? "Explore" : next));
    button?.click();
    setSurface(next);
  }

  function openPremiumComparison() {
    setFlowModal(null);
    window.setTimeout(() => {
      const buttons = Array.from(rootRef.current?.querySelectorAll("button") ?? []);
      const premium = buttons.find((candidate) => {
        const text = candidate.textContent ?? "";
        return text.includes("Xem Free vs Premium") || text.includes("Khám phá quyền lợi Premium");
      });
      premium?.click();
    }, 0);
  }

  return (
    <div ref={rootRef} className={v9.v9Root} onClickCapture={handleClickCapture} onChangeCapture={handleChangeCapture}>
      <PinerPrototypeV8 />

      {portalTarget && request && createPortal(
        <OpenStudioContinuityCard
          request={request}
          surface={surface}
          onConfirm={() => confirmRequest(request.session)}
          onHome={() => goToSurface("home")}
          onExplore={() => goToSurface("explore")}
        />,
        portalTarget,
      )}

      {flowModal && (
        <OpenStudioFlowModal
          modal={flowModal}
          onClose={() => setFlowModal(null)}
          onSubmit={() => submitRequest(flowModal.session)}
          onConfirm={() => confirmRequest(flowModal.session)}
          onHome={() => {
            setFlowModal(null);
            goToSurface("home");
          }}
          onPremium={openPremiumComparison}
        />
      )}
    </div>
  );
}

function OpenStudioContinuityCard({ request, surface, onConfirm, onHome, onExplore }: {
  request: OpenStudioRequest;
  surface: AppSurface;
  onConfirm: () => void;
  onHome: () => void;
  onExplore: () => void;
}) {
  const confirmed = request.stage === "CONFIRMED";
  const onHomeSurface = surface === "home";

  return (
    <section className={`${v9.osContinuity} ${confirmed ? v9.osConfirmed : v9.osPending}`}>
      <div className={v9.osContinuityIcon}>{confirmed ? "✓" : "…"}</div>
      <div className={v9.osContinuityCopy}>
        <span>{confirmed ? (onHomeSurface ? "Sắp đến PINO" : "Open Studio đã xác nhận") : "Yêu cầu Open Studio"}</span>
        <strong>{confirmed ? request.session.title : "Đang chờ PINO xác nhận"}</strong>
        <p>{request.session.path} · {request.session.time} · {request.session.age}</p>
        <small>{confirmed ? "Free weekly Open Studio allowance của tuần này hiện đã được sử dụng." : "Eligibility đã qua Core pre-check. Staff confirmation vẫn là bước riêng trước khi buổi học được xác nhận."}</small>
      </div>
      <div className={v9.osContinuityActions}>
        {!confirmed && <button type="button" onClick={onConfirm}>Mô phỏng Staff xác nhận →</button>}
        {confirmed && !onHomeSurface && <button type="button" onClick={onHome}>Xem trên Home →</button>}
        {confirmed && onHomeSurface && <button type="button" onClick={onExplore}>Explore →</button>}
      </div>
    </section>
  );
}

function OpenStudioFlowModal({ modal, onClose, onSubmit, onConfirm, onHome, onPremium }: {
  modal: NonNullable<FlowModal>;
  onClose: () => void;
  onSubmit: () => void;
  onConfirm: () => void;
  onHome: () => void;
  onPremium: () => void;
}) {
  const session = modal.session;

  return (
    <div className={v9.flowBackdrop} onMouseDown={onClose}>
      <section className={v9.flowCard} onMouseDown={(event) => event.stopPropagation()}>
        <header className={v9.flowHeader}>
          <div><span>OPEN STUDIO</span><strong>{session.title}</strong></div>
          <button type="button" onClick={onClose} aria-label="Đóng">×</button>
        </header>

        {modal.view === "ELIGIBILITY" && (
          <div className={v9.flowBody}>
            <div className={v9.sessionHero}><span>{session.emoji}</span><div><small>{session.path} · {session.age}</small><strong>{session.time}</strong><p>{session.title}</p></div></div>
            <div className={v9.coreCheck}><span>✓</span><div><strong>Tuần này có thể gửi yêu cầu</strong><small>Prototype mô phỏng kết quả Core eligibility pre-check. Đây chưa phải xác nhận chỗ.</small></div></div>
            <div className={v9.flowDoctrine}><strong>Eligibility ≠ Request ≠ Confirmation</strong><p>Gửi yêu cầu chỉ chuyển sang trạng thái chờ PINO xác nhận; không tự động tạo một buổi đã confirmed trong UX.</p></div>
            <button type="button" className={v9.primaryAction} onClick={onSubmit}>Gửi yêu cầu Open Studio →</button>
          </div>
        )}

        {modal.view === "REQUESTED" && (
          <div className={v9.flowBody}>
            <div className={`${v9.stateGlyph} ${v9.pendingGlyph}`}>…</div>
            <span className={v9.stateEyebrow}>YÊU CẦU ĐÃ GỬI</span>
            <h2>Đang chờ PINO xác nhận</h2>
            <p className={v9.stateCopy}>{session.title} · {session.time}</p>
            <div className={v9.zaloNote}><strong>Operational handoff</strong><span>Staff xử lý request và liên hệ/xác nhận theo workflow vận hành hiện hành, ví dụ qua Zalo.</span></div>
            <div className={v9.flowActions}><button type="button" onClick={onClose}>Đóng</button><button type="button" className={v9.primaryAction} onClick={onConfirm}>Mô phỏng Staff xác nhận →</button></div>
            <small className={v9.prototypeNote}>Prototype chỉ mô phỏng happy path. Canonical persistence của REQUESTED trước Booking cần được reconcile với Core trước production implementation.</small>
          </div>
        )}

        {modal.view === "CONFIRMED" && (
          <div className={v9.flowBody}>
            <div className={`${v9.stateGlyph} ${v9.confirmedGlyph}`}>✓</div>
            <span className={v9.stateEyebrow}>ĐÃ XÁC NHẬN</span>
            <h2>Hẹn gặp tại PINO</h2>
            <p className={v9.stateCopy}>{session.title} · {session.time}</p>
            <div className={v9.confirmedFacts}><span><small>Path</small><strong>{session.path}</strong></span><span><small>Độ tuổi</small><strong>{session.age}</strong></span><span><small>Weekly Free</small><strong>Đã sử dụng</strong></span></div>
            <p className={v9.confirmedNote}>Từ thời điểm confirmed, một yêu cầu Free mới trong cùng weekly eligibility window sẽ bị chặn trước submission.</p>
            <div className={v9.flowActions}><button type="button" onClick={onClose}>Đóng</button><button type="button" className={v9.primaryAction} onClick={onHome}>Xem trên Home →</button></div>
          </div>
        )}

        {modal.view === "BLOCKED" && (
          <div className={v9.flowBody}>
            <div className={`${v9.stateGlyph} ${v9.blockedGlyph}`}>1</div>
            <span className={v9.stateEyebrow}>FREE · WEEKLY LIMIT</span>
            <h2>Tuần này đã có một Open Studio được xác nhận</h2>
            <p className={v9.stateCopy}>Không tạo thêm request Free mà Core đã biết là không eligible.</p>
            <div className={v9.blockedPrivacy}><strong>Member surface</strong><span>Piner có thể hiển thị buổi đã confirmed cho Parent/Student đã đăng nhập. Guest public flow chỉ được lộ coarse eligibility state theo privacy exception đã duyệt.</span></div>
            <button type="button" className={v9.primaryAction} onClick={onPremium}>Khám phá quyền lợi Premium →</button>
            <button type="button" className={v9.secondaryAction} onClick={onClose}>Đóng</button>
          </div>
        )}
      </section>
    </div>
  );
}
