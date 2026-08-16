"use client";

import { FormEvent, MouseEvent, useEffect, useRef, useState } from "react";
import PinerPrototypeV15 from "./PinerPrototypeV15";
import v16 from "./piner-prototype-v16.module.css";

type SurfaceKey = "home" | "journey" | "collection" | "explore";

const surfaceLabels: Record<SurfaceKey, { vi: string; en: string }> = {
  home: { vi: "Trang chủ", en: "Home" },
  journey: { vi: "Hành trình", en: "Journey" },
  collection: { vi: "Thành quả", en: "Collection" },
  explore: { vi: "Khám phá", en: "Explore" },
};

const exactText: Record<string, string> = {
  "STUDENT / MEMBERSHIP STATE": "HỌC VIÊN / TRẠNG THÁI THÀNH VIÊN",
  "HOME CONDITION": "TRẠNG THÁI TRANG CHỦ",
  "JUMP TO SCREEN": "CHUYỂN MÀN HÌNH",
  "Normal": "Bình thường",
  "Fresh": "Mới",
  "Home": "Trang chủ",
  "Journey": "Hành trình",
  "Collection": "Thành quả",
  "Explore": "Khám phá",
  "Current package": "Gói hiện tại",
  "Trial period": "Giai đoạn dùng thử",
  "Access period ended": "Gói đã hết hạn",
  "Current project": "Dự án đang thực hiện",
  "Current repertoire": "Bài đang học",
  "Foundation · package timeline": "Nền tảng · tiến trình gói",
  "Foundation": "Nền tảng",
  "Specialization roadmap": "Lộ trình chuyên đề",
  "Practice support": "Luyện tập tại nhà",
  "Founder-managed": "Nội dung do PINO quản lý",
  "Starter collection": "Bộ bài khởi đầu",
  "Songs": "Bài hát",
  "Upcoming": "Sắp diễn ra",
  "All": "Tất cả",
  "Artwork": "Tác phẩm",
  "Music": "Âm nhạc",
  "Milestone": "Cột mốc",
  "Moment": "Khoảnh khắc",
  "Trial Premium": "Dùng thử Premium",
  "Free": "Miễn phí",
  "Expired": "Đã hết hạn",
  "Re-enrolled": "Đã tiếp tục Premium",
  "Fixed slot": "Khung giờ cố định",
  "Flexible studio window": "Khung giờ linh hoạt",
  "Package schedule": "Lịch của gói",
  "OPEN STUDIO · Explore": "OPEN STUDIO · Khám phá",
  "PREMIUM SESSION · member access": "BUỔI PREMIUM · dành cho thành viên",
  "PREMIUM SESSION": "BUỔI PREMIUM",
  "BOOKING · PENDING": "ĐĂNG KÝ · ĐANG CHỜ XÁC NHẬN",
  "BOOKING · CONFIRMED": "ĐĂNG KÝ · ĐÃ XÁC NHẬN",
  "BOOKING · CANCELLED": "ĐĂNG KÝ · ĐÃ HỦY",
  "BOOKING · REJECTED": "ĐĂNG KÝ · KHÔNG ĐƯỢC XÁC NHẬN",
  "CANCEL BOOKING": "HỦY ĐĂNG KÝ",
  "PENDING": "Đang chờ xác nhận",
  "CONFIRMED": "Đã xác nhận",
  "CANCELLED": "Đã hủy",
  "REJECTED": "Không được xác nhận",
  "Prototype Staff": "Mô phỏng PINO",
  "Staff confirm": "PINO xác nhận",
  "Staff cancel": "PINO hủy",
  "Reject": "Không xác nhận",
  "Page": "Trang",
  "Sheet": "Bản nhạc",
  "Worksheet": "Phiếu hướng dẫn",
  "Audio": "Bản nghe mẫu",
  "Recording": "Bản ghi âm",
  "STARTER": "KHỞI ĐẦU",
  "JOURNEY": "HÀNH TRÌNH",
  "SPECIALTY": "CHUYÊN ĐỀ",
  "Fundamental": "Cơ bản",
  "Expansion": "Mở rộng",
  "Open": "Đã mở",
  "Locked": "Chưa mở",
  "Owned": "Đã sở hữu",
  "Retained": "Được giữ lại",
  "LOCAL PROTOTYPE · V15": "BẢN THỬ NỘI BỘ · V16",
  "V15 · HOLISTIC AUDIT": "V16 · RÀ SOÁT TỔNG THỂ",
  "Founder review matrix": "Ma trận rà soát Founder",
  "Audit invariants": "Nguyên tắc cần giữ nhất quán",
};

