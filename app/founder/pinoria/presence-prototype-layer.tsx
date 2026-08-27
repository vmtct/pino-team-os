"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import pinoriaStyles from "./pinoria.module.css";
import styles from "./presence-prototype-layer.module.css";

type PresenceCandidate = {
  id: string;
  name: string;
  path: string;
  session: string;
  room: string;
  companion: string;
  pls: number;
  fruit: number;
  checkout: string;
  existingCard: boolean;
};

type RecentPresentation = {
  id: string;
  learnerId: string;
  mode: "arrival" | "departure";
  label: "Chào đến" | "Chào về";
  occurredAt: string;
};

type TVMode = "ambient" | "arrival" | "choice" | "ritual" | "departure" | "news";

type AttentionItem = {
  key: string;
  learnerId: string;
  kind: "choice" | "ritual";
  meta: string;
  title: string;
  action: string;
};

type StaffAccess = {
  name: string;
  role: string;
  checkedInAtPino: boolean;
  withinPresenceWindow: boolean;
  canManagePresence: boolean;
};

const SURFACE_ID = "RECEPTION_TV";
const RELAY_URL = "/api/pinoria-prototype/tv-relay";
const SHIFT_LABEL = "Ca 14:00–21:00";
const PRESENCE_WINDOW_LABEL = "Window 13:45–21:15";

const candidates: PresenceCandidate[] = [
  { id: "bo", name: "Bơ", path: "ArtChitect · Màu nước II", session: "18:00 · ArtChitect", room: "Phòng Họa", companion: "Bùm · Ploo · Cấp 2", pls: 420, fruit: 2, checkout: "19:30", existingCard: true },
  { id: "tri", name: "Trí", path: "PianoHouse · Bản Thu Khởi Hành I", session: "18:30 · PianoHouse", room: "Phòng Đàn", companion: "Miso · Mori · Cấp 3", pls: 760, fruit: 1, checkout: "20:00", existingCard: true },
  { id: "an", name: "An", path: "Little Piner Art · Chủ đề Rừng", session: "17:30 · Little Piner", room: "Phòng Little Piner", companion: "Mây · Vayu · Cấp 1", pls: 180, fruit: 3, checkout: "18:45", existingCard: true },
  { id: "lan", name: "Lan", path: "Open Studio · Piano", session: "17:30 · Open Studio", room: "Khu chung", companion: "Chưa có Hộ Linh", pls: 40, fruit: 0, checkout: "18:30", existingCard: true },
  { id: "mai", name: "Mai", path: "ArtChitect · Màu nước I", session: "18:00 · ArtChitect", room: "Phòng Họa", companion: "Kiri · Vayu · Cấp 1", pls: 260, fruit: 2, checkout: "19:30", existingCard: false },
];

const initialPresence: Record<string, boolean> = {
  bo: true,
  tri: true,
  an: true,
  lan: true,
  mai: false,
};

const initialRecent: RecentPresentation[] = [
  { id: "seed-bo-arrival", learnerId: "bo", mode: "arrival", label: "Chào đến", occurredAt: "18:01" },
  { id: "seed-tri-arrival", learnerId: "tri", mode: "arrival", label: "Chào đến", occurredAt: "18:31" },
];

const baseAttention: AttentionItem[] = [
  { key: "an-choice", learnerId: "an", kind: "choice", meta: "An · Tan học 18:45", title: "Mũ Lá A1 đang chờ xử lý", action: "Xử lý" },
  { key: "bo-choice", learnerId: "bo", kind: "choice", meta: "Bơ · Tan học 19:30", title: "Túi Rêu B2 đang chờ xử lý", action: "Xử lý" },
  { key: "bo-ritual", learnerId: "bo", kind: "ritual", meta: "Bơ · Hộ Linh Bùm", title: "Bùm đã sẵn sàng Hiện hình", action: "Nghi lễ" },
];

const initialStaffAccess: StaffAccess = {
  name: "Hằng",
  role: "Ops",
  checkedInAtPino: true,
  withinPresenceWindow: true,
  canManagePresence: true,
};

const tvModeLabels: Record<TVMode, string> = {
  ambient: "Không gian thường nhật",
  arrival: "Chào đến",
  choice: "Chọn nhanh",
  ritual: "Nghi lễ Hộ Linh",
  departure: "Chào về",
  news: "Tin Pinoria",
};

