"use client";

import { FormEvent, MouseEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PinerPrototypeV22 from "./PinerPrototypeV22";
import { scenarios, type MembershipMode } from "./fixtures-v2";
import v23 from "./piner-prototype-v23.module.css";
import { findPrototypeDevice, updatePrototypeBadge } from "./prototype-dom";
import { usePrototypePolish } from "./usePrototypePolish";

type ExploreFilter = "ALL" | "EXPLORE" | "PREMIUM";
type SortDirection = "ASC" | "DESC";
type SessionKind = "EXPLORE" | "PREMIUM";

type SessionSnapshot = {
  title: string;
  kind: SessionKind;
  path: string;
  ageLabel: string;
  time: string;
};

type GuestRegistration = {
  id: string;
  participantName: string;
  participantAge: number;
  session: SessionSnapshot;
  sourceStudent: string;
  ageMismatchAcknowledged: true;
};

type FlowModal =
  | { type: "PREMIUM_LOCK"; session: SessionSnapshot; studentName: string }
  | { type: "TRIAL_AGE_WARNING"; session: SessionSnapshot; studentName: string; studentAge: number }
  | { type: "GUEST_REGISTRATION"; session: SessionSnapshot; studentName: string; studentAge: number }
  | { type: "GUEST_SUCCESS"; registration: GuestRegistration }
  | null;

const TOUCHPOINT_DESCRIPTIONS: Record<string, string> = {
  "minh-premium": "Tiếp tục Always With Me qua Verse 1, phối hợp hai tay với Single Bass trong bài đang học.",
  "mia-lpa": "Khám phá âm thanh mưa và điều khiển pipette để tạo đường mưa; kết hợp xé dán ô và mây.",
  "han-trial-ac": "Khám phá ánh sáng và bóng tối để tạo chiều sâu, khối đá và không khí cho hẻm núi Terravia.",
  "bo-lpp": "Ghép giai điệu quen thuộc với thế tay và hai tay đơn giản trong bài hát đang học.",
};

export default function PinerPrototypeV23() {
  const rootRef = useRef<HTMLDivElement>(null);
  const allowOriginalClickRef = useRef(false);
  const pendingOriginalButtonRef = useRef<HTMLButtonElement | null>(null);
  const registrationSequenceRef = useRef(1);
  const ageAuditRef = useRef<Array<{ student: string; session: string; age: number; acceptedAt: string }>>([]);
  const filterRef = useRef<ExploreFilter>("ALL");
  const sortRef = useRef<SortDirection>("ASC");
  const [filter, setFilter] = useState<ExploreFilter>("ALL");
  const [sortDirection, setSortDirection] = useState<SortDirection>("ASC");
  const [controlsTarget, setControlsTarget] = useState<HTMLElement | null>(null);
  const [flowModal, setFlowModal] = useState<FlowModal>(null);
  const [guestName, setGuestName] = useState("");
  const [guestAge, setGuestAge] = useState("");
  const [guestAcknowledged, setGuestAcknowledged] = useState(false);

  filterRef.current = filter;
  sortRef.current = sortDirection;

  usePrototypePolish(rootRef, (root) => {
    const target = ensureExploreControlsMount(root);
    setControlsTarget((current) => current === target ? current : target);
    polishExploreAccess(root);
    applyExploreView(root, filterRef.current, sortRef.current);
    polishTouchpointDescription(root);
    updatePrototypeBadge(root, "BẢN THỬ NỘI BỘ · STAGING");
  }, { listenToChange: true, observeMutations: true });
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    applyExploreView(root, filter, sortDirection);
  }, [filter, sortDirection]);

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) return;

    if (allowOriginalClickRef.current && button === pendingOriginalButtonRef.current) {
      allowOriginalClickRef.current = false;
      pendingOriginalButtonRef.current = null;
      return;
    }

    const card = button.closest<HTMLElement>("[data-v22-session-card='true']");
    if (!card) return;
    const register = card.querySelector<HTMLButtonElement>(":scope > button:last-child");
    if (register !== button) return;

    const root = rootRef.current;
    if (!root) return;
    const scenario = currentScenario(root);
    const mode = scenario?.mode;
    const studentName = scenario?.name ?? "Học viên";
    const studentAge = parseStudentAge(scenario?.ageLabel) ?? 0;
    const session = snapshotSession(card);
    if (!session) return;

    if (session.kind === "PREMIUM" && mode !== "TRIAL_PREMIUM" && mode !== "ACTIVE_PREMIUM") {
      event.preventDefault();
      event.stopPropagation();
      setFlowModal({ type: "PREMIUM_LOCK", session, studentName });
      return;
    }

    const ageMismatch = session.kind === "EXPLORE" && studentAge > 0 && !ageMatches(studentAge, session.ageLabel);
    if (!ageMismatch) return;

    if (mode === "TRIAL_PREMIUM") {
      event.preventDefault();
      event.stopPropagation();
      pendingOriginalButtonRef.current = button;
      setGuestAcknowledged(false);
      setFlowModal({ type: "TRIAL_AGE_WARNING", session, studentName, studentAge });
      return;
    }

    if (mode) {
      event.preventDefault();
      event.stopPropagation();
      setGuestName("");
      setGuestAge("");
      setGuestAcknowledged(false);
      setFlowModal({ type: "GUEST_REGISTRATION", session, studentName, studentAge });
    }
  }

  function continueTrialAgeMismatch() {
    if (!flowModal || flowModal.type !== "TRIAL_AGE_WARNING" || !guestAcknowledged) return;
    ageAuditRef.current.push({
      student: flowModal.studentName,
      session: flowModal.session.title,
      age: flowModal.studentAge,
      acceptedAt: new Date().toISOString(),
    });
    setFlowModal(null);
    const button = pendingOriginalButtonRef.current;
    if (!button?.isConnected) return;
    allowOriginalClickRef.current = true;
    window.setTimeout(() => button.click(), 0);
  }

  function createGuestRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!flowModal || flowModal.type !== "GUEST_REGISTRATION") return;
    const age = Number(guestAge);
    if (!guestName.trim() || !Number.isFinite(age) || age <= 0 || !guestAcknowledged) return;

    const registration: GuestRegistration = {
      id: `REG-${String(registrationSequenceRef.current++).padStart(4, "0")}`,
      participantName: guestName.trim(),
      participantAge: age,
      session: flowModal.session,
      sourceStudent: flowModal.studentName,
      ageMismatchAcknowledged: true,
    };
    setFlowModal({ type: "GUEST_SUCCESS", registration });
  }

  const portalTarget = flowModal ? findPrototypeDevice(rootRef.current) : null;

  return (
    <div ref={rootRef} className={v23.root} onClickCapture={handleClickCapture}>
      <PinerPrototypeV22 />

      {controlsTarget && createPortal(
        <ExploreControls
          filter={filter}
          sortDirection={sortDirection}
          onFilter={setFilter}
          onSort={() => setSortDirection((current) => current === "ASC" ? "DESC" : "ASC")}
        />,
        controlsTarget,
      )}

      {flowModal && portalTarget && createPortal(
        <RegistrationModal
          modal={flowModal}
          guestName={guestName}
          guestAge={guestAge}
          guestAcknowledged={guestAcknowledged}
          onGuestName={setGuestName}
          onGuestAge={setGuestAge}
          onAcknowledged={setGuestAcknowledged}
          onClose={() => setFlowModal(null)}
          onContinueTrial={continueTrialAgeMismatch}
          onCreateGuest={createGuestRegistration}
        />,
        portalTarget,
      )}
    </div>
  );
}