const phraseReplacements: Array<[RegExp, string]> = [
  [/Journey glance/g, "Tổng quan hành trình"],
  [/Fresh \/ meaningful/g, "Mới / đáng chú ý"],
  [/Return to PINO/g, "Quay lại PINO"],
  [/Progression locked/g, "Tiến trình đang tạm dừng"],
  [/Trial Premium · real Journey/g, "Dùng thử Premium · hành trình thật"],
  [/Trial Journey/g, "Hành trình dùng thử"],
  [/real Journey/g, "hành trình thật"],
  [/Current package/g, "Gói hiện tại"],
  [/Current project/g, "Dự án đang thực hiện"],
  [/Current repertoire/g, "Bài đang học"],
  [/Current package timeline/g, "Tiến trình gói hiện tại"],
  [/Specialization roadmap/g, "Lộ trình chuyên đề"],
  [/Specialization/g, "Chuyên đề"],
  [/Foundation/g, "Nền tảng"],
  [/Practice support/g, "Luyện tập tại nhà"],
  [/Practice Resource/g, "Tài liệu luyện tập"],
  [/Practice Sheet/g, "Tài liệu luyện tập"],
  [/Starter Sheet/g, "Bản nhạc khởi đầu"],
  [/Journey Sheet/g, "Bản nhạc hành trình"],
  [/Specialty Sheet/g, "Bản nhạc chuyên đề"],
  [/Hand-position worksheet/g, "Phiếu hướng dẫn thế tay"],
  [/hand-position worksheet/g, "phiếu hướng dẫn thế tay"],
  [/hand map/g, "hướng dẫn thế tay"],
  [/Hand map/g, "Hướng dẫn thế tay"],
  [/reference audio/g, "bản nghe mẫu"],
  [/Reference audio/g, "Bản nghe mẫu"],
  [/Founder-managed/g, "Nội dung do PINO quản lý"],
  [/Founder content source/g, "Nguồn nội dung PINO"],
  [/Starter collection/g, "Bộ bài khởi đầu"],
  [/Future unlock/g, "Sẽ mở sau"],
  [/Future visibility/g, "Hiển thị trước nội dung sắp tới"],
  [/Future progression/g, "Tiến trình sắp tới"],
  [/Future L5 outcome/g, "Thành quả L5 sắp tới"],
  [/Upcoming/g, "Sắp diễn ra"],
  [/Free Collection/g, "Thành quả Miễn phí"],
  [/Premium preview/g, "Xem trước Premium"],
  [/Trial recording/g, "Bản ghi âm trong thời gian dùng thử"],
  [/Trial milestone/g, "Cột mốc trong thời gian dùng thử"],
  [/Trial Premium/g, "Dùng thử Premium"],
  [/Trial/g, "Dùng thử"],
  [/Re-enrolled/g, "Đã tiếp tục Premium"],
  [/Expired/g, "Đã hết hạn"],
  [/Free vs Premium/g, "Miễn phí và Premium"],
  [/Free/g, "Miễn phí"],
  [/Artwork/g, "Tác phẩm"],
  [/Music/g, "Âm nhạc"],
  [/Milestone/g, "Cột mốc"],
  [/Moment/g, "Khoảnh khắc"],
  [/Collection/g, "Thành quả"],
  [/Journey/g, "Hành trình"],
  [/Explore/g, "Khám phá"],
  [/Home/g, "Trang chủ"],
  [/OPEN STUDIO/g, "OPEN STUDIO"],
  [/PREMIUM SESSION/g, "BUỔI PREMIUM"],
  [/member access/g, "dành cho thành viên"],
  [/Booking/g, "Đăng ký"],
  [/booking/g, "đăng ký"],
  [/Pending/g, "Đang chờ xác nhận"],
  [/Confirmed/g, "Đã xác nhận"],
  [/Cancelled/g, "Đã hủy"],
  [/Rejected/g, "Không được xác nhận"],
  [/Staff/g, "PINO"],
  [/Current/g, "Hiện tại"],
  [/Completed/g, "Đã hoàn thành"],
  [/Available/g, "Có thể mở"],
  [/Locked/g, "Chưa mở"],
  [/Owned/g, "Đã sở hữu"],
  [/Retained/g, "Được giữ lại"],
  [/Fundamental/g, "Cơ bản"],
  [/Expansion/g, "Mở rộng"],
];