export function PresencePrototypeLayer({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [present, setPresent] = useState<Record<string, boolean>>(initialPresence);
  const [opsHost, setOpsHost] = useState<HTMLElement | null>(null);
  const [gridHost, setGridHost] = useState<HTMLElement | null>(null);
  const [listHeaderHost, setListHeaderHost] = useState<HTMLElement | null>(null);
  const [liveContentHost, setLiveContentHost] = useState<HTMLElement | null>(null);
  const [artRoomHost, setArtRoomHost] = useState<HTMLElement | null>(null);
  const [learnerActionHosts, setLearnerActionHosts] = useState<Record<string, HTMLElement>>({});
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkOutTarget, setCheckOutTarget] = useState<string | null>(null);
  const [accessReviewOpen, setAccessReviewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("mai");
  const [checkInQuery, setCheckInQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentPresentation[]>(initialRecent);
  const [dismissedAttention, setDismissedAttention] = useState<Record<string, boolean>>({});
  const [tvOnline, setTvOnline] = useState(false);
  const [tvMode, setTvMode] = useState<TVMode>("ambient");
  const [tvQueuedCount, setTvQueuedCount] = useState(0);
  const [staffAccess, setStaffAccess] = useState<StaffAccess>(initialStaffAccess);

  const presentLearners = useMemo(() => candidates.filter((item) => present[item.id]), [present]);
  const absentLearners = useMemo(() => candidates.filter((item) => !present[item.id]), [present]);
  const visibleAbsentLearners = useMemo(() => {
    const query = checkInQuery.trim().toLocaleLowerCase("vi-VN");
    if (!query) return absentLearners;
    return absentLearners.filter((item) => `${item.name} ${item.path} ${item.session}`.toLocaleLowerCase("vi-VN").includes(query));
  }, [absentLearners, checkInQuery]);
  const selected = candidates.find((item) => item.id === selectedId) ?? visibleAbsentLearners[0] ?? absentLearners[0] ?? candidates[0];
  const checkoutLearner = candidates.find((item) => item.id === checkOutTarget) ?? null;
  const nextCheckout = [...presentLearners].sort((a, b) => a.checkout.localeCompare(b.checkout))[0] ?? null;
  const attentionItems = baseAttention.filter((item) => present[item.learnerId] && !dismissedAttention[item.key]);
  const presenceAllowed = staffAccess.checkedInAtPino && staffAccess.withinPresenceWindow && staffAccess.canManagePresence;

  const accessReason = !staffAccess.checkedInAtPino
    ? "Bạn chưa check-in nhân sự tại PINO."
    : !staffAccess.withinPresenceWindow
      ? "Hiện ngoài window được phép Vào học / Tan học."
      : !staffAccess.canManagePresence
        ? "Tài khoản chưa có quyền presence.manage."
        : "Đủ điều kiện Vào học / Tan học.";

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let stopped = false;

    async function pollSurface() {
      try {
        const response = await fetch(`${RELAY_URL}?surfaceId=${SURFACE_ID}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { surface?: { online?: boolean; mode?: TVMode; queuedCount?: number } };
        if (stopped || !data.surface) return;
        setTvOnline(!!data.surface.online);
        setTvMode(data.surface.mode ?? "ambient");
        setTvQueuedCount(data.surface.queuedCount ?? 0);
      } catch {
        if (!stopped) setTvOnline(false);
      }
    }

    void pollSurface();
    const timer = window.setInterval(() => { void pollSurface(); }, 1800);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const handleClick = (event: Event) => {
      const button = (event.target as Element | null)?.closest("button");
      if (!button) return;
      const card = button.closest<HTMLElement>(`.${pinoriaStyles.learnerCard}`);
      if (!card) return;
      const name = card.querySelector("h3")?.textContent?.trim();
      const candidate = candidates.find((item) => item.name === name);
      if (!candidate) return;
      const text = button.textContent?.toLocaleLowerCase("vi-VN") ?? "";
      if (text.includes("resolve") || text.includes("xử lý") || text.includes("purchase") || text.includes("mua")) {
        setDismissedAttention((current) => ({ ...current, [`${candidate.id}-choice`]: true }));
      }
      if (text.includes("ritual") || text.includes("nghi lễ")) {
        setDismissedAttention((current) => ({ ...current, [`${candidate.id}-ritual`]: true }));
      }
    };

    root.addEventListener("click", handleClick);
    return () => root.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const syncHosts = () => {
      const sectionHeads = Array.from(root.querySelectorAll<HTMLElement>(`.${pinoriaStyles.sectionHead}`));
      const liveHead = sectionHeads.find((head) => {
        const title = head.querySelector("h1")?.textContent?.trim() ?? "";
        return title === "Live House" || title === "Nhà PINO hôm nay";
      });

      if (!liveHead) {
        setOpsHost(null);
        setGridHost(null);
        setListHeaderHost(null);
        setLiveContentHost(null);
        return;
      }

      const originalActions = liveHead.querySelector<HTMLElement>(`.${pinoriaStyles.sectionActions}`);
      originalActions?.querySelectorAll<HTMLElement>("button").forEach((button) => { button.style.display = "none"; });

      let commandHost = liveHead.parentElement?.querySelector<HTMLElement>("[data-pinoria-ops-command-host]") ?? null;
      if (!commandHost && liveHead.parentElement) {
        commandHost = document.createElement("div");
        commandHost.dataset.pinoriaOpsCommandHost = "true";
        liveHead.insertAdjacentElement("afterend", commandHost);
      }
      setOpsHost(commandHost);

      const siblingElements = liveHead.parentElement ? Array.from(liveHead.parentElement.children) as HTMLElement[] : [];
      const metricGrid = siblingElements.find((element) => element.classList.contains(pinoriaStyles.metricGrid));
      if (metricGrid) metricGrid.style.display = "none";

      const liveGrid = siblingElements.find((element) => element.classList.contains(pinoriaStyles.liveGrid));
      if (liveGrid) {
        liveGrid.style.gridTemplateColumns = "1fr";
        const legacyAttention = liveGrid.children[1] as HTMLElement | undefined;
        if (legacyAttention) legacyAttention.style.display = "none";
      }

      const learnerGrid = liveHead.parentElement?.querySelector<HTMLElement>(`.${pinoriaStyles.learnerGrid}`) ?? null;
      setGridHost(learnerGrid);
      setLiveContentHost(learnerGrid?.parentElement ?? null);

      let headerHost = liveHead.parentElement?.querySelector<HTMLElement>("[data-pinoria-presence-list-host]") ?? null;
      if (learnerGrid && !headerHost) {
        headerHost = document.createElement("div");
        headerHost.dataset.pinoriaPresenceListHost = "true";
        learnerGrid.insertAdjacentElement("beforebegin", headerHost);
      }
      setListHeaderHost(headerHost);

      const hosts: Record<string, HTMLElement> = {};
      root.querySelectorAll<HTMLElement>(`.${pinoriaStyles.learnerCard}`).forEach((card) => {
        const name = card.querySelector("h3")?.textContent?.trim();
        if (!name) return;
        const candidate = candidates.find((item) => item.name === name);
        const host = card.querySelector<HTMLElement>(`.${pinoriaStyles.actionStack}`);
        if (candidate && host) {
          hosts[candidate.id] = host;
          host.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
            const text = button.textContent?.toLocaleLowerCase("vi-VN") ?? "";
            if (text.includes("feed fruit") || text.includes("cho ăn trái pinoria")) button.style.display = "none";
          });
        }
      });
      setLearnerActionHosts(hosts);

      let roomHost: HTMLElement | null = null;
      root.querySelectorAll<HTMLElement>(`.${pinoriaStyles.room}`).forEach((room) => {
        const label = room.querySelector("strong")?.textContent?.trim();
        if ((label === "Art Room" || label === "PHÒNG HỌA" || label === "Phòng Họa") && !roomHost) {
          roomHost = room.querySelector<HTMLElement>(":scope > div");
        }
      });
      setArtRoomHost(roomHost);
    };

    syncHosts();
    const observer = new MutationObserver(syncHosts);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    root.querySelectorAll<HTMLElement>(`.${pinoriaStyles.learnerCard}`).forEach((card) => {
      const name = card.querySelector("h3")?.textContent?.trim();
      const candidate = candidates.find((item) => item.name === name);
      if (candidate?.existingCard) card.style.display = present[candidate.id] ? "" : "none";
    });

    root.querySelectorAll<HTMLElement>(`.${pinoriaStyles.room} > div span`).forEach((chip) => {
      const candidate = candidates.find((item) => item.name === chip.textContent?.trim());
      if (candidate?.existingCard) chip.style.display = present[candidate.id] ? "" : "none";
    });
  }, [present, gridHost]);

  async function relayPost(body: Record<string, unknown>) {
    try {
      const response = await fetch(RELAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (!response.ok) return null;
      const data = await response.json() as { surface?: { online?: boolean; mode?: TVMode; queuedCount?: number } };
      if (data.surface) {
        setTvOnline(!!data.surface.online);
        setTvMode(data.surface.mode ?? "ambient");
        setTvQueuedCount(data.surface.queuedCount ?? 0);
      }
      return data;
    } catch {
      return null;
    }
  }

  function openTv() {
    const tv = window.open("/pinoria-tv", "pinoria-tv", "popup=yes,width=1440,height=900");
    tv?.focus();
    setToast("Đã mở TV Pinoria trên thiết bị này. Đây chỉ là tiện ích desktop; TV production chạy độc lập với TOS.");
  }

  async function returnToAmbient() {
    const result = await relayPost({ op: "enqueue-control", surfaceId: SURFACE_ID, action: "ambient" });
    setToast(result ? "Đã xếp lệnh đưa TV về Không gian thường nhật qua mock Core relay." : "Mock Core relay hiện không nhận được lệnh TV.");
  }

  async function queuePresentation(candidate: PresenceCandidate, mode: "arrival" | "departure", replay: boolean) {
    return relayPost({
      op: "enqueue-play",
      surfaceId: SURFACE_ID,
      mode,
      replay,
      subject: {
        id: candidate.id,
        name: candidate.name,
        path: candidate.path,
        room: candidate.room,
        companion: candidate.companion,
        pls: candidate.pls,
        fruit: candidate.fruit,
      },
    });
  }

  function pushRecent(candidate: PresenceCandidate, mode: "arrival" | "departure") {
    const now = new Date();
    const occurredAt = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const entry: RecentPresentation = {
      id: `${mode}-${candidate.id}-${Date.now()}`,
      learnerId: candidate.id,
      mode,
      label: mode === "arrival" ? "Chào đến" : "Chào về",
      occurredAt,
    };
    setRecent((current) => [entry, ...current].slice(0, 6));
  }

  async function replay(candidate: PresenceCandidate, mode: "arrival" | "departure") {
    const result = await queuePresentation(candidate, mode, true);
    if (!result) {
      setToast(`Không thể xếp hàng phát lại ${mode === "arrival" ? "Chào đến" : "Chào về"}. Presence không bị ảnh hưởng.`);
      return;
    }
    setToast(tvOnline
      ? `Đã xếp hàng phát lại ${mode === "arrival" ? "Chào đến" : "Chào về"} của ${candidate.name}.`
      : `TV đang tắt · đã xếp hàng phát lại ${mode === "arrival" ? "Chào đến" : "Chào về"} của ${candidate.name}; TV sẽ nhận khi online nếu sự kiện còn hiệu lực.`);
  }

  function triggerLearnerAction(item: AttentionItem) {
    const host = learnerActionHosts[item.learnerId];
    if (!host) {
      setToast("Thao tác này chưa sẵn sàng trong bản mẫu hiện tại.");
      return;
    }
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => {
      const text = candidate.textContent?.toLocaleLowerCase("vi-VN") ?? "";
      if (item.kind === "choice") return text.includes("resolve") || text.includes("xử lý") || text.includes("purchase") || text.includes("mua");
      return text.includes("ritual") || text.includes("nghi lễ");
    });
    if (!button) {
      setDismissedAttention((current) => ({ ...current, [item.key]: true }));
      setToast("Việc này đã được xử lý hoặc không còn cần hành động.");
      return;
    }
    button.click();
    setDismissedAttention((current) => ({ ...current, [item.key]: true }));
  }

  function ensurePresenceAccess() {
    if (presenceAllowed) return true;
    setToast(`Không thể thao tác hiện diện · ${accessReason}`);
    setAccessReviewOpen(true);
    return false;
  }

  function openCheckIn() {
    if (!ensurePresenceAccess()) return;
    const first = absentLearners[0];
    if (first) setSelectedId(first.id);
    setCheckInQuery("");
    setCheckInOpen(true);
  }

  function updateCheckInQuery(value: string) {
    setCheckInQuery(value);
    const query = value.trim().toLocaleLowerCase("vi-VN");
    const first = absentLearners.find((item) => !query || `${item.name} ${item.path} ${item.session}`.toLocaleLowerCase("vi-VN").includes(query));
    if (first) setSelectedId(first.id);
  }

  async function confirmCheckIn() {
    if (!selected || present[selected.id] || !ensurePresenceAccess()) return;
    setPresent((current) => ({ ...current, [selected.id]: true }));
    pushRecent(selected, "arrival");
    setCheckInOpen(false);
    const relayResult = await queuePresentation(selected, "arrival", false);
    if (!relayResult) {
      setToast(`${selected.name} đã Vào học · mock Core relay lỗi nên Chào đến chưa được xếp hàng.`);
      return;
    }
    setToast(tvOnline
      ? `${selected.name} đã Vào học · Chào đến đã vào hàng đợi của RECEPTION_TV.`
      : `${selected.name} đã Vào học · TV đang tắt nhưng Chào đến đã được xếp hàng độc lập.`);
  }

  async function confirmCheckOut() {
    if (!checkoutLearner || !ensurePresenceAccess()) return;
    const learner = checkoutLearner;
    setPresent((current) => ({ ...current, [learner.id]: false }));
    pushRecent(learner, "departure");
    setCheckOutTarget(null);
    const relayResult = await queuePresentation(learner, "departure", false);
    if (!relayResult) {
      setToast(`${learner.name} đã Tan học · mock Core relay lỗi nên Chào về chưa được xếp hàng.`);
      return;
    }
    setToast(tvOnline
      ? `${learner.name} đã Tan học · Chào về đã vào hàng đợi của RECEPTION_TV.`
      : `${learner.name} đã Tan học · TV đang tắt nhưng Chào về đã được xếp hàng độc lập.`);
  }

  function requestCheckout(id: string) {
    if (!ensurePresenceAccess()) return;
    setCheckOutTarget(id);
  }

  return (
    <div ref={rootRef}>
      {children}

      {opsHost ? createPortal(
        <section className={styles.opsPanel} aria-label="Điều hành Nhà PINO hôm nay">
          <div className={styles.opsTop}>
            <div className={styles.shiftSummary}>
              <span className={styles.opsEyebrow}>CA HIỆN TẠI</span>
              <strong>{presentLearners.length} học viên đang học</strong>
              <small>{nextCheckout ? `Tan học gần nhất: ${nextCheckout.name} · ${nextCheckout.checkout}` : "Chưa có học viên đang học"}</small>
            </div>

            <button className={`${styles.staffGuard} ${presenceAllowed ? styles.staffGuardGood : styles.staffGuardBlocked}`} onClick={() => setAccessReviewOpen(true)}>
              <i>{presenceAllowed ? "✓" : "!"}</i>
              <div><span>QUYỀN HIỆN DIỆN</span><strong>{staffAccess.name} · {presenceAllowed ? "Được phép" : "Bị chặn"}</strong><small>{staffAccess.checkedInAtPino ? "Đã check-in tại PINO" : "Chưa check-in"} · {PRESENCE_WINDOW_LABEL}</small></div>
            </button>

            <div className={`${styles.tvStatus} ${tvOnline ? styles.tvStatusOnline : ""}`}>
              <i />
              <div><span>RECEPTION_TV</span><strong>{tvOnline ? "Đang online" : "Đang offline"}</strong><small>{tvOnline ? `${tvModeLabels[tvMode]} · ${tvQueuedCount} đang chờ` : `${tvQueuedCount} sự kiện đang chờ Core relay`}</small></div>
            </div>

            <div className={styles.opsActions}>
              <button className={pinoriaStyles.primary} disabled={!presenceAllowed} onClick={openCheckIn}>+ Vào học</button>
              <button className={`${pinoriaStyles.secondary} ${styles.localTvButton}`} onClick={openTv}>Mở TV trên máy này</button>
              {tvOnline ? <button className={pinoriaStyles.ghost} onClick={() => { void returnToAmbient(); }}>Về thường nhật</button> : null}
            </div>
          </div>

          <div className={styles.independentNote}>
            <strong>TOS và TV là hai client độc lập.</strong>
            <span>Staff có thể thao tác từ điện thoại; sự kiện đi qua mock Core relay và RECEPTION_TV tự nhận bằng polling. Nút mở TV trên đây chỉ là tiện ích cho laptop lễ tân.</span>
          </div>

          <div className={styles.attentionHeader}>
            <div><span>CẦN XỬ LÝ</span><strong>{attentionItems.length ? `${attentionItems.length} việc trước giờ tan học` : "Không có việc gấp"}</strong></div>
            <small>Chỉ đưa lên đây các thao tác có ý nghĩa vận hành ngay lúc này.</small>
          </div>
          {attentionItems.length ? (
            <div className={styles.attentionGrid}>
              {attentionItems.map((item) => (
                <article className={styles.attentionCard} key={item.key}>
                  <div><span>{item.meta}</span><strong>{item.title}</strong></div>
                  <button onClick={() => triggerLearnerAction(item)}>{item.action}</button>
                </article>
              ))}
            </div>
          ) : <div className={styles.allClear}>✓ Nhà PINO đang thông suốt · không có thao tác Pinoria cần ưu tiên.</div>}
        </section>,
        opsHost,
      ) : null}

      {listHeaderHost ? createPortal(
        <div className={styles.presenceListHeader}>
          <div><span>ĐANG HỌC</span><h2>Học viên đang có mặt</h2></div>
          <small>{presentLearners.length} học viên · Vào/Tan học chỉ mở khi staff pass đủ điều kiện quyền + hiện diện + window</small>
        </div>,
        listHeaderHost,
      ) : null}

      {Object.entries(learnerActionHosts).map(([id, host]) => {
        const candidate = candidates.find((item) => item.id === id);
        if (!present[id] || !candidate) return null;
        return createPortal(
          <div className={styles.cardUtilityRow} key={`utility-${id}`}>
            <button className={styles.replayButton} onClick={() => { void replay(candidate, "arrival"); }}>↻ Chào đến</button>
            <button className={styles.checkoutButton} disabled={!presenceAllowed} onClick={() => requestCheckout(id)}>Tan học</button>
          </div>,
          host,
        );
      })}

      {gridHost && present.mai ? createPortal(
        <section className={`${pinoriaStyles.card} ${pinoriaStyles.learnerCard}`}>
          <div className={pinoriaStyles.avatar}>M</div>
          <div className={pinoriaStyles.learnerTitle}>
            <div><h3>Mai</h3><p>ArtChitect · Màu nước I</p></div>
            <span className={`${pinoriaStyles.badge} ${pinoriaStyles.badge_good}`}>Có mặt</span>
          </div>
          <div className={pinoriaStyles.detailRows}>
            <div className={pinoriaStyles.detail}><span>Phòng</span><strong>Phòng Họa</strong></div>
            <div className={pinoriaStyles.detail}><span>Hộ Linh</span><strong>Kiri · Vayu · Cấp 1</strong></div>
            <div className={pinoriaStyles.detail}><span>Tài nguyên</span><strong>260 PLS · 2 Trái Pinoria</strong></div>
            <div className={pinoriaStyles.detail}><span>Tan học</span><strong>19:30</strong></div>
          </div>
          <div className={pinoriaStyles.actionStack}>
            <span className={pinoriaStyles.clearState}>Vừa Vào học · Chào đến đã vào hàng chờ RECEPTION_TV</span>
            <div className={styles.cardUtilityRow}>
              <button className={styles.replayButton} onClick={() => { void replay(candidates[4], "arrival"); }}>↻ Chào đến</button>
              <button className={styles.checkoutButton} disabled={!presenceAllowed} onClick={() => requestCheckout("mai")}>Tan học</button>
            </div>
          </div>
        </section>,
        gridHost,
      ) : null}

      {artRoomHost && present.mai ? createPortal(<span>Mai</span>, artRoomHost) : null}

      {liveContentHost ? createPortal(
        <section className={`${pinoriaStyles.card} ${styles.recentCard}`}>
          <div className={pinoriaStyles.cardHead}>
            <div><span className={pinoriaStyles.kicker}>TRÌNH CHIẾU GẦN ĐÂY</span><h2>Chào đến & Chào về</h2></div>
            <span className={`${pinoriaStyles.badge} ${tvOnline ? pinoriaStyles.badge_good : pinoriaStyles.badge_neutral}`}>{tvOnline ? `TV online · ${tvQueuedCount} chờ` : `TV offline · ${tvQueuedCount} chờ`}</span>
          </div>
          <p className={pinoriaStyles.bodyCopy}>Phát lại tạo một presentation event mới từ cùng kết quả cũ. TV có thể đang ở một browser/thiết bị khác; không Vào học/Tan học lần nữa và không tạo kết quả mới.</p>
          <div className={styles.recentList}>
            {recent.slice(0, 4).map((item) => {
              const candidate = candidates.find((entry) => entry.id === item.learnerId);
              if (!candidate) return null;
              return <div className={styles.recentItem} key={item.id}>
                <div><span>{item.occurredAt} · {item.label}</span><strong>{candidate.name}</strong><small>{candidate.path}</small></div>
                <button onClick={() => { void replay(candidate, item.mode); }}>↻ Phát lại</button>
              </div>;
            })}
          </div>
        </section>,
        liveContentHost,
      ) : null}

      {toast ? <div className={styles.toast}>{toast}</div> : null}

      {checkInOpen ? (
        <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setCheckInOpen(false); }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-label="Vào học">
            <div className={styles.modalHead}>
              <div><span>VẬN HÀNH PINORIA</span><h2>Vào học</h2><p>Presence được ghi nhận bởi Core độc lập với TV. Staff chỉ được thao tác khi đã check-in tại PINO, trong window cho phép và có capability phù hợp.</p></div>
              <button onClick={() => setCheckInOpen(false)} aria-label="Đóng">×</button>
            </div>

            <div className={`${styles.accessStrip} ${presenceAllowed ? styles.accessStripGood : styles.accessStripBlocked}`}>
              <strong>{staffAccess.name} · {presenceAllowed ? "Đủ điều kiện" : "Không đủ điều kiện"}</strong>
              <span>{accessReason} · {SHIFT_LABEL} · {PRESENCE_WINDOW_LABEL}</span>
              <button onClick={() => setAccessReviewOpen(true)}>Xem quyền</button>
            </div>

            {absentLearners.length ? (
              <>
                <label className={styles.searchBox}>
                  <span>Tìm học viên</span>
                  <input autoFocus value={checkInQuery} onChange={(event) => updateCheckInQuery(event.target.value)} placeholder="Tên học viên hoặc chương trình..." />
                </label>
                <div className={styles.checkInLayout}>
                  <div className={styles.candidateList}>
                    <strong>Chưa có mặt</strong>
                    {visibleAbsentLearners.map((item) => (
                      <button key={item.id} className={selected.id === item.id ? styles.candidateActive : ""} onClick={() => setSelectedId(item.id)}>
                        <span className={styles.avatar}>{item.name.slice(0, 1)}</span>
                        <span><b>{item.name}</b><small>{item.path}</small></span>
                      </button>
                    ))}
                    {!visibleAbsentLearners.length ? <div className={styles.emptySearch}>Không tìm thấy học viên phù hợp.</div> : null}
                  </div>

                  <div className={styles.checkInDetail}>
                    <div className={styles.identityRow}><span className={styles.heroAvatar}>{selected.name.slice(0, 1)}</span><div><strong>{selected.name}</strong><small>{selected.path}</small></div></div>
                    <dl>
                      <div><dt>Buổi học</dt><dd>{selected.session}</dd></div>
                      <div><dt>Phòng</dt><dd>{selected.room}</dd></div>
                      <div><dt>Hộ Linh hiện tại</dt><dd>{selected.companion}</dd></div>
                      <div><dt>Giờ tan học dự kiến</dt><dd>{selected.checkout}</dd></div>
                    </dl>
                    <div className={`${styles.tvNotice} ${tvOnline ? styles.tvNoticeOnline : ""}`}>
                      <i />
                      <div><strong>{tvOnline ? "RECEPTION_TV đang online" : "RECEPTION_TV đang offline"}</strong><span>{tvOnline ? "Chào đến sẽ được TV tự nhận từ relay." : "Vào học vẫn hoàn tất; Chào đến được xếp hàng và TV tự nhận khi online nếu còn hiệu lực."}</span></div>
                    </div>
                    <div className={styles.chain}>
                      <span>Staff phone / TOS</span><b>→</b><span>Mock Core relay</span><b>→</b><span>RECEPTION_TV</span>
                    </div>
                  </div>
                </div>
              </>
            ) : <div className={styles.empty}>Tất cả học viên mẫu hiện đã có mặt.</div>}

            <div className={styles.actions}>
              <button className={pinoriaStyles.ghost} onClick={() => setCheckInOpen(false)}>Hủy</button>
              <button className={pinoriaStyles.primary} disabled={!presenceAllowed || !absentLearners.length || present[selected.id]} onClick={() => { void confirmCheckIn(); }}>Vào học</button>
            </div>
          </section>
        </div>
      ) : null}

      {checkoutLearner ? (
        <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setCheckOutTarget(null); }}>
          <section className={`${styles.modal} ${styles.checkoutModal}`} role="dialog" aria-modal="true" aria-label="Tan học">
            <div className={styles.modalHead}>
              <div><span>VẬN HÀNH PINORIA</span><h2>Tan học · {checkoutLearner.name}</h2><p>Tan học chốt Presence trước; Chào về là presentation event đi qua Core relay và không quyết định business truth.</p></div>
              <button onClick={() => setCheckOutTarget(null)} aria-label="Đóng">×</button>
            </div>
            <div className={`${styles.accessStrip} ${presenceAllowed ? styles.accessStripGood : styles.accessStripBlocked}`}>
              <strong>{staffAccess.name} · {presenceAllowed ? "Đủ điều kiện" : "Không đủ điều kiện"}</strong>
              <span>{accessReason} · {SHIFT_LABEL} · {PRESENCE_WINDOW_LABEL}</span>
              <button onClick={() => setAccessReviewOpen(true)}>Xem quyền</button>
            </div>
            <div className={styles.checkoutSummary}>
              <div><span>Học viên</span><strong>{checkoutLearner.name}</strong></div>
              <div><span>Phòng hiện tại</span><strong>{checkoutLearner.room}</strong></div>
              <div><span>Hộ Linh</span><strong>{checkoutLearner.companion}</strong></div>
            </div>
            {checkoutLearner.id === "bo" ? <div className={styles.warning}><strong>Trước khi Tan học</strong><span>• Lựa chọn B2 Túi Rêu vẫn đang chờ xử lý.</span><span>• Bùm đang sẵn sàng làm nghi lễ.</span><small>Đây là cảnh báo, không chặn Tan học nếu staff vẫn đủ quyền.</small></div> : null}
            <div className={`${styles.tvNotice} ${tvOnline ? styles.tvNoticeOnline : ""}`}>
              <i />
              <div><strong>{tvOnline ? "RECEPTION_TV đang online" : "RECEPTION_TV đang offline"}</strong><span>{tvOnline ? "Chào về sẽ được TV tự nhận từ relay." : "Tan học vẫn hoàn tất; Chào về được xếp hàng cho TV nhận sau."}</span></div>
            </div>
            <div className={styles.chain}>
              <span>Tan học</span><b>→</b><span>Presence closed</span><b>→</b><span>Chào về queued</span>
            </div>
            <div className={styles.actions}>
              <button className={pinoriaStyles.ghost} onClick={() => setCheckOutTarget(null)}>Hủy</button>
              <button className={pinoriaStyles.primary} disabled={!presenceAllowed} onClick={() => { void confirmCheckOut(); }}>Tan học</button>
            </div>
          </section>
        </div>
      ) : null}

      {accessReviewOpen ? (
        <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setAccessReviewOpen(false); }}>
          <section className={`${styles.modal} ${styles.accessModal}`} role="dialog" aria-modal="true" aria-label="Quyền thao tác hiện diện">
            <div className={styles.modalHead}>
              <div><span>STAFFING GUARD · PROTOTYPE</span><h2>Ai được Vào học / Tan học?</h2><p>Production phải kiểm tra server-side trước mọi command. Các toggle dưới đây chỉ để Founder review denial states; client không được tự khai quyền hay vị trí.</p></div>
              <button onClick={() => setAccessReviewOpen(false)} aria-label="Đóng">×</button>
            </div>

            <div className={styles.guardSummary}>
              <div><span>Staff</span><strong>{staffAccess.name} · {staffAccess.role}</strong></div>
              <div><span>Ca</span><strong>{SHIFT_LABEL}</strong></div>
              <div><span>Window mẫu</span><strong>{PRESENCE_WINDOW_LABEL}</strong></div>
              <div><span>Kết quả</span><strong className={presenceAllowed ? styles.goodText : styles.blockedText}>{presenceAllowed ? "ALLOW" : "DENY"}</strong></div>
            </div>

            <div className={styles.guardChecks}>
              <label><input type="checkbox" checked={staffAccess.checkedInAtPino} onChange={(event) => setStaffAccess((current) => ({ ...current, checkedInAtPino: event.target.checked }))} /><span><strong>Đã check-in nhân sự tại PINO</strong><small>Canonical StaffPresenceSession phải ACTIVE tại cùng location. Không tin GPS/client flag tự khai.</small></span></label>
              <label><input type="checkbox" checked={staffAccess.withinPresenceWindow} onChange={(event) => setStaffAccess((current) => ({ ...current, withinPresenceWindow: event.target.checked }))} /><span><strong>Đang trong window được phép</strong><small>Bản mẫu dùng ca ±15 phút: 13:45–21:15. Window thật thuộc Staffing policy.</small></span></label>
              <label><input type="checkbox" checked={staffAccess.canManagePresence} onChange={(event) => setStaffAccess((current) => ({ ...current, canManagePresence: event.target.checked }))} /><span><strong>Có capability presence.manage</strong><small>Role/capability được Core resolve; không dựa vào việc UI có hiện nút hay không.</small></span></label>
            </div>

            <div className={styles.guardDoctrine}>
              <strong>Rule chốt cho implementation</strong>
              <span>Vào học/Tan học chỉ ALLOW khi cả 3 điều kiện cùng đúng. Command vẫn phải audit actor, location, thời điểm và lý do override nếu sau này có quyền quản lý đặc biệt.</span>
            </div>

            <div className={styles.actions}>
              <button className={pinoriaStyles.secondary} onClick={() => setStaffAccess(initialStaffAccess)}>Khôi phục trạng thái hợp lệ</button>
              <button className={pinoriaStyles.primary} onClick={() => setAccessReviewOpen(false)}>Xong</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