function ExploreControls({ filter, sortDirection, onFilter, onSort }: {
  filter: ExploreFilter;
  sortDirection: SortDirection;
  onFilter: (filter: ExploreFilter) => void;
  onSort: () => void;
}) {
  return (
    <div className={v23.exploreControls}>
      <div className={v23.filterGroup} aria-label="Lọc loại buổi">
        <button type="button" data-active={filter === "ALL"} onClick={() => onFilter("ALL")}>Tất cả</button>
        <button type="button" data-kind="explore" data-active={filter === "EXPLORE"} onClick={() => onFilter("EXPLORE")}>Khám Phá</button>
        <button type="button" data-kind="premium" data-active={filter === "PREMIUM"} onClick={() => onFilter("PREMIUM")}>Premium</button>
      </div>
      <button type="button" className={v23.sortButton} onClick={onSort} aria-label="Đổi thứ tự theo ngày">
        Ngày {sortDirection === "ASC" ? "↑" : "↓"}
      </button>
    </div>
  );
}

function RegistrationModal({ modal, guestName, guestAge, guestAcknowledged, onGuestName, onGuestAge, onAcknowledged, onClose, onContinueTrial, onCreateGuest }: {
  modal: NonNullable<FlowModal>;
  guestName: string;
  guestAge: string;
  guestAcknowledged: boolean;
  onGuestName: (value: string) => void;
  onGuestAge: (value: string) => void;
  onAcknowledged: (value: boolean) => void;
  onClose: () => void;
  onContinueTrial: () => void;
  onCreateGuest: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className={v23.modalBackdrop} onMouseDown={onClose}>
      <section className={v23.modalCard} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className={v23.modalClose} onClick={onClose} aria-label="Đóng">×</button>

        {modal.type === "PREMIUM_LOCK" && (
          <div className={v23.modalBody}>
            <span className={v23.modalEyebrow}>PREMIUM</span>
            <h2>Buổi này cần Premium đang hoạt động</h2>
            <p>{modal.studentName} hiện chưa có quyền Premium phù hợp cho buổi này. Các buổi Khám Phá vẫn có thể đăng ký khi hồ sơ đủ điều kiện.</p>
            <SessionSummary session={modal.session} />
            <button type="button" className={v23.secondaryAction} onClick={onClose}>Quay lại Khám Phá</button>
          </div>
        )}

        {modal.type === "TRIAL_AGE_WARNING" && (
          <div className={v23.modalBody}>
            <span className={v23.modalEyebrow}>KIỂM TRA ĐỘ TUỔI</span>
            <h2>Buổi này khác nhóm tuổi của {modal.studentName}</h2>
            <p>Hồ sơ hiện tại: {modal.studentAge} tuổi. Buổi Khám Phá này được thiết kế cho nhóm {modal.session.ageLabel}. Trial vẫn cho phép tiếp tục, nhưng xác nhận này được lưu để PINO đối chiếu.</p>
            <SessionSummary session={modal.session} />
            <label className={v23.ackRow}>
              <input type="checkbox" checked={guestAcknowledged} onChange={(event) => onAcknowledged(event.target.checked)} />
              <span>Tôi đã xem cảnh báo độ tuổi và vẫn muốn tiếp tục.</span>
            </label>
            <button type="button" className={v23.primaryAction} disabled={!guestAcknowledged} onClick={onContinueTrial}>Tiếp tục đăng ký</button>
          </div>
        )}

        {modal.type === "GUEST_REGISTRATION" && (
          <form className={v23.modalBody} onSubmit={onCreateGuest}>
            <span className={v23.modalEyebrow}>ĐĂNG KÝ CHO BÉ KHÁC</span>
            <h2>Nhóm tuổi chưa khớp với {modal.studentName}</h2>
            <p>{modal.studentName} đang {modal.studentAge} tuổi, trong khi buổi này dành cho {modal.session.ageLabel}. Bạn vẫn có thể ghi nhận cho anh/chị/em khác; trường hợp này tạo Registration riêng, không tạo Booking cho Student hiện tại.</p>
            <SessionSummary session={modal.session} />
            <div className={v23.formGrid}>
              <label><span>Tên bé tham gia</span><input value={guestName} onChange={(event) => onGuestName(event.target.value)} placeholder="Tên của bé" /></label>
              <label><span>Tuổi</span><input type="number" min="1" max="18" value={guestAge} onChange={(event) => onGuestAge(event.target.value)} placeholder="8" /></label>
            </div>
            <label className={v23.ackRow}>
              <input type="checkbox" checked={guestAcknowledged} onChange={(event) => onAcknowledged(event.target.checked)} />
              <span>Tôi xác nhận đây là bé khác và thông tin tên/tuổi ở trên là đúng.</span>
            </label>
            <button type="submit" className={v23.primaryAction} disabled={!guestName.trim() || !guestAge || !guestAcknowledged}>Tạo registration</button>
          </form>
        )}

        {modal.type === "GUEST_SUCCESS" && (
          <div className={v23.modalBody}>
            <span className={v23.modalEyebrow}>REGISTRATION · ĐÃ GHI NHẬN</span>
            <h2>{modal.registration.participantName} · {modal.registration.participantAge} tuổi</h2>
            <p>{modal.registration.id} được tạo cho bé khác. Booking của {modal.registration.sourceStudent} không bị tạo hoặc thay đổi.</p>
            <SessionSummary session={modal.registration.session} />
            <button type="button" className={v23.primaryAction} onClick={onClose}>Xong</button>
          </div>
        )}
      </section>
    </div>
  );
}