function translateText(value: string) {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const core = value.trim();
  if (!core) return value;
  let translated = exactText[core] ?? core;
  for (const [pattern, replacement] of phraseReplacements) translated = translated.replace(pattern, replacement);
  return `${leading}${translated}${trailing}`;
}

function surfaceFromText(text: string): SurfaceKey | null {
  const normalized = text.trim();
  for (const [key, labels] of Object.entries(surfaceLabels) as Array<[SurfaceKey, { vi: string; en: string }]>) {
    if (normalized === labels.vi || normalized === labels.en || normalized.startsWith(labels.vi) || normalized.startsWith(labels.en)) return key;
  }
  return null;
}

function packageDefaultExpanded(scenarioKey: string) {
  return scenarioKey.includes("trial") || scenarioKey.includes("expired");
}

export default function PinerPrototypeV16() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeSurface, setActiveSurface] = useState<SurfaceKey>("home");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;

    const enhance = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        localizeVisibleText(root);
        enhanceNavigation(root, activeSurface);
        enhancePackageContext(root);
      });
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [activeSurface]);

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    const button = (event.target as HTMLElement).closest("button") as HTMLButtonElement | null;
    if (!button) return;
    const surface = surfaceFromText(button.textContent ?? "");
    if (surface && (button.closest("nav") || button.closest("aside"))) setActiveSurface(surface);
  }

  function handleChangeCapture(event: FormEvent<HTMLDivElement>) {
    const target = event.target as HTMLSelectElement;
    if (target.id === "scenario") setActiveSurface("home");
  }

  return (
    <div ref={rootRef} className={v16.localizedRoot} onClickCapture={handleClickCapture} onChangeCapture={handleChangeCapture}>
      <PinerPrototypeV15 />
    </div>
  );
}

function localizeVisibleText(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest("script, style")) continue;
    const next = translateText(node.nodeValue ?? "");
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  const labTitle = Array.from(root.querySelectorAll<HTMLElement>("h1"))
    .find((heading) => heading.textContent?.trim() === "Piner Member Space");
  const intro = labTitle?.nextElementSibling as HTMLElement | null;
  if (intro?.tagName === "P") {
    intro.textContent = "Bản rà soát tổng thể · kiểm tra hành trình, quyền truy cập, đăng ký và trạng thái học viên trên toàn bộ Piner.";
  }
}

function enhanceNavigation(root: HTMLElement, activeSurface: SurfaceKey) {
  const navs = Array.from(root.querySelectorAll<HTMLElement>("nav"));
  const bottomNav = navs.find((nav) => {
    const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>(":scope > button"));
    if (buttons.length !== 4) return false;
    return buttons.filter((button) => surfaceFromText(button.textContent ?? "")).length === 4;
  });
  if (!bottomNav) return;

  bottomNav.dataset.v16PrimaryNav = "true";
  Array.from(bottomNav.querySelectorAll<HTMLButtonElement>(":scope > button")).forEach((button) => {
    const surface = surfaceFromText(button.textContent ?? "");
    if (!surface) return;
    const small = button.querySelector("small");
    if (small) small.textContent = surfaceLabels[surface].vi;
    button.dataset.v16NavButton = "true";
    button.dataset.v16Active = surface === activeSurface ? "true" : "false";
  });
}

