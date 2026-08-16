"use client";

import { useEffect, useRef } from "react";
import PinerPrototypeV20 from "./PinerPrototypeV20";
import v21 from "./piner-prototype-v21.module.css";

const CONTENT_AVATAR_URL = "https://assets.pinohouse.art/draft/Whiteboard%20(2).png";
const PINO_LOGO_URL = "https://assets.pinohouse.art/site/core/Pino%20Sigil.png";

const PIANO_LEVELS = [
  "Sing",
  "Play",
  "Melody",
  "Two Hands",
  "Perform",
  "Arpeggio",
  "New Key",
  "Harmony",
  "Expression",
  "Perform+",
] as const;

const RESOURCE_TAGS = [
  {
    match: (text: string) => text.includes("Giai điệu quen thuộc") || text.includes("ABC Song"),
    tags: ["quen thuộc", "tay phải", "khởi hành"],
  },
  {
    match: (text: string) => text.includes("Always With Me") && (text.includes("Mở rộng") || text.includes("Expansion") || text.includes("L6")),
    tags: ["Ghibli", "arpeggio", "chuyển thế"],
  },
  {
    match: (text: string) => text.includes("Always With Me"),
    tags: ["Ghibli", "lãng mạn", "vắt ngón"],
  },
  {
    match: (text: string) => text.includes("Film Music Specialty") || text.includes("Film Âm nhạc Specialty") || (text.includes("Film") && text.includes("Chuyên Đề")),
    tags: ["nhạc phim", "hòa âm", "chuyên đề"],
  },
  {
    match: (text: string) => text.includes("Twinkle Twinkle"),
    tags: ["quen thuộc", "giai điệu", "khởi hành"],
  },
] as const;

export default function PinerPrototypeV21() {
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
        polish(root);
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
    const interval = window.setInterval(() => polish(root), 450);

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef} className={v21.root}>
      <PinerPrototypeV20 />
    </div>
  );
}

function polish(root: HTMLElement) {
  updatePrototypeBadge(root);
  polishHeaderLogo(root);
  polishNavigationIcons(root);
  polishPackageContext(root);
  hideExploreCampaignBanner(root);
  polishPracticeCards(root);
  polishPianoLevels(root);
  polishMiaHomeHero(root);
  polishMusicPieceAvatars(root);
  polishSessionAvatars(root);
}

function updatePrototypeBadge(root: HTMLElement) {
  const badge = Array.from(root.querySelectorAll<HTMLElement>("aside div, aside span")).find((node) => {
    const text = node.textContent?.trim() ?? "";
    return text.startsWith("LOCAL PROTOTYPE") || text.startsWith("BẢN THỬ NỘI BỘ");
  });
  if (badge) badge.textContent = "BẢN THỬ NỘI BỘ · V21 POLISH";
}

function polishHeaderLogo(root: HTMLElement) {
  const header = Array.from(root.querySelectorAll<HTMLElement>("header")).find((candidate) => candidate.textContent?.includes("PINO"));
  if (!header) return;

  const wordmark = Array.from(header.querySelectorAll<HTMLElement>("span")).find((span) => span.dataset.v21PinoLogo === "true" || span.textContent?.trim() === "PINO");
  if (!wordmark) return;

  wordmark.dataset.v21PinoLogo = "true";

  if (!wordmark.querySelector("[data-v21-pino-logo-text='true']")) {
    wordmark.textContent = "";
    const label = document.createElement("span");
    label.textContent = "PINO";
    label.dataset.v21PinoLogoText = "true";
    wordmark.appendChild(label);
  }

  if (!wordmark.querySelector("img")) {
    const image = document.createElement("img");
    image.src = PINO_LOGO_URL;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.dataset.v21PinoLogoImage = "true";
    wordmark.appendChild(image);
  }
}