function SessionSummary({ session }: { session: SessionSnapshot }) {
  return (
    <div className={v23.sessionSummary}>
      <span>{session.kind === "PREMIUM" ? "Premium" : "Khám Phá"}</span>
      <strong>{session.title}</strong>
      <small>{session.path} · {session.ageLabel} · {session.time}</small>
    </div>
  );
}

function ensureExploreControlsMount(root: HTMLElement) {
  const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-v22-session-card='true']"));
  const list = cards[0]?.parentElement;
  if (!list) return null;
  const section = list.closest("section");
  if (!section) return null;

  const legacyLegend = Array.from(section.querySelectorAll<HTMLElement>("div")).find((candidate) => {
    const text = candidate.textContent?.trim() ?? "";
    const directSpans = candidate.querySelectorAll(":scope > span");
    return directSpans.length === 2 && text.includes("KHÁM PHÁ") && text.includes("PREMIUM");
  });
  if (legacyLegend) legacyLegend.dataset.v23LegacyLegend = "true";

  let mount = section.querySelector<HTMLElement>("[data-v23-controls-mount='true']");
  if (!mount) {
    mount = document.createElement("div");
    mount.dataset.v23ControlsMount = "true";
    list.parentElement?.insertBefore(mount, list);
  }
  return mount;
}

