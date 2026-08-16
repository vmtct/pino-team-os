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
        observer.observe(root, { childList: true, subtree: true });
      });
    };

    schedule();
    observer.observe(root, { childList: true, subtree: true });

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

  const practiceSections = Array.from(root.querySelectorAll<HTMLElement>("section"));
  const pianoSection = practiceSections.find((section) => {
    const text = section.textContent ?? "";
    const hasSpecialty = text.includes("Film Music Specialty") || text.includes("Film Âm nhạc Specialty") || text.includes("CHUYÊN ĐỀ");
    return (text.includes("Luyện tập tại nhà") || text.includes("Practice support"))
      && text.includes("Always With Me")
      && hasSpecialty;
  });
  if (!pianoSection) return;

  pianoSection.dataset.v18PracticeSection = "true";
  pianoSection.dataset.v18EndedAccess = ended ? "true" : "false";

  const resourceButtons = Array.from(pianoSection.querySelectorAll<HTMLButtonElement>("button"));
  const currentJourney = resourceButtons.find((button) => {
    const text = button.textContent ?? "";
    return text.includes("Always With Me") && !text.includes("Expansion") && !text.includes("Mở rộng");
  });
  if (!currentJourney?.parentElement) return;

  const list = currentJourney.parentElement;
  let starter = list.querySelector<HTMLButtonElement>("[data-v18-starter='true']");
  if (!starter) {
    starter = currentJourney.cloneNode(true) as HTMLButtonElement;
    starter.dataset.v18Starter = "true";
    starter.dataset.v18Family = "starter";
    starter.disabled = false;
    starter.removeAttribute("disabled");
    starter.removeAttribute("aria-disabled");

    const children = Array.from(starter.children) as HTMLElement[];
    if (children[0]) children[0].textContent = "KHỞI HÀNH";
    if (children[1]) {
      const strong = children[1].querySelector("strong");
      const small = children[1].querySelector("small");
      const em = children[1].querySelector("em");
      if (strong) strong.textContent = "Giai điệu quen thuộc · ABC Song";
      if (small) small.textContent = "Bản luyện tay phải · làm quen giai điệu";
      if (em) em.textContent = "Khởi Hành · luôn mở";
    }
    if (children[2]) {
      const assets = Array.from(children[2].querySelectorAll("small"));
      if (assets[0]) assets[0].textContent = "♩ Bản nhạc";
      if (assets[1]) assets[1].textContent = "☝ Hướng dẫn tay";
      if (assets[2]) assets[2].textContent = "▶ Nghe mẫu";
    }
    if (children[3]) children[3].textContent = "Founder · published";
    if (children[4]) children[4].textContent = "→";

    list.insertBefore(starter, currentJourney);
  }

  starter.dataset.v18Access = "open";
  starter.disabled = false;
  starter.removeAttribute("disabled");
  const starterArrow = starter.lastElementChild as HTMLElement | null;
  if (starterArrow) starterArrow.textContent = "→";

  Array.from(list.querySelectorAll<HTMLButtonElement>(":scope > button")).forEach((button) => {
    const text = button.textContent ?? "";
    if (button.dataset.v18Starter === "true") return;

    const isJourney = text.includes("HÀNH TRÌNH") || text.includes("JOURNEY") || text.includes("Always With Me");
    const isSpecialty = text.includes("CHUYÊN ĐỀ") || text.includes("SPECIALTY") || text.includes("Film Music Specialty") || text.includes("Film Âm nhạc Specialty");
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