function polishNavigationIcons(root: HTMLElement) {
  const nav = root.querySelector<HTMLElement>("[data-v16-primary-nav='true']")
    ?? Array.from(root.querySelectorAll<HTMLElement>("nav")).find((candidate) => candidate.querySelectorAll(":scope > button").length === 4);
  if (!nav) return;

  Array.from(nav.querySelectorAll<HTMLButtonElement>(":scope > button")).forEach((button) => {
    button.dataset.v21NavButton = "true";
    const label = button.querySelector<HTMLElement>(":scope > small");
    if (label) {
      label.style.setProperty("font-size", "12px", "important");
      label.style.setProperty("font-weight", button.dataset.v16Active === "true" ? "750" : "650", "important");
      label.style.setProperty("line-height", "1.15", "important");
    }

    const icon = button.querySelector<HTMLElement>(":scope > span");
    if (!icon) return;
    icon.dataset.v21NavIcon = "true";

    if (!icon.querySelector("img")) {
      icon.textContent = "";
      const image = document.createElement("img");
      image.src = PINO_LOGO_URL;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      image.dataset.v21NavIconImage = "true";
      icon.appendChild(image);
    }
  });
}

function polishPackageContext(root: HTMLElement) {
  const packageSections = Array.from(root.querySelectorAll<HTMLElement>("section")).filter((section) => {
    const text = section.textContent ?? "";
    return text.includes("Bắt đầu") && text.includes("Hết gói") && (text.includes("Gói hiện tại") || text.includes("Giai đoạn dùng thử") || text.includes("Gói đã hết hạn"));
  });

  packageSections.forEach((section) => {
    section.dataset.v21Package = "true";
    Array.from(section.querySelectorAll<HTMLParagraphElement>(":scope > p")).forEach((paragraph) => {
      paragraph.dataset.v21PackageFooter = "true";
      paragraph.style.display = "none";
    });
  });
}

function hideExploreCampaignBanner(root: HTMLElement) {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>("section")).filter((section) => {
    return Boolean(section.querySelector("button[aria-label^='Campaign']"));
  });

  const leafCampaignSections = candidates.filter((section) => {
    return !Array.from(section.querySelectorAll<HTMLElement>("section")).some((descendant) => {
      return Boolean(descendant.querySelector("button[aria-label^='Campaign']"));
    });
  });

  candidates.forEach((section) => {
    const shouldHide = leafCampaignSections.includes(section);
    if (shouldHide) {
      section.dataset.v21ExploreBanner = "hidden";
      section.style.display = "none";
    } else if (section.dataset.v21ExploreBanner === "hidden") {
      delete section.dataset.v21ExploreBanner;
      section.style.removeProperty("display");
    }
  });
}

function polishPracticeCards(root: HTMLElement) {
  const cards = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).filter((button) => {
    const text = button.textContent ?? "";
    return text.includes("Founder · published") || text.includes("Founder · draft");
  });

  cards.forEach((card) => {
    const text = card.textContent ?? "";
    const tags = RESOURCE_TAGS.find((entry) => entry.match(text))?.tags;
    if (!tags) return;

    const children = Array.from(card.children) as HTMLElement[];
    if (children.length < 5) return;

    card.dataset.v21PracticeCard = "true";
    card.dataset.v21MetadataSource = "r2-prototype";
    children[0].dataset.v21PracticeKind = "true";
    children[1].dataset.v21PracticeCopy = "true";
    children[2].dataset.v21GenericAssets = "true";
    children[3].dataset.v21FounderState = "true";
    children[4].dataset.v21PracticeArrow = "true";

    let avatar = card.querySelector<HTMLElement>("[data-v21-practice-avatar='true']");
    if (!avatar) {
      avatar = document.createElement("span");
      avatar.dataset.v21PracticeAvatar = "true";
      const image = document.createElement("img");
      image.src = CONTENT_AVATAR_URL;
      const title = children[1].querySelector("strong")?.textContent?.trim() || "Nhạc phẩm";
      image.alt = `Ảnh đại diện ${title}`;
      avatar.appendChild(image);
      card.appendChild(avatar);
    }

    let tagRow = card.querySelector<HTMLElement>("[data-v21-resource-tags='true']");
    if (!tagRow) {
      tagRow = document.createElement("span");
      tagRow.dataset.v21ResourceTags = "true";
      card.appendChild(tagRow);
    }

    const nextSignature = tags.join("|");
    if (tagRow.dataset.v21TagSignature !== nextSignature) {
      tagRow.textContent = "";
      tags.forEach((tag) => {
        const chip = document.createElement("small");
        chip.textContent = tag;
        tagRow?.appendChild(chip);
      });
      tagRow.dataset.v21TagSignature = nextSignature;
    }
  });
}

