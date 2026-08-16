"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PinerPrototypeV12 from "./PinerPrototypeV12";
import { openStudioSessions, scenarios, type MembershipMode } from "./fixtures-v2";
import v13 from "./piner-prototype-v13.module.css";
import fix from "./piner-prototype-v13-fix.module.css";

type SessionKind = "OPEN_STUDIO" | "PREMIUM";
type BookingStage = "PENDING" | "CONFIRMED" | "CANCELLED" | "REJECTED";
type CancelActor = "PARENT" | "STAFF";
type BookingPolicy = "FREE" | "TRIAL" | "ACTIVE_PREMIUM";
type ModalView =
  | "REGISTER"
  | "PENDING"
  | "CONFIRMED"
  | "BLOCKED_PENDING"
  | "BLOCKED_CONFIRMED"
  | "BLOCKED_MEMBER_QUOTA"
  | "UPGRADE_REQUIRED"
  | "CANCEL_CONFIRM"
  | "CANCELLED"
  | "REJECTED";

type ExploreSession = {
  id: string;
  path: string;
  title: string;
  time: string;
  age: string;
  emoji: string;
  kind: SessionKind;
  note: string;
};

type BookingState = {
  id: string;
  stage: BookingStage;
  session: ExploreSession;
  policy: BookingPolicy;
  freeRule: boolean;
  cancelledBy?: CancelActor;
  cancelledAt?: string;
};

type FlowModal = {
  view: ModalView;
  session: ExploreSession;
  bookingId?: string;
  cancelActor?: CancelActor;
} | null;

const sessionCatalog: ExploreSession[] = [
  ...openStudioSessions.map((session) => ({
    ...session,
    kind: "OPEN_STUDIO" as const,
    note: "Open Studio · đăng ký theo eligibility hiện hành",
  })),
  {
    id: "premium-session-film-music",
    path: "PianoHouse",
    title: "Film Music Lab · Ghibli Evening",
    time: "Thứ Bảy · 18:00",
    age: "7+",
    emoji: "🎬",
    kind: "PREMIUM",
    note: "Premium Session · dành cho learner đang có Premium access",
  },
  {
    id: "premium-session-character",
    path: "ArtChitect",
    title: "Character Lab · Hoạt hình",
    time: "Chủ Nhật · 16:30",
    age: "7+",
    emoji: "✦",
    kind: "PREMIUM",
    note: "Premium Session · đi sâu hơn ngoài Open Studio cơ bản",
  },
];

function hasPremiumAccess(mode: MembershipMode | undefined) {
  return mode === "ACTIVE_PREMIUM" || mode === "TRIAL_PREMIUM";
}

function bookingPolicy(mode: MembershipMode | undefined): BookingPolicy {
  if (mode === "TRIAL_PREMIUM") return "TRIAL";
  if (mode === "ACTIVE_PREMIUM") return "ACTIVE_PREMIUM";
  return "FREE";
}

function isActive(booking: BookingState) {
  return booking.stage === "PENDING" || booking.stage === "CONFIRMED";
}

