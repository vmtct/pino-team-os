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

export function PresencePrototypeLayer({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [present, setPresent] = useState<Record<string, boolean>>(initialPresence);
  const [actionHost, setActionHost] = useState<HTMLElement | null>(null);
  const [gridHost, setGridHost] = useState<HTMLElement | null>(null);
  const [liveContentHost, setLiveContentHost] = useState<HTMLElement | null>(null);
  const [artRoomHost, setArtRoomHost] = useState<HTMLElement | null>(null);
  const [learnerActionHosts, setLearnerActionHosts] = useState<Record<string, HTMLElement>>({});
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkOutTarget, setCheckOutTarget] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("mai");
  const [toast, setToast] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentPresentation[]>(initialRecent);

  const absentLearners = useMemo(() => candidates.filter((item) => !present[item.id]), [present]);
  const selected = candidates.find((item) => item.id === selectedId) ?? absentLearners[0] ?? candidates[0];
  const checkoutLearner = candidates.find((item) => item.id === checkOutTarget) ?? null;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const syncHosts = () => {
      const sectionHeads = Array.from(root.querySelectorAll<HTMLElement>(`.${pinoriaStyles.sectionHead}`));
      const liveHead = sectionHeads.find((head) => {
        const title = head.querySelector("h1")?.textContent?.trim() ?? "";
        return title === "Live House" || title === "Nhà PINO hôm nay";
      });
      setActionHost(liveHead?.querySelector<HTMLElement>(`.${pinoriaStyles.sectionActions}`) ?? null);
      const learnerGrid = root.querySelector<HTMLElement>(`.${pinoriaStyles.learnerGrid}`);
      setGridHost(learnerGrid);
      setLiveContentHost(learnerGrid?.parentElement ?? null);

      const hosts: Record<string, HTMLElement> = {};
      root.querySelectorAll<HTMLElement>(`.${pinoriaStyles.learnerCard}`).forEach((card) => {
        const name = card.querySelector("h3")?.textContent?.trim();
        if (!name) return;
        const candidate = candidates.find((item) => item.name === name);
        const host = card.querySelector<HTMLElement>(`.${pinoriaStyles.actionStack}`);
        if (candidate && host) hosts[candidate.id] = host;
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

    root.querySelectorAll<HTMLElement>(`.${pinoriaStyles.attentionItem}`).forEach((item) => {
      const text = item.textContent ?? "";
      const candidate = candidates.find((entry) => text.startsWith(entry.name));
      if (candidate) item.style.display = present[candidate.id] ? "" : "none";
    });

    root.querySelectorAll<HTMLElement>(`.${pinoriaStyles.metricCard}`).forEach((card) => {
      const label = card.querySelector(":scope > span")?.textContent?.trim();
      if (label === "Present now" || label === "Đang có mặt") {
        const value = card.querySelector("strong");
        if (value) value.textContent = String(candidates.filter((item) => present[item.id]).length);
      }
    });
  }, [present, actionHost, gridHost]);

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
      const channel = new BroadcastChannel(TV_CHANNEL);
      channel.postMessage(message);
      channel.close();
    } catch {
      // Prototype keeps TOS state valid even if the TV window is closed or unsupported.
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
    broadcastPresentation(candidate, mode, true);
    setToast(`Đang phát lại ${mode === "arrival" ? "Chào đến" : "Chào về"} của ${candidate.name} · chỉ phát lại trình chiếu, không thay đổi trạng thái.`);
  }

  function openCheckIn() {
    const first = absentLearners[0];
    if (first) setSelectedId(first.id);
    setCheckInOpen(true);
  }

  function confirmCheckIn() {
    if (!selected) return;
    setPresent((current) => ({ ...current, [selected.id]: true }));
    pushRecent(selected, "arrival");
    broadcastPresentation(selected, "arrival", false);
    setCheckInOpen(false);
    setToast(`${selected.name} đã Vào học · TV đang phát Chào đến. Chọn nhanh sẽ xuất hiện sau màn chào.`);
  }

  function confirmCheckOut() {
    if (!checkoutLearner) return;
    setPresent((current) => ({ ...current, [checkoutLearner.id]: false }));
    pushRecent(checkoutLearner, "departure");
    broadcastPresentation(checkoutLearner, "departure", false);
    setCheckOutTarget(null);
    setToast(`${checkoutLearner.name} đã Tan học · TV đang phát Chào về.`);
  }

  return (
    <div ref={rootRef}>
      {children}

      {actionHost ? createPortal(
        <button className={pinoriaStyles.primary} onClick={openCheckIn}>+ Vào học</button>,
        actionHost,
      ) : null}

      {Object.entries(learnerActionHosts).map(([id, host]) => {
        const candidate = candidates.find((item) => item.id === id);
        if (!present[id] || !candidate) return null;
        return createPortal(
          <>
            <button key={`replay-arrival-${id}`} className={pinoriaStyles.ghost} onClick={() => replay(candidate, "arrival")}>Phát lại Chào đến</button>
            <button key={`checkout-${id}`} className={pinoriaStyles.ghost} onClick={() => setCheckOutTarget(id)}>Tan học</button>
          </>,
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
            <span className={pinoriaStyles.clearState}>Vừa Vào học · Chào đến đã được gửi sang TV</span>
            <button className={pinoriaStyles.ghost} onClick={() => replay(candidates[4], "arrival")}>Phát lại Chào đến</button>
            <button className={pinoriaStyles.ghost} onClick={() => setCheckOutTarget("mai")}>Tan học</button>
          </div>
        </section>,
        gridHost,
      ) : null}

      {artRoomHost && present.mai ? createPortal(<span>Mai</span>, artRoomHost) : null}

      {liveContentHost ? createPortal(
        <section className={pinoriaStyles.card} style={{ marginTop: 14 }}>
          <div className={pinoriaStyles.cardHead}>
            <div><span className={pinoriaStyles.kicker}>TRÌNH CHIẾU GẦN ĐÂY</span><h2>Phát lại Chào đến / Chào về</h2></div>
            <span className={`${pinoriaStyles.badge} ${pinoriaStyles.badge_neutral}`}>Presentation only</span>
          </div>
          <p className={pinoriaStyles.bodyCopy}>Phát lại dùng đúng kết quả đã có. Không Vào học/Tan học lần nữa, không tạo lựa chọn mới và không phát sinh phần thưởng.</p>
          <div className={pinoriaStyles.attentionList}>
            {recent.map((item) => {
              const candidate = candidates.find((entry) => entry.id === item.learnerId);
              if (!candidate) return null;
              return <div className={pinoriaStyles.attentionItem} key={item.id}>
                <div><span>{item.occurredAt} · {item.label}</span><strong>{candidate.name} · {candidate.path}</strong></div>
                <button onClick={() => replay(candidate, item.mode)}>Phát lại</button>
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
              <div><span>VẬN HÀNH PINORIA</span><h2>Vào học</h2><p>Ghi nhận học viên có mặt trước khi Pinoria tạo màn Chào đến.</p></div>
              <button onClick={() => setCheckInOpen(false)} aria-label="Đóng">×</button>
            </div>

            {absentLearners.length ? (
              <div className={styles.checkInLayout}>
                <div className={styles.candidateList}>
                  <strong>Học viên chưa có mặt</strong>
                  {absentLearners.map((item) => (
                    <button key={item.id} className={selected.id === item.id ? styles.candidateActive : ""} onClick={() => setSelectedId(item.id)}>
                      <span className={styles.avatar}>{item.name.slice(0, 1)}</span>
                      <span><b>{item.name}</b><small>{item.path}</small></span>
                    </button>
                  ))}
                </div>

                <div className={styles.checkInDetail}>
                  <div className={styles.identityRow}><span className={styles.heroAvatar}>{selected.name.slice(0, 1)}</span><div><strong>{selected.name}</strong><small>{selected.path}</small></div></div>
                  <dl>
                    <div><dt>Buổi học</dt><dd>{selected.session}</dd></div>
                    <div><dt>Phòng</dt><dd>{selected.room}</dd></div>
                    <div><dt>Hộ Linh hiện tại</dt><dd>{selected.companion}</dd></div>
                    <div><dt>Giờ tan học dự kiến</dt><dd>{selected.checkout}</dd></div>
                  </dl>
                  <div className={styles.chain}>
                    <span>Vào học</span><b>→</b><span>Nhà PINO hôm nay</span><b>→</b><span>Chào đến</span><b>→</b><span>Chọn nhanh</span>
                  </div>
                </div>
              </div>
            ) : <div className={styles.empty}>Tất cả học viên mẫu hiện đã có mặt.</div>}

            <div className={styles.actions}>
              <button className={pinoriaStyles.ghost} onClick={() => setCheckInOpen(false)}>Hủy</button>
              <button className={pinoriaStyles.primary} disabled={!absentLearners.length} onClick={confirmCheckIn}>Vào học</button>
            </div>
          </section>
        </div>
      ) : null}

      {checkoutLearner ? (
        <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setCheckOutTarget(null); }}>
          <section className={`${styles.modal} ${styles.checkoutModal}`} role="dialog" aria-modal="true" aria-label="Tan học">
            <div className={styles.modalHead}>
              <div><span>VẬN HÀNH PINORIA</span><h2>Tan học · {checkoutLearner.name}</h2><p>Tan học đóng phiên hiện diện ngay; TV chỉ trình chiếu màn Chào về sau đó.</p></div>
              <button onClick={() => setCheckOutTarget(null)} aria-label="Đóng">×</button>
            </div>
            <div className={styles.checkoutSummary}>
              <div><span>Học viên</span><strong>{checkoutLearner.name}</strong></div>
              <div><span>Phòng hiện tại</span><strong>{checkoutLearner.room}</strong></div>
              <div><span>Hộ Linh</span><strong>{checkoutLearner.companion}</strong></div>
            </div>
            {checkoutLearner.id === "bo" ? <div className={styles.warning}><strong>Trước khi Tan học</strong><span>• Lựa chọn B2 Túi Rêu vẫn đang chờ xử lý.</span><span>• Bùm đang sẵn sàng làm nghi lễ.</span><small>Đây là cảnh báo, không chặn Tan học.</small></div> : null}
            <div className={styles.chain}>
              <span>Tan học</span><b>→</b><span>Chốt trạng thái hiện diện</span><b>→</b><span>Chào về</span>
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