function polishPianoLevels(root: HTMLElement) {
  const levelNodes = Array.from(root.querySelectorAll<HTMLElement>("div")).filter((node) => {
    const strong = node.querySelector<HTMLElement>(":scope > strong");
    return Boolean(strong && /^L(?:10|[1-9])$/.test(strong.textContent?.trim() ?? ""));
  });

  const unique = levelNodes.filter((node) => {
    const parent = node.parentElement;
    return parent && Array.from(parent.children).filter((child) => /^L(?:10|[1-9])$/.test(child.querySelector(":scope > strong")?.textContent?.trim() ?? "")).length >= 10;
  });
  if (unique.length < 10) return;

  const parent = unique[0].parentElement;
  if (!parent) return;
  parent.dataset.v21LevelLadder = "true";

  parent.querySelector<HTMLElement>("[data-v21-level-extra='true']")?.remove();

  const ordered = Array.from(parent.children).filter((child): child is HTMLElement => {
    if (!(child instanceof HTMLElement)) return false;
    return /^L(?:10|[1-9])$/.test(child.querySelector(":scope > strong")?.textContent?.trim() ?? "");
  });

  ordered.forEach((node) => {
    const strong = node.querySelector<HTMLElement>(":scope > strong");
    const small = node.querySelector<HTMLElement>(":scope > small");
    const match = strong?.textContent?.trim().match(/^L(10|[1-9])$/);
    if (!match || !small) return;
    const level = Number(match[1]);
    const wasLocked = (small.textContent ?? "").includes("🔒");
    small.textContent = `${PIANO_LEVELS[level - 1]}${wasLocked ? " · 🔒" : ""}`;
    small.style.setProperty("font-size", "10px", "important");
    small.style.setProperty("font-weight", "650", "important");
    node.dataset.v21PianoLevel = String(level);
    if (level === 4) node.dataset.v21LevelCurrent = "true";
  });
}

function polishMiaHomeHero(root: HTMLElement) {
  const scenarioKey = root.querySelector<HTMLSelectElement>("#scenario")?.value ?? "";
  if (scenarioKey !== "mia-lpa") return;

  const hero = Array.from(root.querySelectorAll<HTMLElement>("section")).find((section) => {
    const heading = section.querySelector<HTMLElement>(":scope > h2");
    const eyebrow = section.querySelector<HTMLElement>(":scope > span");
    return heading?.textContent?.trim() === "Cơn mưa chấm tròn"
      && (eyebrow?.textContent ?? "").includes("Tuần này của Mía");
  });
  if (!hero) return;

  hero.dataset.v21SyllabusHero = "true";
  if (!hero.querySelector("[data-v21-syllabus-avatar='true']")) {
    const avatar = document.createElement("span");
    avatar.dataset.v21SyllabusAvatar = "true";
    const image = document.createElement("img");
    image.src = CONTENT_AVATAR_URL;
    image.alt = "Ảnh đại diện chủ đề Cơn mưa chấm tròn";
    avatar.appendChild(image);
    hero.appendChild(avatar);
  }
}

