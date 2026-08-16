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
  { key: "an-free", label: "An", state: "Miễn phí", focus: "Khám phá → đăng ký Open Studio + giới hạn Premium" },
  { key: "an-free-confirmed", label: "An", state: "Miễn phí · đã xác nhận", focus: "giới hạn theo tuần + giữ lịch sử đăng ký" },
  { key: "han-trial-ac", label: "Hân", state: "Dùng thử · ArtChitect", focus: "hành trình thật + nội dung đã sở hữu trong thời gian dùng thử" },
  { key: "leo-trial", label: "Leo", state: "Dùng thử · PianoHouse", focus: "nhiều đăng ký + luyện tập Premium đang mở" },
  { key: "leo-expired", label: "Leo", state: "Trial đã hết hạn", focus: "Trial không chuyển Premium + giữ lịch sử + CTA tiếp tục" },
  { key: "leo-attrition", label: "Leo", state: "Attrition · Premium", focus: "đã dùng Premium nhưng ngưng tiếp tục + giữ learner history" },
  { key: "leo-reenrolled", label: "Leo", state: "Đã tiếp tục Premium", focus: "tiếp tục L4 + quota chung 1 đăng ký" },
  { key: "minh-premium", label: "Minh", state: "Premium · PianoHouse + ArtChitect", focus: "liên tục nhiều chương trình" },
  { key: "mia-lpa", label: "Mía", state: "Premium · Little Piner Art", focus: "chủ đề theo lịch + checkpoint" },
  { key: "bo-lpp", label: "Bơ", state: "Premium · Little Piner Piano", focus: "luyện tập khởi đầu + Thành quả" },
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
        if (badge) badge.textContent = "BẢN THỬ NỘI BỘ · V15";

        const intro = lab.querySelector("h1")?.nextElementSibling as HTMLElement | null;
        if (intro?.tagName === "P") {
          intro.textContent = "Bản rà soát tổng thể · kiểm tra hành trình, quyền truy cập, đăng ký và trạng thái học viên trên toàn bộ Piner.";
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
        <div><span>V15 · RÀ SOÁT TỔNG THỂ</span><strong>Ma trận rà soát Founder</strong></div>
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
        <strong>Nguyên tắc cần giữ nhất quán</strong>
        <span>Không trộn dữ liệu giữa các bé trong cùng gia đình.</span>
        <span>Quyền truy cập có thể hết; thành quả và lịch sử đã sở hữu không mất.</span>
        <span>Trial hết hạn và Attrition là hai nguyên nhân dừng Premium khác nhau; không gộp copy/lifecycle provenance.</span>
        <span>Đăng ký chờ xác nhận ≠ đã xác nhận ≠ đã tham dự.</span>
        <span>Gửi bài luyện tập ≠ tự tăng cấp ≠ tự đưa vào Thành quả.</span>
        <span>Dùng thử được nhiều đăng ký; Premium active dùng quota 1 chung cho Open Studio + Buổi Premium.</span>
      </div>
    </section>
  );
}
