"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PinerPrototypeV14 from "./PinerPrototypeV14";
import v15 from "./piner-prototype-v15.module.css";

type Surface = "Trang chủ" | "Hành trình" | "Thành quả" | "Khám phá";

type ReviewCase = {
  key: string;
  label: string;
  state: string;
  focus: string;
};

const reviewCases: ReviewCase[] = [
  { key: "an-free", label: "An", state: "Khám Phá", focus: "Khám Phá → Open Studio → Booking(PENDING); Premium vẫn nhìn thấy nhưng khóa" },
  { key: "an-free-confirmed", label: "An", state: "Khám Phá · đã xác nhận", focus: "weekly claim + active booking blocker + lịch sử đăng ký vẫn giữ" },
  { key: "han-trial-ac", label: "Hân", state: "Dùng thử · ArtChitect", focus: "Hành trình thật + Premium mở full + cảnh báo tuổi có acknowledge" },
  { key: "leo-trial", label: "Leo", state: "Dùng thử · PianoHouse", focus: "Khởi Hành/Hành Trình/Chuyên Đề đều dùng được + nhiều booking trong tuần" },
  { key: "leo-expired", label: "Leo", state: "Trial đã hết hạn", focus: "Khởi Hành còn mở nhưng tay trái khóa; Hành Trình/Chuyên Đề khóa; lịch sử giữ" },
  { key: "leo-attrition", label: "Leo", state: "Attrition · Premium", focus: "paid Premium đã dừng; provenance khác Trial; Khám Phá vẫn có thể dùng" },
  { key: "leo-reenrolled", label: "Leo", state: "Đã tiếp tục Premium", focus: "resume đúng learner history; không reset level; Premium session vẫn khóa theo policy hiện tại" },
  { key: "minh-premium", label: "Minh", state: "Premium · PianoHouse + ArtChitect", focus: "multi-Path continuity + Khám Phá bookable + Premium session visible/locked" },
  { key: "mia-lpa", label: "Mía", state: "Premium · Little Piner Art", focus: "syllabus avatar + scheduled topic + checkpoint + Next Touchpoint" },
  { key: "bo-lpp", label: "Bơ", state: "Premium · Little Piner Piano", focus: "self-paced Journey + Khởi Hành + Thành quả" },
];

const surfaces: Surface[] = ["Trang chủ", "Hành trình", "Thành quả", "Khám phá"];
const legacySurfaceLabels: Record<Surface, string> = {
  "Trang chủ": "Home",
  "Hành trình": "Journey",
  "Thành quả": "Collection",
  "Khám phá": "Explore",
};

export default function PinerPrototypeV15() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [mountTarget, setMountTarget] = useState<HTMLElement | null>(null);
  const [activeCase, setActiveCase] = useState("an-free");
  const [activeSurface, setActiveSurface] = useState<Surface>("Trang chủ");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;

    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const asides = Array.from(root.querySelectorAll<HTMLElement>("aside"));
        const lab = asides.find((aside) => aside.querySelector("h1")?.textContent?.trim() === "Piner Member Space");
        if (!lab) return;

        const badge = Array.from(lab.querySelectorAll<HTMLElement>("div, span")).find((node) => node.textContent?.trim().startsWith("LOCAL PROTOTYPE") || node.textContent?.trim().startsWith("BẢN THỬ NỘI BỘ"));
        if (badge) badge.textContent = "FREEZE CANDIDATE · FINAL AUDIT";

        const intro = lab.querySelector("h1")?.nextElementSibling as HTMLElement | null;
        if (intro?.tagName === "P") {
          intro.textContent = "Rà soát cuối trước khi freeze UI reference · kiểm tra state, access, navigation, copy và cross-flow trên toàn bộ Piner.";
        }

        const legacyFocus = Array.from(lab.querySelectorAll<HTMLElement>("strong")).find((node) => node.textContent?.trim() === "V4 review focus");
        const legacyBlock = legacyFocus?.parentElement as HTMLElement | null;
        if (legacyBlock) legacyBlock.style.display = "none";

        let mount = lab.querySelector<HTMLElement>("[data-v15-audit-mount='true']");
        if (!mount) {
          mount = document.createElement("div");
          mount.dataset.v15AuditMount = "true";
          lab.appendChild(mount);
        }
        setMountTarget((current) => current === mount ? current : mount);

        const select = root.querySelector<HTMLSelectElement>("#scenario");
        if (select?.value) setActiveCase(select.value);
      });
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  function switchScenario(key: string) {
    const select = rootRef.current?.querySelector<HTMLSelectElement>("#scenario");
    if (!select) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (setter) setter.call(select, key);
    else select.value = key;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    setActiveCase(key);
    setActiveSurface("Trang chủ");
  }

  function jump(surface: Surface) {
    const root = rootRef.current;
    if (!root) return;
    const labels = [surface, legacySurfaceLabels[surface]];
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("button"));
    const jumpButton = buttons.find((button) => labels.includes(button.textContent?.trim() ?? "") && button.closest("aside"));
    const navButton = buttons.find((button) => labels.includes(button.textContent?.trim() ?? "") && button.closest("nav"));
    (jumpButton ?? navButton)?.click();
    setActiveSurface(surface);
  }

  return (
    <div ref={rootRef}>
      <PinerPrototypeV14 />
      {mountTarget && createPortal(
        <ReviewConsole
          activeCase={activeCase}
          activeSurface={activeSurface}
          onScenario={switchScenario}
          onSurface={jump}
        />,
        mountTarget,
      )}
    </div>
  );
}