function polishMusicPieceAvatars(root: HTMLElement) {
  const heroSections = Array.from(root.querySelectorAll<HTMLElement>("section")).filter((section) => {
    const title = section.querySelector("h3")?.textContent?.trim() ?? "";
    return title === "Always With Me" || title === "ABC Song";
  });

  heroSections.forEach((section) => {
    const glyph = Array.from(section.querySelectorAll<HTMLElement>("span")).find((span) => {
      const text = span.textContent?.trim() ?? "";
      return text === "♬" || text === "♫";
    });
    if (!glyph) return;
    glyph.dataset.v21MusicAvatar = "hero";
    if (!glyph.querySelector("img")) {
      const image = document.createElement("img");
      image.src = CONTENT_AVATAR_URL;
      image.alt = `Ảnh đại diện ${section.querySelector("h3")?.textContent?.trim() ?? "nhạc phẩm"}`;
      glyph.appendChild(image);
    }
  });

  const songRows = Array.from(root.querySelectorAll<HTMLElement>("div")).filter((row) => {
    const strong = row.querySelector<HTMLElement>(":scope > strong");
    const title = strong?.textContent?.trim() ?? "";
    return title === "ABC Song" || title === "Twinkle Twinkle" || title === "Bài quen thuộc tiếp theo";
  });

  songRows.forEach((row) => {
    const glyph = row.querySelector<HTMLElement>(":scope > span");
    if (!glyph) return;
    glyph.dataset.v21MusicAvatar = "small";
    if (!glyph.querySelector("img")) {
      const image = document.createElement("img");
      image.src = CONTENT_AVATAR_URL;
      image.alt = `Ảnh đại diện ${row.querySelector("strong")?.textContent?.trim() ?? "nhạc phẩm"}`;
      glyph.appendChild(image);
    }
  });
}

function polishSessionAvatars(root: HTMLElement) {
  const sessionCards = Array.from(root.querySelectorAll<HTMLElement>("article")).filter((article) => {
    const text = article.textContent ?? "";
    return text.includes("Đăng ký") && (text.includes("OPEN STUDIO") || text.includes("BUỔI PREMIUM") || text.includes("PREMIUM SESSION"));
  });

  sessionCards.forEach((card) => {
    const visual = Array.from(card.querySelectorAll<HTMLElement>(":scope > div")).find((candidate) => candidate.querySelector(":scope > em"));
    if (!visual) return;
    visual.dataset.v21SessionVisual = "true";
    const emoji = visual.querySelector<HTMLElement>(":scope > span");
    if (emoji) emoji.dataset.v21UnicodeAvatar = "true";

    if (!visual.querySelector("img")) {
      const image = document.createElement("img");
      image.src = CONTENT_AVATAR_URL;
      const title = card.querySelector<HTMLElement>("strong")?.textContent?.trim() || "Open Studio";
      image.alt = `Ảnh đại diện ${title}`;
      image.dataset.v21SessionImage = "true";
      visual.insertBefore(image, visual.firstChild);
    }
  });

  const modalHeroes = Array.from(root.querySelectorAll<HTMLElement>("div")).filter((candidate) => {
    const directSpan = candidate.querySelector<HTMLElement>(":scope > span");
    const directBody = candidate.querySelector<HTMLElement>(":scope > div");
    if (!directSpan || !directBody) return false;
    const text = directBody.textContent ?? "";
    return (text.includes("OPEN STUDIO") || text.includes("BUỔI PREMIUM") || text.includes("PREMIUM SESSION")) && Boolean(directBody.querySelector("strong"));
  });

  modalHeroes.forEach((hero) => {
    hero.dataset.v21SessionHero = "true";
    const emoji = hero.querySelector<HTMLElement>(":scope > span");
    if (emoji) emoji.dataset.v21UnicodeAvatar = "true";
    if (!hero.querySelector(":scope > img")) {
      const image = document.createElement("img");
      image.src = CONTENT_AVATAR_URL;
      image.alt = "Ảnh đại diện hoạt động";
      image.dataset.v21SessionHeroImage = "true";
      hero.insertBefore(image, hero.firstChild);
    }
  });
}
