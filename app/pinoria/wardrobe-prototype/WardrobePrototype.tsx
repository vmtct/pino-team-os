"use client";
/* eslint-disable @next/next/no-img-element -- prototype uses current Pinoria transparent assets */
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TosShell } from "@/app/components/tos-shell/TosShell";
import styles from "./wardrobe-prototype.module.css";

type Candidate = { id: string; name: string; slot: string; asset: string };
type SessionChoice = { learnerId: string; learnerName: string; visitId: string; candidateIds: string[]; selected: number | null };

const STORAGE = "pino.prototype.pnr-ward.session-choice.v1";
const ASSET = "https://pino-asset-publisher.minhtri-van42.workers.dev/assets/pinoria/assets";
const catalog: Candidate[] = [
  { id: "hair-long", name: "Tóc Dài Nâu Gợn Sóng", slot: "Tóc", asset: `${ASSET}/hair-long-brown-wavy-headband/v001/standalone.png` },
  { id: "face-smile", name: "Gương mặt Mỉm Cười", slot: "Mặt · kính", asset: `${ASSET}/face-01/v001/standalone.png` },
  { id: "birthday-hat", name: "Nón Sinh Nhật", slot: "Nón", asset: `${ASSET}/birthday-hat/v001/layer.png` },
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
    } catch {}
  }, [learnerId, learnerName, visitId]);

  function choose(number: number) {
    if (session.selected !== null) return;
    const next = { ...session, selected: number };
    setSession(next);
    const saved = JSON.parse(localStorage.getItem(STORAGE) || "{}") as Record<string, SessionChoice>;
    localStorage.setItem(STORAGE, JSON.stringify({ ...saved, [visitId]: next }));
  }
  const selected = session.selected === null ? null : getCandidate(session.candidateIds[session.selected - 1]);
  return <TosShell title="Phiếu Wardrobe" subtitle="Phiên check-in hiện tại · staff xác nhận" theme="pinoria" footerItems={footer} activeFooterId="presence" backHref="/pinoria">
    <div className={styles.page}>
      <section className={styles.sessionHeader}>
        <div className={styles.avatar}>{session.learnerName.charAt(0)}</div>
        <div><span className={styles.eyebrow}>CHECK-IN SESSION</span><h2>{session.learnerName}</h2><p>{session.visitId}</p></div>
        <span className={styles.tvBadge}>TV đồng bộ</span>
      </section>
      <section className={styles.instruction}>
        <span className={styles.eyebrow}>CORE-RESOLVED CANDIDATES</span>
        <h3>Phiếu chọn 1 món</h3>
        <p>Ba món dưới đây là cùng bộ #1 · #2 · #3 đang hiển thị trên Pinoria TV. Staff chọn theo phiếu/yêu cầu của học viên.</p>
      </section>
      <section className={styles.choiceList}>
        {session.candidateIds.map((id, index) => {
          const item = getCandidate(id), number = index + 1, chosen = session.selected === number;
          return <article key={id} className={`${styles.choiceCard} ${chosen ? styles.chosen : ""}`}>
            <span className={styles.number}>{number}</span><span className={styles.itemImage}><img src={item.asset} alt="" /></span>
            <div className={styles.itemCopy}><strong>{item.name}</strong><small>{item.slot}</small></div>
            <button disabled={session.selected !== null} onClick={() => choose(number)}>{chosen ? "Đã chọn" : `Chọn số ${number}`}</button>
          </article>;
        })}
      </section>
      {selected ? <section className={styles.lockedState}>
        <span>✓ Lượt đổi đã dùng</span>
        <strong>Đã áp dụng món số {session.selected}: {selected.name}</strong>
        <p>Phiên check-in này không thể đổi thêm món khác. Reload hoặc đổi thiết bị staff vẫn giữ trạng thái khóa theo visitId.</p>
      </section> : <section className={styles.pendingState}>
        <strong>Chưa xác nhận lựa chọn</strong>
        <span>Mỗi phiên check-in chỉ được áp dụng đúng 1 món.</span>
      </section>}
      <section className={styles.prototypeNote}>
        Prototype dùng local fixture để mô phỏng state Core. Candidate set không được resolve lại khi reload; production sẽ lấy canonical session state từ Core.
      </section>
    </div>
  </TosShell>;
}
