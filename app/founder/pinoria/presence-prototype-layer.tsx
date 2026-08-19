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

type TVStatusMessage =
  | { type: "PINORIA_TV_READY"; mode: TVMode; sentAt: number }
  | { type: "PINORIA_TV_HEARTBEAT"; sentAt: number }
  | { type: "PINORIA_TV_STATE"; mode: TVMode; sentAt: number }
  | { type: "PINORIA_TV_CLOSED"; sentAt: number };

type AttentionItem = {
  key: string;
  learnerId: string;
  kind: "choice" | "ritual";
  meta: string;
  title: string;
  action: string;
};

const TV_CHANNEL = "pinoria-tv-prototype-v1";

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
  const tvChannelRef = useRef<BroadcastChannel | null>(null);
  const tvLastSeenRef = useRef(0);
  const [present, setPresent] = useState<Record<string, boolean>>(initialPresence);
  const [opsHost, setOpsHost] = useState<HTMLElement | null>(null);
  const [gridHost, setGridHost] = useState<HTMLElement | null>(null);
  const [listHeaderHost, setListHeaderHost] = useState<HTMLElement | null>(null);
  const [liveContentHost, setLiveContentHost] = useState<HTMLElement | null>(null);
  const [artRoomHost, setArtRoomHost] = useState<HTMLElement | null>(null);
  const [learnerActionHosts, setLearnerActionHosts] = useState<Record<string, HTMLElement>>({});
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkOutTarget, setCheckOutTarget] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("mai");
  const [checkInQuery, setCheckInQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentPresentation[]>(initialRecent);
  const [dismissedAttention, setDismissedAttention] = useState<Record<string, boolean>>({});
  const [tvOnline, setTvOnline] = useState(false);
  const [tvMode, setTvMode] = useState<TVMode>("ambient");

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

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(TV_CHANNEL);
      tvChannelRef.current = channel;
      channel.onmessage = (event: MessageEvent<TVStatusMessage>) => {
        const message = event.data;
        if (!message || typeof message !== "object" || !("type" in message)) return;
        if (message.type === "PINORIA_TV_READY" || message.type === "PINORIA_TV_HEARTBEAT" || message.type === "PINORIA_TV_STATE") {
          tvLastSeenRef.current = Date.now();
          setTvOnline(true);
        }
        if (message.type === "PINORIA_TV_READY" || message.type === "PINORIA_TV_STATE") setTvMode(message.mode);
        if (message.type === "PINORIA_TV_CLOSED") {
          tvLastSeenRef.current = 0;
          setTvOnline(false);
        }
      };
    } catch {
      tvChannelRef.current = null;
    }

    const heartbeatGuard = window.setInterval(() => {
      if (tvLastSeenRef.current && Date.now() - tvLastSeenRef.current > 6000) setTvOnline(false);
    }, 2000);

    return () => {
      window.clearInterval(heartbeatGuard);
      channel?.close();
      tvChannelRef.current = null;
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

  function openTv() {
    const tv = window.open("/pinoria-tv", "pinoria-tv", "popup=yes,width=1440,height=900");
    tv?.focus();
    setToast(tvOnline ? "Đã đưa cửa sổ TV Pinoria lên trước." : "Đang mở TV Pinoria. Khi TV kết nối, trạng thái sẽ chuyển sang Đang mở.");
  }

  function returnToAmbient() {
    try {
      tvChannelRef.current?.postMessage({ type: "PINORIA_TV_CONTROL", action: "ambient", sentAt: Date.now() });
      setToast("Đã yêu cầu TV trở về Không gian thường nhật.");
    } catch {
      setToast("Không thể gửi điều khiển TV trong trình duyệt hiện tại.");
    }
  }

  function broadcastPresentation(candidate: PresenceCandidate, mode: "arrival" | "departure", replay: boolean) {
    const message = {
      type: "PINORIA_TV_PLAY",
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
      sentAt: Date.now(),
    };
    try {
      tvChannelRef.current?.postMessage(message);
    } catch {
      // Presence remains valid even when presentation is unavailable.
    }
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

  function replay(candidate: PresenceCandidate, mode: "arrival" | "departure") {
    if (!tvOnline) {
      setToast(`TV Pinoria đang tắt. Mở TV rồi phát lại ${mode === "arrival" ? "Chào đến" : "Chào về"} của ${candidate.name}.`);
      return;
    }
    broadcastPresentation(candidate, mode, true);
    setToast(`Đang phát lại ${mode === "arrival" ? "Chào đến" : "Chào về"} của ${candidate.name} · chỉ trình chiếu, không thay đổi trạng thái.`);
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

  function openCheckIn() {
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

  function confirmCheckIn() {
    if (!selected || present[selected.id]) return;
    setPresent((current) => ({ ...current, [selected.id]: true }));
    pushRecent(selected, "arrival");
    if (tvOnline) broadcastPresentation(selected, "arrival", false);
    setCheckInOpen(false);
    setToast(tvOnline
      ? `${selected.name} đã Vào học · TV đang phát Chào đến. Chọn nhanh sẽ xuất hiện sau màn chào.`
      : `${selected.name} đã Vào học · TV đang tắt. Có thể phát lại Chào đến sau khi mở TV.`);
  }

  function confirmCheckOut() {
    if (!checkoutLearner) return;
    setPresent((current) => ({ ...current, [checkoutLearner.id]: false }));
    pushRecent(checkoutLearner, "departure");
    if (tvOnline) broadcastPresentation(checkoutLearner, "departure", false);
    setCheckOutTarget(null);
    setToast(tvOnline
      ? `${checkoutLearner.name} đã Tan học · TV đang phát Chào về.`
      : `${checkoutLearner.name} đã Tan học · TV đang tắt. Có thể phát lại Chào về sau khi mở TV.`);
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
            <div className={`${styles.tvStatus} ${tvOnline ? styles.tvStatusOnline : ""}`}>
              <i />
              <div><span>TV PINORIA</span><strong>{tvOnline ? "Đang mở" : "Đang tắt"}</strong><small>{tvOnline ? tvModeLabels[tvMode] : "Mở từ TOS khi bắt đầu vận hành"}</small></div>
            </div>
            <div className={styles.opsActions}>
              <button className={pinoriaStyles.primary} onClick={openCheckIn}>+ Vào học</button>
              <button className={pinoriaStyles.secondary} onClick={openTv}>{tvOnline ? "Đưa TV lên trước" : "Mở TV Pinoria"}</button>
              {tvOnline ? <button className={pinoriaStyles.ghost} onClick={returnToAmbient}>Về thường nhật</button> : null}
            </div>
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
          <small>{presentLearners.length} học viên · thao tác quan trọng nằm ngay trên từng thẻ</small>
        </div>,
        listHeaderHost,
      ) : null}

      {Object.entries(learnerActionHosts).map(([id, host]) => {
        const candidate = candidates.find((item) => item.id === id);
        if (!present[id] || !candidate) return null;
        return createPortal(
          <div className={styles.cardUtilityRow} key={`utility-${id}`}>
            <button className={styles.replayButton} onClick={() => replay(candidate, "arrival")}>↻ Chào đến</button>
            <button className={styles.checkoutButton} onClick={() => setCheckOutTarget(id)}>Tan học</button>
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
            <span className={pinoriaStyles.clearState}>Vừa Vào học · {tvOnline ? "Chào đến đã gửi sang TV" : "TV đang tắt"}</span>
            <div className={styles.cardUtilityRow}>
              <button className={styles.replayButton} onClick={() => replay(candidates[4], "arrival")}>↻ Chào đến</button>
              <button className={styles.checkoutButton} onClick={() => setCheckOutTarget("mai")}>Tan học</button>
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
            <span className={`${pinoriaStyles.badge} ${tvOnline ? pinoriaStyles.badge_good : pinoriaStyles.badge_neutral}`}>{tvOnline ? "TV đang mở" : "TV đang tắt"}</span>
          </div>
          <p className={pinoriaStyles.bodyCopy}>Phát lại chỉ chạy lại màn đã có; không Vào học/Tan học lần nữa và không tạo kết quả mới.</p>
          <div className={styles.recentList}>
            {recent.slice(0, 4).map((item) => {
              const candidate = candidates.find((entry) => entry.id === item.learnerId);
              if (!candidate) return null;
              return <div className={styles.recentItem} key={item.id}>
                <div><span>{item.occurredAt} · {item.label}</span><strong>{candidate.name}</strong><small>{candidate.path}</small></div>
                <button onClick={() => replay(candidate, item.mode)}>↻ Phát lại</button>
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
              <div><span>VẬN HÀNH PINORIA</span><h2>Vào học</h2><p>Ghi nhận hiện diện trước; trình chiếu TV là bước tiếp theo và không bao giờ chặn Vào học.</p></div>
              <button onClick={() => setCheckInOpen(false)} aria-label="Đóng">×</button>
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
                      <div><strong>{tvOnline ? "TV đang mở" : "TV đang tắt"}</strong><span>{tvOnline ? "Chào đến sẽ phát tự động sau khi Vào học." : "Vào học vẫn được ghi nhận. Có thể phát lại Chào đến sau khi mở TV."}</span></div>
                    </div>
                    <div className={styles.chain}>
                      <span>Vào học</span><b>→</b><span>Nhà PINO hôm nay</span><b>→</b><span>Chào đến</span><b>→</b><span>Chọn nhanh</span>
                    </div>
                  </div>
                </div>
              </>
            ) : <div className={styles.empty}>Tất cả học viên mẫu hiện đã có mặt.</div>}

            <div className={styles.actions}>
              <button className={pinoriaStyles.ghost} onClick={() => setCheckInOpen(false)}>Hủy</button>
              <button className={pinoriaStyles.primary} disabled={!absentLearners.length || present[selected.id]} onClick={confirmCheckIn}>Vào học</button>
            </div>
          </section>
        </div>
      ) : null}

      {checkoutLearner ? (
        <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setCheckOutTarget(null); }}>
          <section className={`${styles.modal} ${styles.checkoutModal}`} role="dialog" aria-modal="true" aria-label="Tan học">
            <div className={styles.modalHead}>
              <div><span>VẬN HÀNH PINORIA</span><h2>Tan học · {checkoutLearner.name}</h2><p>Tan học chốt phiên hiện diện ngay; Chào về là trình chiếu đi sau và không chặn thao tác.</p></div>
              <button onClick={() => setCheckOutTarget(null)} aria-label="Đóng">×</button>
            </div>
            <div className={styles.checkoutSummary}>
              <div><span>Học viên</span><strong>{checkoutLearner.name}</strong></div>
              <div><span>Phòng hiện tại</span><strong>{checkoutLearner.room}</strong></div>
              <div><span>Hộ Linh</span><strong>{checkoutLearner.companion}</strong></div>
            </div>
            {checkoutLearner.id === "bo" ? <div className={styles.warning}><strong>Trước khi Tan học</strong><span>• Lựa chọn B2 Túi Rêu vẫn đang chờ xử lý.</span><span>• Bùm đang sẵn sàng làm nghi lễ.</span><small>Đây là cảnh báo, không chặn Tan học.</small></div> : null}
            <div className={`${styles.tvNotice} ${tvOnline ? styles.tvNoticeOnline : ""}`}>
              <i />
              <div><strong>{tvOnline ? "TV đang mở" : "TV đang tắt"}</strong><span>{tvOnline ? "Chào về sẽ phát sau khi Tan học." : "Tan học vẫn hoàn tất. Có thể phát lại Chào về sau khi mở TV."}</span></div>
            </div>
            <div className={styles.chain}>
              <span>Tan học</span><b>→</b><span>Chốt hiện diện</span><b>→</b><span>Chào về</span>
            </div>
            <div className={styles.actions}>
              <button className={pinoriaStyles.ghost} onClick={() => setCheckOutTarget(null)}>Hủy</button>
              <button className={pinoriaStyles.primary} onClick={confirmCheckOut}>Tan học</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