export default function PinerPrototypeV13() {
  const rootRef = useRef<HTMLDivElement>(null);
  const sequenceRef = useRef(1);
  const [scenarioKey, setScenarioKey] = useState("minh-premium");
  const [mountTarget, setMountTarget] = useState<HTMLElement | null>(null);
  const [bookings, setBookings] = useState<BookingState[]>([]);
  const [flowModal, setFlowModal] = useState<FlowModal>(null);

  const student = useMemo(() => scenarios.find((candidate) => candidate.key === scenarioKey), [scenarioKey]);
  const premiumAccess = hasPremiumAccess(student?.mode);
  const policy = bookingPolicy(student?.mode);
  const activeFreeBooking = bookings.find((booking) => booking.freeRule && isActive(booking)) ?? null;
  const activeSharedPremiumBooking = policy === "ACTIVE_PREMIUM"
    ? bookings.find((booking) => isActive(booking)) ?? null
    : null;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const syncExploreMount = () => {
      const sections = Array.from(root.querySelectorAll<HTMLElement>("section"));
      const original = sections.find((section) => section.textContent?.includes("Open Studio gần nhất"));

      if (!original) {
        setMountTarget((current) => current?.isConnected ? current : null);
        return;
      }

      original.style.display = "none";
      original.dataset.v13Hidden = "true";

      let mount = original.previousElementSibling as HTMLElement | null;
      if (!mount || mount.dataset.v13ExploreMount !== "true") {
        mount = document.createElement("div");
        mount.dataset.v13ExploreMount = "true";
        original.parentElement?.insertBefore(mount, original);
      }

      setMountTarget((current) => current === mount ? current : mount);
    };

    syncExploreMount();
    const observer = new MutationObserver(syncExploreMount);
    observer.observe(root, { childList: true, subtree: true });

    const select = root.querySelector<HTMLSelectElement>("#scenario");
    if (select) setScenarioKey(select.value);

    return () => {
      observer.disconnect();
      root.querySelectorAll<HTMLElement>("[data-v13-hidden='true']").forEach((node) => {
        node.style.display = "";
        delete node.dataset.v13Hidden;
      });
      root.querySelectorAll<HTMLElement>("[data-v13-explore-mount='true']").forEach((node) => node.remove());
    };
  }, []);

  function handleChangeCapture(event: FormEvent<HTMLDivElement>) {
    const target = event.target as HTMLSelectElement;
    if (target.id !== "scenario") return;
    setScenarioKey(target.value);
    setBookings([]);
    setFlowModal(null);
  }

  function bookingById(id?: string) {
    if (!id) return null;
    return bookings.find((booking) => booking.id === id) ?? null;
  }

  function updateBooking(id: string, updater: (booking: BookingState) => BookingState) {
    setBookings((current) => current.map((booking) => booking.id === id ? updater(booking) : booking));
  }

  function openRegistration(session: ExploreSession) {
    const freeRule = session.kind === "OPEN_STUDIO" && !premiumAccess;

    if (session.kind === "PREMIUM" && !premiumAccess) {
      setFlowModal({ view: "UPGRADE_REQUIRED", session });
      return;
    }

    if (policy === "ACTIVE_PREMIUM" && activeSharedPremiumBooking) {
      setFlowModal({
        view: "BLOCKED_MEMBER_QUOTA",
        session: activeSharedPremiumBooking.session,
        bookingId: activeSharedPremiumBooking.id,
      });
      return;
    }

    if (freeRule && activeFreeBooking?.stage === "PENDING") {
      setFlowModal({ view: "BLOCKED_PENDING", session: activeFreeBooking.session, bookingId: activeFreeBooking.id });
      return;
    }

    if (freeRule && (activeFreeBooking?.stage === "CONFIRMED" || scenarioKey === "an-free-confirmed")) {
      setFlowModal({
        view: "BLOCKED_CONFIRMED",
        session: activeFreeBooking?.session ?? session,
        bookingId: activeFreeBooking?.id,
      });
      return;
    }

    setFlowModal({ view: "REGISTER", session });
  }

  function createPendingBooking(session: ExploreSession) {
    const freeRule = session.kind === "OPEN_STUDIO" && !premiumAccess;
    const currentPolicy = bookingPolicy(student?.mode);
    const prefix = session.kind === "PREMIUM" ? "BK-PREM" : freeRule ? "BK-FREE" : currentPolicy === "TRIAL" ? "BK-TRIAL" : "BK-MEMBER";
    const id = `${prefix}-${String(sequenceRef.current++).padStart(4, "0")}`;
    const booking: BookingState = { id, stage: "PENDING", session, policy: currentPolicy, freeRule };
    setBookings((current) => [booking, ...current]);
    setFlowModal({ view: "PENDING", session, bookingId: id });
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
    const cancelledAt = "16/08/2026 · 14:40";
    updateBooking(booking.id, (current) => ({ ...current, stage: "CANCELLED", cancelledBy: actor, cancelledAt }));
    setFlowModal({ view: "CANCELLED", session: booking.session, bookingId: booking.id, cancelActor: actor });
  }

  function openPremiumComparison() {
    setFlowModal(null);
    window.setTimeout(() => {
      const buttons = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
      const target = scenarioKey === "leo-expired"
        ? buttons.find((button) => {
            const text = button.textContent ?? "";
            return text.includes("Tiếp tục Premium") || text.includes("Tiếp tục với Premium");
          })
        : buttons.find((button) => {
            const text = button.textContent ?? "";
            return text.includes("Xem Free vs Premium") || text.includes("Khám phá quyền lợi Premium");
          });
      target?.click();
    }, 0);
  }

  return (
    <div ref={rootRef} className={v13.v13Root} onChangeCapture={handleChangeCapture}>
      <PinerPrototypeV12 />

      {mountTarget && createPortal(
        <ExploreSessionSection
          membershipMode={student?.mode}
          premiumAccess={premiumAccess}
          bookings={bookings}
          onRegister={openRegistration}
          onConfirm={confirmBooking}
          onReject={rejectBooking}
          onCancelParent={(booking) => askCancel(booking, "PARENT")}
          onCancelStaff={(booking) => askCancel(booking, "STAFF")}
        />,
        mountTarget,
      )}

      {flowModal && (
        <SessionFlowModal
          modal={flowModal}
          booking={bookingById(flowModal.bookingId)}
          membershipMode={student?.mode}
          premiumAccess={premiumAccess}
          onClose={() => setFlowModal(null)}
          onCreate={() => createPendingBooking(flowModal.session)}
          onConfirm={confirmBooking}
          onReject={rejectBooking}
          onAskCancel={askCancel}
          onCancel={cancelBooking}
          onPremium={openPremiumComparison}
        />
      )}
    </div>
  );
}