function applyExploreView(root: HTMLElement, filter: ExploreFilter, direction: SortDirection) {
  const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-v22-session-card='true']"));
  if (!cards.length) return;

  const ranked = [...cards].sort((a, b) => {
    const priority = (card: HTMLElement) => card.dataset.v23AgeMismatch === "true" ? 2 : card.dataset.v23PremiumLocked === "true" ? 1 : 0;
    const priorityDelta = priority(a) - priority(b);
    if (priorityDelta !== 0) return priorityDelta;
    const delta = sessionSortValue(a) - sessionSortValue(b);
    return direction === "ASC" ? delta : -delta;
  });

  const rank = new Map(ranked.map((card, index) => [card, index]));
  cards.forEach((card) => {
    const premium = card.dataset.v21SessionPremium === "true";
    const visible = filter === "ALL" || (filter === "PREMIUM" ? premium : !premium);
    card.style.order = String(rank.get(card) ?? 0);
    if (visible) card.style.removeProperty("display");
    else card.style.display = "none";
  });
}

function polishExploreAccess(root: HTMLElement) {
  const scenario = currentScenario(root);
  const mode = scenario?.mode;
  const studentAge = parseStudentAge(scenario?.ageLabel) ?? 0;
  const premiumAllowed = mode === "TRIAL_PREMIUM" || mode === "ACTIVE_PREMIUM";
  const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-v22-session-card='true']"));

  cards.forEach((card) => {
    const premium = card.dataset.v21SessionPremium === "true";
    const session = snapshotSession(card);
    const ageMismatch = !premium && Boolean(session) && studentAge > 0 && !ageMatches(studentAge, session?.ageLabel ?? "");
    card.dataset.v23AgeMismatch = ageMismatch ? "true" : "false";

    const button = card.querySelector<HTMLButtonElement>(":scope > button:last-child");
    const buttonLabel = button?.querySelector<HTMLElement>(":scope > span");
    const topline = card.querySelector<HTMLElement>("[data-v21-session-topline='true']");
    let ageBadge = topline?.querySelector<HTMLElement>("[data-v23-age-badge='true']") ?? null;
    if (ageMismatch && topline && !ageBadge) {
      ageBadge = document.createElement("span");
      ageBadge.dataset.v23AgeBadge = "true";
      ageBadge.textContent = "Khác nhóm tuổi";
      topline.appendChild(ageBadge);
    }
    if (!ageMismatch) ageBadge?.remove();

    if (!premium) {
      const nextLabel = ageMismatch ? (mode === "TRIAL_PREMIUM" ? "Xem độ tuổi" : "Cho bé khác") : "Đăng ký";
      if (buttonLabel && buttonLabel.textContent !== nextLabel) buttonLabel.textContent = nextLabel;
      if (button && button.getAttribute("aria-label") !== nextLabel) button.setAttribute("aria-label", nextLabel);
      return;
    }

    card.dataset.v23PremiumLocked = premiumAllowed ? "false" : "true";
    const nextLabel = premiumAllowed ? "Đăng ký" : "Xem Premium";
    if (buttonLabel && buttonLabel.textContent !== nextLabel) buttonLabel.textContent = nextLabel;
    if (button && button.getAttribute("aria-label") !== nextLabel) button.setAttribute("aria-label", nextLabel);
    if (!topline) return;
    let lock = topline.querySelector<HTMLElement>("[data-v23-access-lock='true']");
    if (!premiumAllowed && !lock) {
      lock = document.createElement("span");
      lock.dataset.v23AccessLock = "true";
      lock.textContent = "Cần Premium";
      topline.appendChild(lock);
    }
    if (premiumAllowed) lock?.remove();
  });
}

