"use client";

import { useEffect, useRef } from "react";
import PinerPrototypeV17 from "./PinerPrototypeV17";
import v18 from "./piner-prototype-v18.module.css";

const ENDED_ACCESS = new Set(["leo-expired", "leo-attrition"]);

export default function PinerPrototypeV18() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;
    const observer = new MutationObserver(() => schedule());

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        observer.disconnect();
        syncPracticeFamilies(root);
        observer.observe(root, { childList: true, subtree: true, characterData: true });
      });
    };

    schedule();
    observer.observe(root, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef} className={v18.root}>
      <PinerPrototypeV17 />
    </div>
  );
}

function syncPracticeFamilies(root: HTMLElement) {
  const badge = Array.from(root.querySelectorAll<HTMLElement>("aside div, aside span")).find((node) => {
    const text = node.textContent?.trim() ?? "";
    return text.startsWith("LOCAL PROTOTYPE") || text.startsWith("BẢN THỬ NỘI BỘ");
  });
  if (badge) badge.textContent = "BẢN THỬ NỘI BỘ · V18";

  const scenarioKey = root.querySelector<HTMLSelectElement>("#scenario")?.value ?? "";
  const ended = ENDED_ACCESS.has(scenarioKey);

  // Find the actual PianoHouse practice resource row from a stable resource card,
  // instead of matching translated section copy. V16 localization can rewrite
  // labels such as Music / Specialty, so section-text matching was brittle.
  const allButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("button"));
  const currentJourney = allButtons.find((button) => {
    const text = button.textContent ?? "";
    return text.includes("Always With Me")
      && text.includes("Founder · published")
      && !text.includes("Expansion")
      && !text.includes("Mở rộng");
  });
  if (!currentJourney?.parentElement) return;

  const list = currentJourney.parentElement;
  const pianoSection = currentJourney.closest("section") as HTMLElement | null;
  if (!pianoSection) return;

  pianoSection.dataset.v18PracticeSection = "true";
  pianoSection.dataset.v18EndedAccess = ended ? "true" : "false";

  // Prefer a structurally rendered Starter card when one exists. Until the base
  // prototype is refactored to typed resources, V18 creates the prototype card
  // from the same resource-card visual grammar so Founder can review all 3 families.
  let starter = Array.from(list.querySelectorAll<HTMLButtonElement>(":scope > button")).find((button) => {
    const text = button.textContent ?? "";
    return button.dataset.v18Starter === "true"
      || text.includes("KHỞI HÀNH")
      || text.includes("Giai điệu quen thuộc")
      || (text.includes("ABC Song") && text.includes("Founder · published"));
  }) ?? null;

  if (!starter) {
    starter = currentJourney.cloneNode(true) as HTMLButtonElement;
    list.insertBefore(starter, currentJourney);
  }

  starter.dataset.v18Starter = "true";
  starter.dataset.v18Family = "starter";
  starter.dataset.v18Access = "open";
  starter.disabled = false;
  starter.removeAttribute("disabled");
  starter.removeAttribute("aria-disabled");

  const starterChildren = Array.from(starter.children) as HTMLElement[];
  if (starterChildren[0]) starterChildren[0].textContent = "KHỞI HÀNH";
  if (starterChildren[1]) {
    const strong = starterChildren[1].querySelector("strong");
    const small = starterChildren[1].querySelector("small");
    const em = starterChildren[1].querySelector("em");
    if (strong) strong.textContent = "Giai điệu quen thuộc · ABC Song";
    if (small) small.textContent = "Bản luyện tay phải · làm quen giai điệu";
    if (em) em.textContent = "Khởi Hành · luôn mở";
  }
  if (starterChildren[2]) {
    const assets = Array.from(starterChildren[2].querySelectorAll("small"));
    if (assets[0]) assets[0].textContent = "♩ Bản nhạc";
    if (assets[1]) assets[1].textContent = "☝ Hướng dẫn tay";
    if (assets[2]) assets[2].textContent = "▶ Nghe mẫu";
  }
  if (starterChildren[3]) starterChildren[3].textContent = "Founder · published";
  if (starterChildren[4]) starterChildren[4].textContent = "→";

  Array.from(list.querySelectorAll<HTMLButtonElement>(":scope > button")).forEach((button) => {
    const text = button.textContent ?? "";
    if (button.dataset.v18Starter === "true") return;

    const isJourney = text.includes("HÀNH TRÌNH") || text.includes("JOURNEY") || text.includes("Always With Me");
    const isSpecialty = text.includes("CHUYÊN ĐỀ") || text.includes("SPECIALTY") || text.includes("Film Music Specialty") || text.includes("Film Âm nhạc Specialty") || (text.includes("Film") && text.includes("Chuyên Đề"));
    if (!isJourney && !isSpecialty) return;

    button.dataset.v18Family = isSpecialty ? "specialty" : "journey";
    const naturallyLocked = text.includes("Expansion") || text.includes("Mở rộng") || text.includes("Sẽ mở sau") || text.includes("locked");
    const access = ended || naturallyLocked ? "locked" : "open";
    button.dataset.v18Access = access;
    const arrow = button.lastElementChild as HTMLElement | null;
    if (arrow) arrow.textContent = access === "locked" ? "🔒" : "→";
  });

  let note = pianoSection.querySelector<HTMLElement>("[data-v18-family-note='true']");
  if (!note) {
    note = document.createElement("div");
    note.dataset.v18FamilyNote = "true";
    note.className = v18.familyNote;
    const intro = Array.from(pianoSection.children).find((child) => child.tagName === "P");
    if (intro?.nextSibling) pianoSection.insertBefore(note, intro.nextSibling);
    else pianoSection.appendChild(note);
  }

  note.innerHTML = ended
    ? "<strong>Khởi Hành vẫn mở</strong><span>Hành Trình và Chuyên Đề được giữ để nhận biết lịch sử đã có, nhưng nội dung luyện tập đang khóa. Trong Khởi Hành, tay phải vẫn mở và hướng dẫn tay trái vẫn thuộc Premium.</span>"
    : "<strong>3 loại tài liệu luyện tập</strong><span>Khởi Hành · Hành Trình · Chuyên Đề dùng chung một trình luyện tập; quyền mở phụ thuộc trạng thái thành viên và tiến trình.</span>";

  const intro = Array.from(pianoSection.children).find((child) => child.tagName === "P") as HTMLParagraphElement | undefined;
  if (intro) intro.textContent = "Khởi Hành, Hành Trình và Chuyên Đề dùng chung một trình luyện tập; khác nhau ở mục đích và quyền truy cập.";
}
