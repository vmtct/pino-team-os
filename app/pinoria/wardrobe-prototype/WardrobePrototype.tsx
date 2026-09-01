"use client";
/* eslint-disable @next/next/no-img-element -- prototype uses current Pinoria transparent assets */
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TosShell } from "@/app/components/tos-shell/TosShell";
import styles from "./wardrobe-prototype.module.css";

type Candidate = { id: string; name: string; slot: string; asset: string; replaces: string };
type SessionChoice = { learnerId: string; learnerName: string; visitId: string; candidateIds: string[]; selected: number | null };

const STORAGE = "pino.prototype.pnr-ward.session-choice.v1";
const ASSET = "https://pino-asset-publisher.minhtri-van42.workers.dev/assets/pinoria/assets";
const catalog: Candidate[] = [
  { id: "hair-basic", name: "Tóc Cơ Bản", slot: "Tóc", replaces: "Tóc Dài Nâu Gợn Sóng", asset: `${ASSET}/hair-01/v001/standalone.png` },
  { id: "face-smile", name: "Gương mặt Mỉm Cười", slot: "Mặt · kính", replaces: "Kính Sao + Mỉm Cười", asset: `${ASSET}/face-01/v001/standalone.png` },
  { id: "face-playful", name: "Gương mặt Tinh Nghịch", slot: "Mặt · kính", replaces: "Kính Sao + Mỉm Cười", asset: `${ASSET}/face-02/v001/standalone.png` },
];

const footer = [
  { id: "home", label: "Home", href: "/dashboard" },
  { id: "presence", label: "Hiện diện", href: "/pinoria" },
  { id: "attendance", label: "Điểm danh", href: "/pinoria/attendance" },
];
function getCandidate(id: string) { return catalog.find((item) => item.id === id)!; }
export function WardrobePrototype() {
  const params = useSearchParams();
  const learnerId = params.get("learnerId") || "lrn_bo";
  const learnerName = params.get("learnerName") || "Bơ";
  const visitId = params.get("visitId") || "visit_bo_001";
  const [session, setSession] = useState<SessionChoice>({ learnerId, learnerName, visitId, candidateIds: catalog.map((item) => item.id), selected: null });
  const [pendingNumber, setPendingNumber] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || "{}") as Record<string, SessionChoice>;
      const existing = saved[visitId];
      if (existing) setSession(existing);
      else {
        const next = { learnerId, learnerName, visitId, candidateIds: catalog.map((item) => item.id), selected: null };
        localStorage.setItem(STORAGE, JSON.stringify({ ...saved, [visitId]: next }));
        setSession(next);
      }
      setPendingNumber(null);
    } catch {}
  }, [learnerId, learnerName, visitId]);

  function confirmChoice() {
    if (session.selected !== null || pendingNumber === null) return;
    const next = { ...session, selected: pendingNumber };
    setSession(next);
    const saved = JSON.parse(localStorage.getItem(STORAGE) || "{}") as Record<string, SessionChoice>;
    localStorage.setItem(STORAGE, JSON.stringify({ ...saved, [visitId]: next }));
    setPendingNumber(null);
  }

  const selected = session.selected === null ? null : getCandidate(session.candidateIds[session.selected - 1]);
  const pending = pendingNumber === null ? null : getCandidate(session.candidateIds[pendingNumber - 1]);
  return <TosShell title="Phiếu Wardrobe" subtitle="Phiên check-in hiện tại · staff xác nhận" theme="pinoria" footerItems={footer} activeFooterId="presence" backHref="/pinoria">
    <div className={styles.page}>
      <section className={styles.sessionHeader}>
        <div className={styles.avatar}>{session.learnerName.charAt(0)}</div>
        <div><span className={styles.eyebrow}>CHECK-IN SESSION</span><h2>{session.learnerName}</h2><p>{session.visitId}</p></div>
        <span className={styles.tvBadge}>TV · 3/3</span>
      </section>
      <section className={styles.instruction}>
        <span className={styles.eyebrow}>CORE-RESOLVED · FIXED FOR VISIT</span>
        <h3>Phiếu chọn 1 món</h3>
        <p>Ba số dưới đây phải trùng #1 · #2 · #3 trên Pinoria TV. Chọn đúng số học viên yêu cầu, kiểm tra món sẽ bị thay rồi mới xác nhận.</p>
      </section>
      <section className={styles.choiceList}>
        {session.candidateIds.map((id, index) => {
          const item = getCandidate(id), number = index + 1, chosen = session.selected === number, pendingChoice = pendingNumber === number;
          return <article key={id} className={`${styles.choiceCard} ${chosen ? styles.chosen : ""} ${pendingChoice ? styles.pendingChoice : ""}`}>
            <span className={styles.number}>{number}</span><span className={styles.itemImage}><img src={item.asset} alt="" /></span>
            <div className={styles.itemCopy}><strong>{item.name}</strong><small>{item.slot} · thay {item.replaces}</small></div>
            <button disabled={session.selected !== null} onClick={() => setPendingNumber(number)}>{chosen ? "Đã áp dụng" : pendingChoice ? `Đang chọn số ${number}` : `Chọn số ${number}`}</button>
          </article>;
        })}
      </section>      {pending && session.selected === null ? <section className={styles.confirmState}>
        <div><span className={styles.eyebrow}>XÁC NHẬN TRƯỚC KHI APPLY</span><strong>Số {pendingNumber} · {pending.name}</strong><p>Slot {pending.slot} sẽ thay “{pending.replaces}”. Sau xác nhận, phiên này hết lượt đổi.</p></div>
        <div className={styles.confirmActions}><button className={styles.cancelButton} onClick={() => setPendingNumber(null)}>Chọn lại</button><button className={styles.confirmButton} onClick={confirmChoice}>Xác nhận số {pendingNumber}</button></div>
      </section> : null}
      {selected ? <section className={styles.lockedState}>
        <span>✓ Lượt đổi đã dùng</span>
        <strong>Đã áp dụng món số {session.selected}: {selected.name}</strong>
        <p>Phiên check-in này không thể đổi thêm món khác. Reload hoặc đổi thiết bị staff vẫn giữ trạng thái khóa theo visitId.</p>
      </section> : !pending ? <section className={styles.pendingState}>
        <strong>Chưa xác nhận lựa chọn</strong>
        <span>Mỗi phiên check-in chỉ được áp dụng đúng 1 món.</span>
      </section> : null}
      <section className={styles.prototypeNote}>
        Prototype mô phỏng canonical session state bằng localStorage. Production: Core tạo candidate set một lần theo visitId; TOS và Pinoria TV cùng đọc set đó, và Core là authority khóa lượt apply.
      </section>
    </div>
  </TosShell>;
}