function ExploreSessionSection({ membershipMode, premiumAccess, bookings, onRegister, onConfirm, onReject, onCancelParent, onCancelStaff }: {
  membershipMode: MembershipMode | undefined;
  premiumAccess: boolean;
  bookings: BookingState[];
  onRegister: (session: ExploreSession) => void;
  onConfirm: (booking: BookingState) => void;
  onReject: (booking: BookingState) => void;
  onCancelParent: (booking: BookingState) => void;
  onCancelStaff: (booking: BookingState) => void;
}) {
  const policy = bookingPolicy(membershipMode);
  const activeCount = bookings.filter(isActive).length;

  return (
    <section className={v13.sessionSection}>
      <div className={v13.sectionHeading}>
        <div>
          <span>UPCOMING · 2 ACCESS TYPES</span>
          <h3>Open Studio & Premium Sessions</h3>
        </div>
        <small>Đều dùng Booking lifecycle</small>
      </div>

      <div className={`${fix.policyBand} ${policy === "TRIAL" ? fix.policyTrial : policy === "ACTIVE_PREMIUM" ? fix.policyPremium : ""}`}>
        <strong>{policy === "TRIAL" ? "Trial Premium · có thể đăng ký nhiều booking trong tuần" : policy === "ACTIVE_PREMIUM" ? "Premium · tối đa 1 booking đang giữ trong tuần" : "Free / expired · Open Studio theo Free eligibility"}</strong>
        <span>{policy === "TRIAL" ? "Open Studio và Premium Session đều có thể tạo Booking; không áp quota 1 booking của paid Premium." : policy === "ACTIVE_PREMIUM" ? "Open Studio + Premium Session dùng chung một quota. PENDING hoặc CONFIRMED đều chiếm slot cho đến khi Booking thành terminal state." : "Premium Session cần Premium access; Open Studio vẫn theo active-booking + weekly Free rule hiện hành."}</span>
      </div>

      {bookings.length > 0 && (
        <div className={fix.bookingStack}>
          <div className={fix.bookingStackHeader}><strong>Booking trong prototype</strong><span>{activeCount} active · {bookings.length} total</span></div>
          {bookings.map((booking) => (
            <BookingContinuity
              key={booking.id}
              booking={booking}
              onConfirm={() => onConfirm(booking)}
              onReject={() => onReject(booking)}
              onCancelParent={() => onCancelParent(booking)}
              onCancelStaff={() => onCancelStaff(booking)}
            />
          ))}
        </div>
      )}

      <div className={v13.legendRow}>
        <span className={v13.openLegend}>OPEN STUDIO · Explore</span>
        <span className={v13.premiumLegend}>PREMIUM SESSION · member access</span>
      </div>

      <div className={v13.sessionList}>
        {sessionCatalog.map((session) => {
          const lockedPremium = session.kind === "PREMIUM" && !premiumAccess;
          return (
            <article key={session.id} className={`${v13.sessionCard} ${session.kind === "PREMIUM" ? v13.premiumCard : v13.openCard}`}>
              <div className={v13.sessionVisual}>
                <span>{session.emoji}</span>
                <em>{session.kind === "PREMIUM" ? "P" : "OS"}</em>
              </div>
              <div className={v13.sessionCopy}>
                <div className={v13.badgeRow}>
                  <span className={session.kind === "PREMIUM" ? v13.premiumBadge : v13.openBadge}>
                    {session.kind === "PREMIUM" ? "PREMIUM SESSION" : "OPEN STUDIO"}
                  </span>
                  {lockedPremium && <span className={v13.lockBadge}>🔒 Premium</span>}
                </div>
                <small>{session.path} · {session.age}</small>
                <strong>{session.title}</strong>
                <b>{session.time}</b>
                <p>{session.note}</p>
              </div>
              <button type="button" className={`${session.kind === "PREMIUM" ? v13.premiumRegister : v13.openRegister} ${fix.registerButtonFix}`} onClick={() => onRegister(session)}>
                <span className={session.kind === "PREMIUM" ? fix.registerLabelPremium : fix.registerLabelOpen}>Đăng ký</span>
              </button>
            </article>
          );
        })}
      </div>

      <p className={fix.quotaNote}>Trial được phép có nhiều Booking trong cùng tuần. Active Premium sau Trial dùng quota 1 Booking chung cho Open Studio + Premium Session. Free/expired giữ rule Open Studio riêng đã chốt.</p>
    </section>
  );
}

