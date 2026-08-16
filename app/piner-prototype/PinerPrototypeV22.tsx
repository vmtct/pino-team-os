"use client";

import { useEffect, useRef } from "react";
import PinerPrototypeV21 from "./PinerPrototypeV21";
import v22 from "./piner-prototype-v22.module.css";

const CONTENT_AVATAR_URL = "https://assets.pinohouse.art/draft/Whiteboard%20(2).png";

export default function PinerPrototypeV22() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;
    let scheduled = false;
    const observer = new MutationObserver(() => schedule());

    const observe = () => observer.observe(root, { childList: true, subtree: true, characterData: true });

    const run = () => {
      scheduled = false;
      observer.disconnect();
      try {
        polishExploreSchedule(root);
        polishTouchpointSheet(root);
        updateBadge(root);
      } finally {
        observe();
      }
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(run);
    };

    run();
    const interval = window.setInterval(run, 500);

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef} className={v22.root}>
      <PinerPrototypeV21 />
    </div>
  );
}

function updateBadge(root: HTMLElement) {
  const badge = Array.from(root.querySelectorAll<HTMLElement>("aside div, aside span")).find((node) => {
    const text = node.textContent?.trim() ?? "";
    return text.startsWith("LOCAL PROTOTYPE") || text.startsWith("BẢN THỬ NỘI BỘ");
  });
  if (badge) badge.textContent = "BẢN THỬ NỘI BỘ · V22 POLISH";
}

function polishExploreSchedule(root: HTMLElement) {
  const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-v21-session-card='true']"));

  cards.forEach((card) => {
    card.dataset.v22SessionCard = "true";
    const source = card.querySelector<HTMLElement>("[data-v21-session-time='true']");
    const register = card.querySelector<HTMLButtonElement>(":scope > button:last-child");
    if (!source || !register) return;

    source.dataset.v22ScheduleSource = "true";
    const raw = source.textContent?.trim() ?? "";
    const parts = raw.split("·").map((part) => part.trim()).filter(Boolean);
    const day = parts[0] ?? raw;
    const time = parts.slice(1).join(" · ") || "";

    let schedule = card.querySelector<HTMLElement>("[data-v22-session-schedule='true']");
    if (!schedule) {
      schedule = document.createElement("div");
      schedule.dataset.v22SessionSchedule = "true";
      const dayNode = document.createElement("span");
      dayNode.dataset.v22SessionDay = "true";
      const timeNode = document.createElement("strong");
      timeNode.dataset.v22SessionClock = "true";
      schedule.append(dayNode, timeNode);
      card.insertBefore(schedule, register);
    }

    const dayNode = schedule.querySelector<HTMLElement>("[data-v22-session-day='true']");
    const timeNode = schedule.querySelector<HTMLElement>("[data-v22-session-clock='true']");
    if (dayNode && dayNode.textContent !== day) dayNode.textContent = day;
    if (timeNode && timeNode.textContent !== time) timeNode.textContent = time;
  });
}

function polishTouchpointSheet(root: HTMLElement) {
  const details = Array.from(root.querySelectorAll<HTMLElement>("[data-v21-touchpoint-detail='true']"));

  details.forEach((detail) => {
    const sheet = detail.parentElement;
    if (!sheet) return;
    sheet.dataset.v22TouchpointSheet = "true";
    detail.dataset.v22TouchpointDetail = "true";

    const header = Array.from(sheet.children).find((child) => {
      if (!(child instanceof HTMLElement)) return false;
      return Boolean(child.querySelector("h3") && child.querySelector(":scope > button"));
    });
    if (header instanceof HTMLElement) header.dataset.v22TouchpointHeader = "true";

    if (!sheet.querySelector(":scope > [data-v22-touchpoint-hero='true']")) {
      const image = document.createElement("img");
      image.src = CONTENT_AVATAR_URL;
      image.alt = "Ảnh đại diện buổi học sắp tới";
      image.dataset.v22TouchpointHero = "true";
      sheet.insertBefore(image, sheet.firstChild);
    }

    const oldAvatar = detail.querySelector<HTMLElement>("[data-v21-touchpoint-avatar='true']");
    if (oldAvatar) oldAvatar.dataset.v22LegacyTouchpointAvatar = "true";

    const glyph = Array.from(detail.querySelectorAll<HTMLElement>(":scope > span")).find((span) => span.dataset.v21TouchpointAvatar !== "true");
    if (glyph) glyph.dataset.v22TouchpointGlyph = "true";
  });
}