function enhancePackageContext(root: HTMLElement) {
  const scenarioKey = root.querySelector<HTMLSelectElement>("#scenario")?.value ?? "";
  const sections = Array.from(root.querySelectorAll<HTMLElement>("section"));
  const cards = sections.filter((section) => {
    const text = section.textContent ?? "";
    return text.includes("Bắt đầu") && text.includes("Hết gói") && !section.querySelector("section");
  });

  cards.forEach((card) => {
    const previousScenario = card.dataset.v16PackageScenario;
    const scenarioChanged = previousScenario !== scenarioKey;
    card.dataset.v16PackageScenario = scenarioKey;
    card.classList.add(v16.packageEnhanced);

    let toggle = card.querySelector<HTMLButtonElement>("[data-v16-package-toggle='true']");
    if (!toggle) {
      const originalChildren = Array.from(card.children);
      originalChildren.forEach((child) => {
        if (child instanceof HTMLElement) child.dataset.v16PackageDetail = "true";
      });

      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.dataset.v16PackageToggle = "true";
      toggle.className = v16.packageToggle;
      toggle.addEventListener("click", () => {
        const expanded = card.dataset.v16Expanded === "true";
        setPackageExpanded(card, !expanded);
        card.dataset.v16UserToggled = "true";
      });
      card.insertBefore(toggle, card.firstChild);
    }

    if (!card.dataset.v16Expanded || (scenarioChanged && card.dataset.v16UserToggled !== "true")) {
      setPackageExpanded(card, packageDefaultExpanded(scenarioKey));
    }
    if (scenarioChanged) delete card.dataset.v16UserToggled;

    const raw = Array.from(card.querySelectorAll<HTMLElement>("[data-v16-package-detail='true']"))
      .map((node) => node.textContent ?? "")
      .join(" ");
    const isTrial = scenarioKey.includes("trial");
    const isExpired = scenarioKey.includes("expired");
    const title = isTrial ? "Giai đoạn dùng thử" : isExpired ? "Gói đã hết hạn" : "Gói hiện tại";
    const end = raw.match(/Hết gói\s*([0-9/]+)/)?.[1];
    const days = raw.match(/(T\d(?:\s*·\s*T\d)*)/)?.[1];
    const time = raw.match(/(\d{2}:\d{2}[–-]\d{2}:\d{2})/)?.[1];
    const meta = [days, time, end ? `đến ${end}` : null].filter(Boolean).join(" · ");

    toggle.replaceChildren();
    const copy = document.createElement("span");
    copy.className = v16.packageToggleCopy;
    const strong = document.createElement("strong");
    strong.textContent = title;
    const small = document.createElement("small");
    small.textContent = meta || "Xem lịch học và thời hạn";
    copy.append(strong, small);
    const chevron = document.createElement("span");
    chevron.className = v16.packageChevron;
    chevron.textContent = card.dataset.v16Expanded === "true" ? "⌃" : "⌄";
    toggle.append(copy, chevron);
    toggle.setAttribute("aria-expanded", card.dataset.v16Expanded === "true" ? "true" : "false");
  });
}

function setPackageExpanded(card: HTMLElement, expanded: boolean) {
  card.dataset.v16Expanded = expanded ? "true" : "false";
  const toggle = card.querySelector<HTMLButtonElement>("[data-v16-package-toggle='true']");
  toggle?.setAttribute("aria-expanded", expanded ? "true" : "false");
  const chevron = toggle?.querySelector<HTMLElement>(`.${v16.packageChevron}`);
  if (chevron) chevron.textContent = expanded ? "⌃" : "⌄";
}