function polishTouchpointDescription(root: HTMLElement) {
  const scenarioKey = root.querySelector<HTMLSelectElement>("#scenario")?.value ?? "";
  const description = TOUCHPOINT_DESCRIPTIONS[scenarioKey];
  const details = Array.from(root.querySelectorAll<HTMLElement>("[data-v22-touchpoint-detail='true']"));
  details.forEach((detail) => {
    let block = detail.querySelector<HTMLElement>("[data-v23-touchpoint-description='true']");
    if (!description) {
      block?.remove();
      return;
    }
    if (!block) {
      block = document.createElement("div");
      block.dataset.v23TouchpointDescription = "true";
      const label = document.createElement("small");
      label.textContent = "Mô tả buổi học";
      const paragraph = document.createElement("p");
      block.append(label, paragraph);
      detail.appendChild(block);
    }
    const paragraph = block.querySelector("p");
    if (paragraph) paragraph.textContent = description;
  });
}

function currentScenario(root: HTMLElement) {
  const key = root.querySelector<HTMLSelectElement>("#scenario")?.value ?? "";
  return scenarios.find((scenario) => scenario.key === key)
    ?? (key === "leo-trial" ? { name: "Leo", ageLabel: "12 tuổi", mode: "TRIAL_PREMIUM" as MembershipMode }
      : key === "leo-reenrolled" ? { name: "Leo", ageLabel: "12 tuổi", mode: "ACTIVE_PREMIUM" as MembershipMode }
      : key === "leo-attrition" ? { name: "Leo", ageLabel: "12 tuổi", mode: "EXPIRED_PREMIUM" as MembershipMode }
      : undefined);
}

function snapshotSession(card: HTMLElement): SessionSnapshot | null {
  const title = card.querySelector<HTMLElement>("[data-v21-session-copy='true'] > strong")?.textContent?.trim()
    ?? card.querySelector<HTMLElement>("strong")?.textContent?.trim()
    ?? "";
  if (!title) return null;
  const context = card.querySelector<HTMLElement>("[data-v21-session-context='true']")?.textContent?.trim() ?? "";
  const ageLabel = context.match(/(\d+\+|\d+\s*[–-]\s*\d+)/)?.[1]?.replace(/\s+/g, "") ?? "";
  const path = context.replace(/·?\s*(\d+\+|\d+\s*[–-]\s*\d+).*$/, "").trim().replace(/·$/, "").trim();
  const day = card.querySelector<HTMLElement>("[data-v22-session-day='true']")?.textContent?.trim() ?? "";
  const clock = card.querySelector<HTMLElement>("[data-v22-session-clock='true']")?.textContent?.trim() ?? "";
  return {
    title,
    kind: card.dataset.v21SessionPremium === "true" ? "PREMIUM" : "EXPLORE",
    path: path || "PINO",
    ageLabel: ageLabel || "mọi độ tuổi",
    time: [day, clock].filter(Boolean).join(" · "),
  };
}

function parseStudentAge(ageLabel?: string) {
  const match = ageLabel?.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function ageMatches(age: number, label: string) {
  const plus = label.match(/^(\d+)\+$/);
  if (plus) return age >= Number(plus[1]);
  const range = label.match(/^(\d+)[–-](\d+)$/);
  if (range) return age >= Number(range[1]) && age <= Number(range[2]);
  return true;
}

function sessionSortValue(card: HTMLElement) {
  const day = card.querySelector<HTMLElement>("[data-v22-session-day='true']")?.textContent?.trim() ?? "";
  const clock = card.querySelector<HTMLElement>("[data-v22-session-clock='true']")?.textContent?.trim() ?? "";
  const dayOrder = day.includes("Thứ Hai") ? 1
    : day.includes("Thứ Ba") ? 2
    : day.includes("Thứ Tư") ? 3
    : day.includes("Thứ Năm") ? 4
    : day.includes("Thứ Sáu") ? 5
    : day.includes("Thứ Bảy") ? 6
    : day.includes("Chủ Nhật") ? 7
    : 99;
  const time = clock.match(/(\d{1,2}):(\d{2})/);
  const minutes = time ? Number(time[1]) * 60 + Number(time[2]) : 0;
  return dayOrder * 1440 + minutes;
}