function BookingContinuity({ booking, onConfirm, onReject, onCancelParent, onCancelStaff }: {
  booking: BookingState;
  onConfirm: () => void;
  onReject: () => void;
  onCancelParent: () => void;
  onCancelStaff: () => void;
}) {
  const active = isActive(booking);
  return (
    <div className={`${v13.bookingStrip} ${booking.session.kind === "PREMIUM" ? v13.bookingStripPremium : ""}`}>
      <span className={v13.bookingGlyph}>{booking.stage === "CONFIRMED" ? "✓" : booking.stage === "PENDING" ? "…" : booking.stage === "CANCELLED" ? "×" : "!"}</span>
      <div>
        <small>{booking.session.kind === "PREMIUM" ? "PREMIUM SESSION" : "OPEN STUDIO"} · BOOKING {booking.stage}</small>
        <strong>{booking.session.title}</strong>
        <p>{booking.id} · {booking.session.time}</p>
      </div>
      {active && (
        <div className={v13.bookingActions}>
          {booking.stage === "PENDING" && <button type="button" onClick={onConfirm}>Staff confirm</button>}
          {booking.stage === "PENDING" && <button type="button" onClick={onReject}>Reject</button>}
          <button type="button" onClick={onCancelParent}>Huỷ</button>
          {booking.stage === "CONFIRMED" && <button type="button" onClick={onCancelStaff}>Staff cancel</button>}
        </div>
      )}
    </div>
  );
}

