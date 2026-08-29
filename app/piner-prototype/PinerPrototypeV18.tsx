"use client";

import { useRef } from "react";
import PinerPrototypeV17 from "./PinerPrototypeV17";
import v18 from "./piner-prototype-v18.module.css";
import { usePrototypePolish } from "./usePrototypePolish";

const ENDED_ACCESS = new Set(["leo-expired", "leo-attrition"]);

export default function PinerPrototypeV18() {
  const rootRef = useRef<HTMLDivElement>(null);

  usePrototypePolish(rootRef, syncPracticeFamilies, { listenToChange: true });

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

  // Find the actual PianoHouse current Journey resource card. The subtitle is
  // intentionally used because it remains stable through V16 localization.
  const allButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("button"));
  const currentJourney = allButtons.find((button) => {
    const text = button.textContent ?? "";
    return text.includes("Always With Me")
      && text.includes("Verse 1 + Chorus")
      && !text.includes("Expansion")
      && !text.includes("Mở rộng");
  });
  if (!currentJourney?.parentElement) return;

  const list = currentJourney.parentElement;
  currentJourney.dataset.productCurrentPracticeCard = "true";
  const pianoSection = currentJourney.closest("section") as HTMLElement | null;
  if (!pianoSection) return;

  pianoSection.dataset.v18PracticeSection = "true";
  pianoSection.dataset.v18EndedAccess = ended ? "true" : "false";

  // Remove the duplicated learner-facing title: eyebrow describes the content
  // type, while the h3 remains the single section title.
  const heading = pianoSection.querySelector<HTMLElement>(":scope > div");
  if (heading) {
    const eyebrow = heading.querySelector<HTMLElement>("span");
    const title = heading.querySelector<HTMLElement>("h3");
    if (eyebrow && /Luyện tập tại nhà|Practice support/i.test(eyebrow.textContent ?? "")) eyebrow.textContent = "TÀI LIỆU LUYỆN TẬP";
    if (title && /Luyện tập tại nhà|Practice support/i.test(title.textContent ?? "")) title.textContent = "Luyện tập tại nhà";
  }

  let starter = Array.from(list.querySelectorAll<HTMLButtonElement>(":scope > button")).find((button) => {
    const text = button.textContent ?? "";
    return button.dataset.v18Starter === "true"
      || text.includes("KHỞI HÀNH")
      || text.includes("Giai điệu quen thuộc · ABC Song");
  }) ?? null;

  if (!starter) {
    starter = currentJourney.cloneNode(true) as HTMLButtonElement;
    starter.type = "button";
    starter.dataset.v18Starter = "true";
    list.insertBefore(starter, currentJourney);
  }

  starter.dataset.v18Starter = "true";
  starter.dataset.v18Family = "starter";
  starter.dataset.v18Access = "open";
  starter.disabled = false;
  starter.removeAttribute("disabled");
  starter.removeAttribute("aria-disabled");
  currentJourney.insertAdjacentElement("afterend", starter);

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
    const arrow = button.querySelector<HTMLElement>("[data-v21-practice-arrow='true'], [class*='practiceArrow']") ?? button.children[4] as HTMLElement | undefined;
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
    : "<strong>Ưu tiên bài đang học</strong><span>Hành Trình hiện tại ở đầu danh sách. Khởi Hành luôn mở; Chuyên Đề mở theo quyền hiện tại.</span>";

  const intro = Array.from(pianoSection.children).find((child) => child.tagName === "P") as HTMLParagraphElement | undefined;
  if (intro) intro.textContent = "Khởi Hành, Hành Trình và Chuyên Đề dùng chung một trình luyện tập; khác nhau ở mục đích và quyền truy cập.";
}
