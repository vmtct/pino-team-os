"use client";

import { FormEvent, MouseEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PinerPrototypeV8 from "./PinerPrototypeV8";
import { openStudioSessions } from "./fixtures-v2";
import v9 from "./piner-prototype-v9.module.css";
import v10 from "./piner-prototype-v10.module.css";

type AppSurface = "home" | "journey" | "collection" | "explore";
type BookingStage = "PENDING" | "CONFIRMED" | "CANCELLED" | "REJECTED";
type CancelActor = "PARENT" | "STAFF";
type FlowView =
  | "ELIGIBILITY"
  | "PENDING"
  | "CONFIRMED"
  | "BLOCKED_PENDING"
  | "BLOCKED_CONFIRMED"
  | "CANCEL_CONFIRM"
  | "CANCELLED"
  | "REJECTED";

type OpenStudioSession = (typeof openStudioSessions)[number];

type BookingState = {
  id: string;
  stage: BookingStage;
  session: OpenStudioSession;
  cancelledBy?: CancelActor;
  cancelledAt?: string;
};

type FlowModal = {
  view: FlowView;
  session: OpenStudioSession;
  bookingId?: string;
  cancelActor?: CancelActor;
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

function isActiveBooking(booking: BookingState) {
  return booking.stage === "PENDING" || booking.stage === "CONFIRMED";
}

export default function PinerPrototypeV10() {
  const rootRef = useRef<HTMLDivElement>(null);
  const sequenceRef = useRef(1);
  const [surface, setSurface] = useState<AppSurface>("home");
  const [bookings, setBookings] = useState<BookingState[]>([]);
  const [flowModal, setFlowModal] = useState<FlowModal>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const activeBooking = bookings.find(isActiveBooking) ?? null;
  const latestBooking = bookings[0] ?? null;

  useEffect(() => {
    const nav = rootRef.current?.querySelector("nav");
    const screen = nav?.previousElementSibling;
    setPortalTarget(screen instanceof HTMLElement ? screen : null);
  }, []);

  function updateBooking(id: string, updater: (booking: BookingState) => BookingState) {
    setBookings((current) => current.map((booking) => booking.id === id ? updater(booking) : booking));
  }

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

    if (activeBooking?.stage === "PENDING") {
      setFlowModal({ view: "BLOCKED_PENDING", session: activeBooking.session, bookingId: activeBooking.id });
      return;
    }

    if (activeBooking?.stage === "CONFIRMED" || scenarioKey === "an-free-confirmed") {
      const blockedSession = activeBooking?.session ?? session;
      setFlowModal({ view: "BLOCKED_CONFIRMED", session: blockedSession, bookingId: activeBooking?.id });
      return;
    }

    setFlowModal({ view: "ELIGIBILITY", session });
  }

  function handleChangeCapture(event: FormEvent<HTMLDivElement>) {
    const target = event.target as HTMLSelectElement;
    if (target.id !== "scenario") return;
    setBookings([]);
    setFlowModal(null);
    setSurface("home");
  }

  function createPendingBooking(session: OpenStudioSession) {
    const nextId = `BK-FREE-${String(sequenceRef.current++).padStart(4, "0")}`;
    const booking: BookingState = { id: nextId, stage: "PENDING", session };
    setBookings((current) => [booking, ...current]);
    setFlowModal({ view: "PENDING", session, bookingId: nextId });
  }

  function confirmBooking(booking: BookingState) {
    updateBooking(booking.id, (current) => ({ ...current, stage: "CONFIRMED" }));
    setFlowModal({ view: "CONFIRMED", session: booking.session, bookingId: booking.id });
  }

  function rejectBooking(booking: BookingState) {
    updateBooking(booking.id, (current) => ({ ...current, stage: "REJECTED" }));
    setFlowModal({ view: "REJECTED", session: booking.session, bookingId: booking.id });
  }

  function askCancel(booking: BookingState, actor: CancelActor) {
    setFlowModal({ view: "CANCEL_CONFIRM", session: booking.session, bookingId: booking.id, cancelActor: actor });
  }

  function cancelBooking(booking: BookingState, actor: CancelActor) {
    const cancelledAt = "16/08/2026 · 14:00";
    updateBooking(booking.id, (current) => ({ ...current, stage: "CANCELLED", cancelledBy: actor, cancelledAt }));
    setFlowModal({ view: "CANCELLED", session: booking.session, bookingId: booking.id, cancelActor: actor });
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

  function bookingById(id?: string) {
    if (!id) return null;
    return bookings.find((booking) => booking.id === id) ?? null;
  }

  return (
    <div ref={rootRef} className={v9.v9Root} onClickCapture={handleClickCapture} onChangeCapture={handleChangeCapture}>
      <PinerPrototypeV8 />

      {portalTarget && latestBooking && createPortal(
        <OpenStudioBookingCard
          booking={latestBooking}
          surface={surface}
          onConfirm={() => confirmBooking(latestBooking)}
          onReject={() => rejectBooking(latestBooking)}
          onCancelParent={() => askCancel(latestBooking, "PARENT")}
          onCancelStaff={() => askCancel(latestBooking, "STAFF")}
          onHome={() => goToSurface("home")}
          onExplore={() => goToSurface("explore")}
        />,
        portalTarget,
      )}

      {flowModal && (
        <OpenStudioBookingModal
          modal={flowModal}
          booking={bookingById(flowModal.bookingId)}
          onClose={() => setFlowModal(null)}
          onCreate={() => createPendingBooking(flowModal.session)}
          onConfirm={(booking) => confirmBooking(booking)}
          onReject={(booking) => rejectBooking(booking)}
          onAskCancel={(booking, actor) => askCancel(booking, actor)}
          onCancel={(booking, actor) => cancelBooking(booking, actor)}
          onHome={() => {
            setFlowModal(null);
            goToSurface("home");
          }}
          onExplore={() => {
            setFlowModal(null);
            goToSurface("explore");
          }}
          onPremium={openPremiumComparison}
        />
      )}
    </div>
  );
}

function OpenStudioBookingCard({ booking, surface, onConfirm, onReject, onCancelParent, onCancelStaff, onHome, onExplore }: {
  booking: BookingState;
  surface: AppSurface;
  onConfirm: () => void;
  onReject: () => void;
  onCancelParent: () => void;
  onCancelStaff: () => void;
  onHome: () => void;
  onExplore: () => void;
}) {
  const pending = booking.stage === "PENDING";
  const confirmed = booking.stage === "CONFIRMED";
  const cancelled = booking.stage === "CANCELLED";
  const rejected = booking.stage === "REJECTED";
  const onHomeSurface = surface === "home";

  return (
    <section className={`${v9.osContinuity} ${confirmed ? v9.osConfirmed : pending ? v9.osPending : v10.osTerminal}`}>
      <div className={v9.osContinuityIcon}>{confirmed ? "✓" : pending ? "…" : cancelled ? "×" : "!"}</div>
      <div className={v9.osContinuityCopy}>
        <span>{confirmed ? (onHomeSurface ? "Sắp đến PINO" : "Booking đã xác nhận") : pending ? "Booking · PENDING" : cancelled ? "Booking · CANCELLED" : "Booking · REJECTED"}</span>
        <strong>{pending ? "Đang chờ PINO xác nhận" : confirmed ? booking.session.title : cancelled ? (booking.cancelledBy === "PARENT" ? "Bạn đã huỷ booking này" : "PINO đã huỷ booking này") : "PINO chưa thể xác nhận buổi này"}</strong>
        <p>{booking.id} · {booking.session.path} · {booking.session.time}</p>
        <small>{pending ? "Booking đã tồn tại trong Core semantics; Free Student không thể giữ booking thứ hai cùng lúc." : confirmed ? "Weekly Free allowance được tính khi Staff xác nhận; attendance vẫn là bước riêng." : cancelled ? `${booking.cancelledAt ?? ""} · lịch sử Booking vẫn được giữ, không bị xóa.` : "Booking lịch sử được giữ; active Free booking guard đã được giải phóng."}</small>
      </div>
      <div className={v9.osContinuityActions}>
        {pending && <button type="button" onClick={onCancelParent}>Huỷ booking</button>}
        {confirmed && <button type="button" onClick={onCancelParent}>Huỷ booking</button>}
        {confirmed && !onHomeSurface && <button type="button" onClick={onHome}>Home →</button>}
        {(cancelled || rejected) && <button type="button" onClick={onExplore}>Chọn buổi khác →</button>}
      </div>
      {(pending || confirmed) && (
        <div className={v10.prototypeStaffActions}>
          <span>Prototype Staff</span>
          {pending && <button type="button" onClick={onConfirm}>Confirm</button>}
          {pending && <button type="button" onClick={onReject}>Reject</button>}
          {confirmed && <button type="button" onClick={onCancelStaff}>Staff cancel</button>}
        </div>
      )}
    </section>
  );
}

function OpenStudioBookingModal({ modal, booking, onClose, onCreate, onConfirm, onReject, onAskCancel, onCancel, onHome, onExplore, onPremium }: {
  modal: NonNullable<FlowModal>;
  booking: BookingState | null;
  onClose: () => void;
  onCreate: () => void;
  onConfirm: (booking: BookingState) => void;
  onReject: (booking: BookingState) => void;
  onAskCancel: (booking: BookingState, actor: CancelActor) => void;
  onCancel: (booking: BookingState, actor: CancelActor) => void;
  onHome: () => void;
  onExplore: () => void;
  onPremium: () => void;
}) {
  const session = modal.session;
  const actorLabel = modal.cancelActor === "STAFF" ? "PINO Staff" : "Phụ huynh";

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
            <div className={v9.coreCheck}><span>✓</span><div><strong>Có thể tạo Booking Free</strong><small>Core pre-check: không có active Free Booking khác và weekly eligibility hiện cho phép tiếp tục.</small></div></div>
            <div className={v9.flowDoctrine}><strong>Request = Booking(PENDING)</strong><p>Khi bấm tiếp tục, canonical Booking được tạo ngay ở trạng thái pending. Đây chưa phải Staff confirmation.</p></div>
            <button type="button" className={v9.primaryAction} onClick={onCreate}>Tạo Booking · chờ xác nhận →</button>
          </div>
        )}

        {modal.view === "PENDING" && booking && (
          <div className={v9.flowBody}>
            <div className={`${v9.stateGlyph} ${v9.pendingGlyph}`}>…</div>
            <span className={v9.stateEyebrow}>BOOKING · PENDING</span>
            <h2>Đang chờ PINO xác nhận</h2>
            <p className={v9.stateCopy}>{booking.id} · {session.title} · {session.time}</p>
            <div className={v10.durableRecord}><strong>Booking đã được tạo</strong><span>Không có entity Request thứ hai. Booking này vẫn tồn tại nếu sau đó bị Reject hoặc Cancel.</span></div>
            <div className={v9.zaloNote}><strong>Operational handoff</strong><span>Staff xem Booking Pending trong TOS và Confirm/Reject. Trong lúc Pending, Student Free không thể giữ thêm Booking thứ hai.</span></div>
            <div className={v9.flowActions}><button type="button" onClick={() => onAskCancel(booking, "PARENT")}>Huỷ booking</button><button type="button" className={v9.primaryAction} onClick={() => onConfirm(booking)}>Mô phỏng Staff confirm →</button></div>
            <button type="button" className={v10.staffTextAction} onClick={() => onReject(booking)}>Prototype · Staff reject</button>
          </div>
        )}

        {modal.view === "CONFIRMED" && booking && (
          <div className={v9.flowBody}>
            <div className={`${v9.stateGlyph} ${v9.confirmedGlyph}`}>✓</div>
            <span className={v9.stateEyebrow}>BOOKING · CONFIRMED</span>
            <h2>Hẹn gặp tại PINO</h2>
            <p className={v9.stateCopy}>{booking.id} · {session.title} · {session.time}</p>
            <div className={v9.confirmedFacts}><span><small>Path</small><strong>{session.path}</strong></span><span><small>Capacity</small><strong>Confirmed</strong></span><span><small>Weekly Free</small><strong>Đã claim</strong></span></div>
            <p className={v9.confirmedNote}>Confirmation mới là lúc weekly Explore claim được giữ. Attendance vẫn chưa xảy ra.</p>
            <div className={v9.flowActions}><button type="button" onClick={() => onAskCancel(booking, "PARENT")}>Huỷ booking</button><button type="button" className={v9.primaryAction} onClick={onHome}>Xem trên Home →</button></div>
            <button type="button" className={v10.staffTextAction} onClick={() => onAskCancel(booking, "STAFF")}>Prototype · Staff cancel</button>
          </div>
        )}

        {modal.view === "BLOCKED_PENDING" && booking && (
          <div className={v9.flowBody}>
            <div className={`${v9.stateGlyph} ${v9.pendingGlyph}`}>1</div>
            <span className={v9.stateEyebrow}>FREE · ACTIVE BOOKING</span>
            <h2>Đang có một Booking chờ xác nhận</h2>
            <p className={v9.stateCopy}>{booking.id} · {booking.session.title} · {booking.session.time}</p>
            <div className={v10.durableRecord}><strong>Mỗi Student Free chỉ giữ 1 Booking cùng lúc</strong><span>Muốn chọn buổi khác, hãy huỷ Booking Pending hiện tại trước. Đây là booking-management blocker, không phải Premium paywall.</span></div>
            <div className={v9.flowActions}><button type="button" onClick={onClose}>Giữ booking hiện tại</button><button type="button" className={v9.primaryAction} onClick={() => onAskCancel(booking, "PARENT")}>Huỷ để chọn buổi khác →</button></div>
          </div>
        )}

        {modal.view === "BLOCKED_CONFIRMED" && (
          <div className={v9.flowBody}>
            <div className={`${v9.stateGlyph} ${v9.blockedGlyph}`}>1</div>
            <span className={v9.stateEyebrow}>FREE · CONFIRMED</span>
            <h2>Tuần này đã có một Open Studio được xác nhận</h2>
            <p className={v9.stateCopy}>{booking ? `${booking.id} · ${booking.session.title} · ${booking.session.time}` : "Weekly Free allowance đang được sử dụng."}</p>
            <div className={v9.blockedPrivacy}><strong>Hai rule đang cùng bảo vệ flow</strong><span>Active Booking ngăn giữ hai booking cùng lúc; weekly claim ngăn dùng Free nhiều hơn policy sau khi đã confirmed.</span></div>
            {booking && <button type="button" className={v10.secondaryWide} onClick={() => onAskCancel(booking, "PARENT")}>Quản lý / huỷ booking hiện tại</button>}
            <button type="button" className={v9.primaryAction} onClick={onPremium}>Khám phá quyền lợi Premium →</button>
            <button type="button" className={v9.secondaryAction} onClick={onClose}>Đóng</button>
          </div>
        )}

        {modal.view === "CANCEL_CONFIRM" && booking && modal.cancelActor && (
          <div className={v9.flowBody}>
            <div className={`${v9.stateGlyph} ${v10.cancelGlyph}`}>×</div>
            <span className={v9.stateEyebrow}>CANCEL BOOKING</span>
            <h2>{modal.cancelActor === "PARENT" ? "Bạn muốn huỷ booking này?" : "Mô phỏng Staff huỷ booking"}</h2>
            <p className={v9.stateCopy}>{booking.id} · {session.title} · {session.time}</p>
            <div className={v10.auditNote}><strong>Không xoá record</strong><span>Status đổi thành CANCELLED. Core lưu cancelled_at + actor `{modal.cancelActor.toLowerCase()}` + actor ID/audit event. Capacity/claim được release theo lifecycle hiện tại.</span></div>
            <div className={v9.flowActions}><button type="button" onClick={onClose}>Giữ booking</button><button type="button" className={v10.dangerAction} onClick={() => onCancel(booking, modal.cancelActor as CancelActor)}>{actorLabel} xác nhận huỷ →</button></div>
          </div>
        )}

        {modal.view === "CANCELLED" && booking && (
          <div className={v9.flowBody}>
            <div className={`${v9.stateGlyph} ${v10.cancelledGlyph}`}>×</div>
            <span className={v9.stateEyebrow}>BOOKING · CANCELLED</span>
            <h2>{booking.cancelledBy === "PARENT" ? "Bạn đã huỷ booking" : "PINO đã huỷ booking"}</h2>
            <p className={v9.stateCopy}>{booking.id} · {session.title}</p>
            <div className={v10.historyFacts}><span><small>Cancelled by</small><strong>{booking.cancelledBy === "PARENT" ? "Parent" : "Staff"}</strong></span><span><small>Cancelled at</small><strong>{booking.cancelledAt}</strong></span><span><small>Record</small><strong>Retained</strong></span></div>
            <p className={v10.terminalNote}>Booking không bị xóa. Active Free Booking guard đã được release; với confirmed cancellation trước Session, releasable weekly claim/capacity cũng được trả theo policy.</p>
            <button type="button" className={v9.primaryAction} onClick={onExplore}>Chọn Open Studio khác →</button>
          </div>
        )}

        {modal.view === "REJECTED" && booking && (
          <div className={v9.flowBody}>
            <div className={`${v9.stateGlyph} ${v10.rejectedGlyph}`}>!</div>
            <span className={v9.stateEyebrow}>BOOKING · REJECTED</span>
            <h2>PINO chưa thể xác nhận buổi này</h2>
            <p className={v9.stateCopy}>{booking.id} · {session.title}</p>
            <p className={v10.terminalNote}>Booking vẫn được giữ trong lịch sử. Pending capacity/active-booking guard được release và weekly confirmed allowance chưa bị consume.</p>
            <button type="button" className={v9.primaryAction} onClick={onExplore}>Chọn Open Studio khác →</button>
          </div>
        )}
      </section>
    </div>
  );
}