function SessionFlowModal({ modal, booking, membershipMode, premiumAccess, onClose, onCreate, onConfirm, onReject, onAskCancel, onCancel, onPremium }: {
  modal: NonNullable<FlowModal>;
  booking: BookingState | null;
  membershipMode: MembershipMode | undefined;
  premiumAccess: boolean;
  onClose: () => void;
  onCreate: () => void;
  onConfirm: (booking: BookingState) => void;
  onReject: (booking: BookingState) => void;
  onAskCancel: (booking: BookingState, actor: CancelActor) => void;
  onCancel: (booking: BookingState, actor: CancelActor) => void;
  onPremium: () => void;
}) {
  const session = modal.session;
  const premium = session.kind === "PREMIUM";
  const policy = bookingPolicy(membershipMode);

  return (
    <div className={v13.modalBackdrop} onMouseDown={onClose}>
      <section className={v13.modalCard} onMouseDown={(event) => event.stopPropagation()}>
        <header className={premium ? v13.modalHeaderPremium : ""}>
          <div><span>{premium ? "PREMIUM SESSION" : "OPEN STUDIO"}</span><strong>{session.title}</strong></div>
          <button type="button" onClick={onClose}>×</button>
        </header>

        {modal.view === "REGISTER" && (
          <div className={v13.modalBody}>
            <SessionHero session={session} />
            <div className={`${v13.accessCheck} ${premium ? v13.accessCheckPremium : ""}`}>
              <span>✓</span>
              <div>
                <strong>{policy === "TRIAL" ? "Trial Premium · có thể đăng ký thêm" : policy === "ACTIVE_PREMIUM" ? "Premium quota còn trống" : premium ? "Premium access hợp lệ" : "Free eligibility pre-check"}</strong>
                <small>{policy === "TRIAL" ? "Trial cho phép nhiều Booking trong cùng tuần, áp cho cả Open Studio và Premium Session." : policy === "ACTIVE_PREMIUM" ? "Paid Premium dùng tối đa 1 active Booking trong tuần; hai session type dùng chung quota." : premium ? "Session này yêu cầu Premium access hiện hành." : "Free active-booking + weekly eligibility được kiểm tra trước khi tạo Booking."}</small>
              </div>
            </div>
            <button type="button" className={v13.primaryAction} onClick={onCreate}>Đăng ký · tạo Booking Pending →</button>
          </div>
        )}

        {modal.view === "UPGRADE_REQUIRED" && (
          <div className={v13.modalBody}>
            <div className={v13.lockHero}>✦</div>
            <span className={v13.modalEyebrow}>PREMIUM SESSION</span>
            <h2>Buổi này dành cho Premium</h2>
            <p className={v13.centerCopy}>Bạn vẫn có thể đăng ký các Open Studio đang đủ điều kiện. Premium Session mở khi learner có Premium access.</p>
            <SessionHero session={session} compact />
            <button type="button" className={v13.primaryAction} onClick={onPremium}>{membershipMode === "EXPIRED_PREMIUM" ? "Tiếp tục Premium →" : "Khám phá / nâng cấp Premium →"}</button>
            <button type="button" className={v13.secondaryAction} onClick={onClose}>Quay lại Explore</button>
          </div>
        )}

        {modal.view === "PENDING" && booking && (
          <div className={v13.modalBody}>
            <div className={v13.pendingGlyph}>…</div>
            <span className={v13.modalEyebrow}>BOOKING · PENDING</span>
            <h2>Đang chờ PINO xác nhận</h2>
            <p className={v13.centerCopy}>{booking.id} · {session.title} · {session.time}</p>
            <div className={v13.infoBox}><strong>Booking đã tồn tại</strong><span>{booking.policy === "TRIAL" ? "Trial vẫn có thể đăng ký thêm Booking khác trong tuần." : booking.policy === "ACTIVE_PREMIUM" ? "Booking này đang chiếm quota 1 Booking chung của Premium trong tuần." : "Đăng ký không tạo Request entity riêng. Staff xử lý cùng lifecycle đã chốt."}</span></div>
            <div className={v13.twoActions}><button type="button" onClick={() => onAskCancel(booking, "PARENT")}>Huỷ booking</button><button type="button" className={v13.primaryAction} onClick={() => onConfirm(booking)}>Mô phỏng Staff confirm →</button></div>
            <button type="button" className={v13.staffAction} onClick={() => onReject(booking)}>Prototype · Staff reject</button>
          </div>
        )}

        {modal.view === "CONFIRMED" && booking && (
          <div className={v13.modalBody}>
            <div className={v13.confirmedGlyph}>✓</div>
            <span className={v13.modalEyebrow}>BOOKING · CONFIRMED</span>
            <h2>Hẹn gặp tại PINO</h2>
            <p className={v13.centerCopy}>{booking.id} · {session.title} · {session.time}</p>
            <div className={v13.infoBox}><strong>{booking.freeRule ? "Free weekly claim đã được giữ" : booking.policy === "TRIAL" ? "Trial Booking đã xác nhận" : "Premium weekly booking quota đang được dùng"}</strong><span>{booking.freeRule ? "Nếu Parent/Staff cancel trước Session theo policy, claim/capacity được release." : booking.policy === "TRIAL" ? "Trial có thể tiếp tục đăng ký thêm Open Studio hoặc Premium Session trong cùng tuần." : "Open Studio và Premium Session dùng chung quota 1 Booking; Booking này đang giữ slot cho đến khi thành terminal state."}</span></div>
            <div className={v13.twoActions}><button type="button" onClick={() => onAskCancel(booking, "PARENT")}>Huỷ booking</button><button type="button" className={v13.secondaryAction} onClick={onClose}>Đóng</button></div>
            <button type="button" className={v13.staffAction} onClick={() => onAskCancel(booking, "STAFF")}>Prototype · Staff cancel</button>
          </div>
        )}

        {modal.view === "BLOCKED_MEMBER_QUOTA" && booking && (
          <div className={v13.modalBody}>
            <div className={v13.blockedGlyph}>1</div>
            <span className={v13.modalEyebrow}>PREMIUM · WEEKLY BOOKING QUOTA</span>
            <h2>Tuần này đã có một Booking đang giữ</h2>
            <p className={v13.centerCopy}>{booking.id} · {booking.session.kind === "PREMIUM" ? "Premium Session" : "Open Studio"} · {booking.session.title}</p>
            <div className={v13.infoBox}><strong>Open Studio + Premium Session dùng chung quota</strong><span>Active Premium chỉ giữ tối đa 1 Booking PENDING hoặc CONFIRMED trong tuần. Muốn chọn buổi khác, hãy huỷ Booking hiện tại trước.</span></div>
            <div className={v13.twoActions}><button type="button" onClick={onClose}>Giữ booking hiện tại</button><button type="button" className={v13.primaryAction} onClick={() => onAskCancel(booking, "PARENT")}>Huỷ để chọn buổi khác →</button></div>
          </div>
        )}

        {modal.view === "BLOCKED_PENDING" && booking && (
          <div className={v13.modalBody}>
            <div className={v13.pendingGlyph}>1</div>
            <span className={v13.modalEyebrow}>FREE · ACTIVE BOOKING</span>
            <h2>Đang có một Booking chờ xác nhận</h2>
            <p className={v13.centerCopy}>{booking.id} · {booking.session.title}</p>
            <div className={v13.infoBox}><strong>Mỗi Student Free chỉ giữ 1 Booking cùng lúc</strong><span>Huỷ Booking hiện tại trước nếu muốn chọn Open Studio khác.</span></div>
            <button type="button" className={v13.primaryAction} onClick={() => onAskCancel(booking, "PARENT")}>Huỷ để chọn buổi khác →</button>
          </div>
        )}

        {modal.view === "BLOCKED_CONFIRMED" && (
          <div className={v13.modalBody}>
            <div className={v13.blockedGlyph}>1</div>
            <span className={v13.modalEyebrow}>FREE · CONFIRMED</span>
            <h2>Open Studio Free tuần này đã được xác nhận</h2>
            <p className={v13.centerCopy}>{booking ? `${booking.id} · ${booking.session.title}` : "Weekly Free allowance đang được sử dụng."}</p>
            {booking && <button type="button" className={v13.secondaryAction} onClick={() => onAskCancel(booking, "PARENT")}>Quản lý / huỷ booking hiện tại</button>}
            <button type="button" className={v13.primaryAction} onClick={onPremium}>Khám phá Premium →</button>
          </div>
        )}

        {modal.view === "CANCEL_CONFIRM" && booking && modal.cancelActor && (
          <div className={v13.modalBody}>
            <div className={v13.cancelGlyph}>×</div>
            <span className={v13.modalEyebrow}>CANCEL BOOKING</span>
            <h2>{modal.cancelActor === "PARENT" ? "Bạn muốn huỷ booking này?" : "Mô phỏng Staff huỷ booking"}</h2>
            <p className={v13.centerCopy}>{booking.id} · {booking.session.title}</p>
            <div className={v13.infoBox}><strong>Booking không bị xoá</strong><span>Status đổi thành CANCELLED; actor Parent/Staff và thời điểm vẫn được giữ trong history. Terminal Booking không còn chiếm active booking slot.</span></div>
            <div className={v13.twoActions}><button type="button" onClick={onClose}>Giữ booking</button><button type="button" className={v13.dangerAction} onClick={() => onCancel(booking, modal.cancelActor as CancelActor)}>Xác nhận huỷ →</button></div>
          </div>
        )}

        {modal.view === "CANCELLED" && booking && (
          <div className={v13.modalBody}>
            <div className={v13.cancelGlyph}>×</div>
            <span className={v13.modalEyebrow}>BOOKING · CANCELLED</span>
            <h2>{booking.cancelledBy === "PARENT" ? "Bạn đã huỷ booking" : "PINO đã huỷ booking"}</h2>
            <p className={v13.centerCopy}>{booking.id} · {booking.session.title}</p>
            <div className={v13.historyGrid}><span><small>Cancelled by</small><strong>{booking.cancelledBy === "PARENT" ? "Parent" : "Staff"}</strong></span><span><small>Cancelled at</small><strong>{booking.cancelledAt}</strong></span><span><small>Record</small><strong>Retained</strong></span></div>
            <button type="button" className={v13.primaryAction} onClick={onClose}>Quay lại Explore</button>
          </div>
        )}

        {modal.view === "REJECTED" && booking && (
          <div className={v13.modalBody}>
            <div className={v13.blockedGlyph}>!</div>
            <span className={v13.modalEyebrow}>BOOKING · REJECTED</span>
            <h2>PINO chưa thể xác nhận buổi này</h2>
            <p className={v13.centerCopy}>{booking.id} · {booking.session.title}</p>
            <div className={v13.infoBox}><strong>Lịch sử vẫn giữ</strong><span>Rejected không xoá Booking và không còn chiếm active booking slot. Với Free pending, weekly claim vẫn chưa bị consume.</span></div>
            <button type="button" className={v13.primaryAction} onClick={onClose}>Chọn buổi khác</button>
          </div>
        )}
      </section>
    </div>
  );
}

function SessionHero({ session, compact = false }: { session: ExploreSession; compact?: boolean }) {
  return (
    <div className={`${v13.sessionHero} ${compact ? v13.sessionHeroCompact : ""} ${session.kind === "PREMIUM" ? v13.sessionHeroPremium : ""}`}>
      <span>{session.emoji}</span>
      <div><small>{session.kind === "PREMIUM" ? "PREMIUM SESSION" : "OPEN STUDIO"} · {session.path} · {session.age}</small><strong>{session.time}</strong><p>{session.title}</p></div>
    </div>
  );
}