function ReviewConsole({ activeCase, activeSurface, onScenario, onSurface }: {
  activeCase: string;
  activeSurface: Surface;
  onScenario: (key: string) => void;
  onSurface: (surface: Surface) => void;
}) {
  const current = reviewCases.find((item) => item.key === activeCase);

  return (
    <section className={v15.console}>
      <div className={v15.consoleHead}>
        <div><span>FINAL · HOLISTIC AUDIT</span><strong>Ma trận freeze Piner</strong></div>
        <em>{current?.state ?? "Trạng thái tùy chỉnh"}</em>
      </div>

      <p className={v15.focus}>{current?.focus ?? "Rà soát trạng thái học viên hiện tại trên tất cả màn hình."}</p>

      <div className={v15.surfaceRow}>
        {surfaces.map((surface) => (
          <button key={surface} type="button" className={activeSurface === surface ? v15.surfaceActive : ""} onClick={() => onSurface(surface)}>{surface}</button>
        ))}
      </div>

      <div className={v15.caseList}>
        {reviewCases.map((item) => (
          <button key={item.key} type="button" className={activeCase === item.key ? v15.caseActive : ""} onClick={() => onScenario(item.key)}>
            <span>{item.label}</span>
            <strong>{item.state}</strong>
            <small>{item.focus}</small>
          </button>
        ))}
      </div>

      <div className={v15.invariants}>
        <strong>Freeze invariants</strong>
        <span>Không trộn dữ liệu giữa các bé trong cùng household; đổi bé là hard context switch.</span>
        <span>Access có thể hết; Journey history, Achievement và Thành quả đã sở hữu không bị mất.</span>
        <span>Trial Expired và Attrition có cùng broad expired access nhưng provenance/copy khác nhau.</span>
        <span>Khởi Hành luôn là practice family có thể tồn tại ngoài Premium; tay trái vẫn Premium-gated khi access không active.</span>
        <span>Hành Trình/Chuyên Đề không fabricate cho learner chưa từng có Premium context; khi expired/attrition thì history card có thể giữ nhưng practice bị khóa.</span>
        <span>Booking(PENDING) ≠ CONFIRMED ≠ Attendance; cancel/reject không xóa history.</span>
        <span>Trial có thể đăng ký Khám Phá + Premium; paid Premium/re-enrolled/expired/attrition chỉ đăng ký Khám Phá, Premium vẫn visible nhưng locked.</span>
        <span>Age mismatch: Trial có warning + acknowledge cho Student hiện tại; paid/expired/attrition có thể tạo Registration riêng cho bé khác.</span>
        <span>Gửi bài luyện tập ≠ tự tăng level ≠ tự đưa vào Thành quả.</span>
      </div>

      <div className={v15.freezeGate}>
        <strong>Freeze gate</strong>
        <span><b>PASS</b> · visual hierarchy, typography floor, navigation, package context, Practice families, Explore presentation.</span>
        <span><b>VERIFY LOCAL</b> · toàn bộ 10 learner cases × 4 tabs + modal/booking/practice interactions.</span>
        <span><b>PRODUCTION GAP</b> · Core-backed read models/access decisions, auth, media/evidence upload, real Registration/Booking writes, typed React architecture.</span>
        <span><b>NO NEW FEATURE</b> · sau khi walkthrough sạch, freeze prototype và chuyển sang production reconstruction.</span>
      </div>
    </section>
  );
}
