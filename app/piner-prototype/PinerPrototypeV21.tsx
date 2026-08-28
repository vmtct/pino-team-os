"use client";

import { MouseEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PinerPrototypeV20 from "./PinerPrototypeV20";
import v21 from "./piner-prototype-v21.module.css";
import { findPrototypeDevice, updatePrototypeBadge } from "./prototype-dom";
import { usePrototypePolish } from "./usePrototypePolish";

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
    match: (text: string) => text.includes("Film Music Specialty") || text.includes("Film Âm nhạc Specialty") || text.includes("Chuyên đề nhạc phim") || (text.includes("Film") && text.includes("Chuyên Đề")),
    tags: ["nhạc phim", "hòa âm", "chuyên đề"],
  },
  {
    match: (text: string) => text.includes("Twinkle Twinkle"),
    tags: ["quen thuộc", "giai điệu", "khởi hành"],
  },
] as const;

type SyllabusDetail = {
  week: string;
  title: string;
  shortDescription: string;
  skillSummary: string;
  skillset: string;
  keywords: string[];
};

// Snapshot from the canonical Notion Syllabus DB for ArtChitect · 26C.
// Prototype only: production must read this through Core rather than ship this snapshot.
const AC_SYLLABUS: SyllabusDetail[] = [
  {
    week: "26C (01)",
    title: "Những Hình Khối Đầu Tiên",
    shortDescription: "Khám phá các hình cơ bản và dùng chúng để tạo những khối đá, kiến trúc và địa hình đầu tiên của Terravia.",
    skillSummary: "Nhận biết, đơn giản hóa và kết hợp hình tròn, vuông, tam giác để tạo cấu trúc rõ ràng.",
    skillset: "Shape",
    keywords: ["shape", "basic forms", "geometry", "structure", "building"],
  },
  {
    week: "26C (02)",
    title: "Đường Nét Của Hẻm Núi",
    shortDescription: "Khám phá cách đường nét thay đổi cảm giác về đá, vách núi, địa hình và chuyển động trong Terravia.",
    skillSummary: "Điều khiển độ dày, độ dài, hướng và nhịp của nét để tạo chất liệu và biểu đạt chuyển động.",
    skillset: "Line Quality",
    keywords: ["line", "stroke", "contour", "movement", "rock"],
  },
  {
    week: "26C (03)",
    title: "Đá Biết Đứng",
    shortDescription: "Biến các hình phẳng thành những khối đá, tinh thể và kiến trúc có cảm giác ba chiều.",
    skillSummary: "Tạo thể tích bằng cách xác định mặt, chiều sâu và mối quan hệ giữa các phần của vật thể.",
    skillset: "Form",
    keywords: ["form", "volume", "3D", "depth", "solid"],
  },
  {
    week: "26C (04)",
    title: "Bề Mặt Terravia",
    shortDescription: "Quan sát và tạo bề mặt cho đá, đất, vách núi và các vật liệu đặc trưng của Terravia.",
    skillSummary: "Tạo và kiểm soát texture bằng nét, hình và nhịp lặp để gợi chất liệu và bề mặt.",
    skillset: "Texture",
    keywords: ["texture", "rock", "stone", "surface", "material"],
  },
  {
    week: "26C (05)",
    title: "Bóng Hình Thung Lũng",
    shortDescription: "Tạo hình các sinh vật, nhân vật và công trình Terravia bằng những bóng hình mạnh, dễ nhận biết.",
    skillSummary: "Tập trung vào đường viền và khối tổng thể để truyền đạt hình dáng, tư thế và đặc điểm mà không cần chi tiết.",
    skillset: "Silhouette",
    keywords: ["silhouette", "shape language", "character", "creature", "architecture"],
  },
  {
    week: "26C (06)",
    title: "Sáng Tối Của Hẻm Núi",
    shortDescription: "Khám phá ánh sáng và bóng tối để tạo chiều sâu, khối đá và không khí cho hẻm núi Terravia.",
    skillSummary: "Sử dụng các cấp độ sáng tối để phân tách khối, tạo chiều sâu và xác định nguồn sáng.",
    skillset: "Value",
    keywords: ["value", "light", "shadow", "depth", "atmosphere"],
  },
  {
    week: "26C (07)",
    title: "Bố Cục Thành Phố Đá",
    shortDescription: "Sắp xếp các khối kiến trúc và địa hình để tạo một khung cảnh thành phố đá có điểm nhìn rõ ràng.",
    skillSummary: "Tổ chức vị trí, kích thước và điểm nhấn để hình ảnh cân bằng, có thứ bậc thị giác và dẫn mắt người xem.",
    skillset: "Composition",
    keywords: ["composition", "balance", "focal point", "framing", "visual hierarchy"],
  },
  {
    week: "26C (08)",
    title: "Con Đường Vào Terravia",
    shortDescription: "Khám phá phối cảnh qua những con đường, cây cầu và thành phố nằm sâu trong hẻm núi Terravia.",
    skillSummary: "Xây dựng cảm giác không gian bằng đường chân trời, điểm tụ, tỷ lệ và quan hệ gần–xa.",
    skillset: "Perspective",
    keywords: ["perspective", "space", "scale", "depth", "canyon"],
  },
  {
    week: "26C (09)",
    title: "Đôi Mắt Nhà Thám Hiểm",
    shortDescription: "Quan sát đá, tinh thể, kiến trúc và cảnh quan để tìm chi tiết thực tế làm giàu thế giới Terravia.",
    skillSummary: "Rèn khả năng nhìn, ghi nhận hình dáng, tỷ lệ, chi tiết và đặc điểm thị giác trước khi chuyển hóa thành tác phẩm.",
    skillset: "Observation",
    keywords: ["observation", "reference", "detail", "discovery", "real world"],
  },
  {
    week: "26C (10)",
    title: "Hoa Văn Cổ Đại",
    shortDescription: "Tạo hoa văn lấy cảm hứng từ đá, tinh thể, cổ vật và ký hiệu của cư dân Terravia.",
    skillSummary: "Phát hiện motif, đơn giản hóa hình và lặp lại có chủ đích để tạo pattern nhất quán.",
    skillset: "Pattern",
    keywords: ["pattern", "symbols", "ornament", "repetition", "ancient"],
  },
  {
    week: "26C (11)",
    title: "Ánh Sáng Trong Hang Sâu",
    shortDescription: "Khám phá ánh sáng trong hang sâu và cách tương phản làm nổi bật chủ thể giữa bóng tối Terravia.",
    skillSummary: "Điều chỉnh chênh lệch sáng tối, kích thước và sắc độ để tạo tiêu điểm và tăng cảm xúc thị giác.",
    skillset: "Contrast",
    keywords: ["contrast", "light", "dark", "focus", "drama"],
  },
  {
    week: "26C (12)",
    title: "Người Kiến Tạo Terravia",
    shortDescription: "Tổng hợp các kỹ năng đã học để tạo một tác phẩm hoàn chỉnh kể một câu chuyện về Terravia.",
    skillSummary: "Kết hợp hình, đường nét, khối, texture, không gian, ánh sáng và bố cục để hoàn thiện một tác phẩm có chủ đích.",
    skillset: "Final Integration",
    keywords: ["world building", "integration", "masterpiece", "portfolio", "presentation"],
  },
];

export default function PinerPrototypeV21() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [syllabusModal, setSyllabusModal] = useState<SyllabusDetail | null>(null);

  usePrototypePolish(rootRef, polish, { observeMutations: true });

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    const topic = (event.target as HTMLElement).closest<HTMLElement>("[data-v21-ac-topic-index]");
    if (!topic) return;
    const index = Number(topic.dataset.v21AcTopicIndex);
    const detail = AC_SYLLABUS[index];
    if (!detail) return;
    event.preventDefault();
    event.stopPropagation();
    setSyllabusModal(detail);
  }

  const portalTarget = syllabusModal ? findPrototypeDevice(rootRef.current) : null;

  return (
    <div ref={rootRef} className={v21.root} onClickCapture={handleClickCapture}>
      <PinerPrototypeV20 />
      {syllabusModal && portalTarget && createPortal(
        <SyllabusModal detail={syllabusModal} onClose={() => setSyllabusModal(null)} />,
        portalTarget,
      )}
    </div>
  );
}

function SyllabusModal({ detail, onClose }: { detail: SyllabusDetail; onClose: () => void }) {
  return (
    <div className={v21.syllabusBackdrop} onMouseDown={onClose}>
      <section className={v21.syllabusModal} onMouseDown={(event) => event.stopPropagation()}>
        <header className={v21.syllabusModalHeader}>
          {/* Prototype keeps a direct remote asset URL for visual parity. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CONTENT_AVATAR_URL} alt={`Ảnh đại diện ${detail.title}`} />
          <div>
            <span>{detail.week} · ArtChitect</span>
            <h2>{detail.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng chi tiết buổi học">×</button>
        </header>

        <div className={v21.syllabusModalBody}>
          <section>
            <small>Giới thiệu</small>
            <p>{detail.shortDescription}</p>
          </section>
          <section>
            <small>Kỹ năng trọng tâm</small>
            <p>{detail.skillSummary}</p>
          </section>
          <div className={v21.syllabusFocusRow}>
            <span className={v21.syllabusSkillset}>{detail.skillset}</span>
            <div>{detail.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div>
          </div>
        </div>
      </section>
    </div>
  );
}

function polish(root: HTMLElement) {
  updatePrototypeBadge(root, "BẢN THỬ NỘI BỘ · V21 POLISH");
  polishHeaderLogo(root);
  polishNavigationIcons(root);
  polishPackageContext(root);
  hideExploreCampaignBanner(root);
  polishPracticeCards(root);
  polishPianoLevels(root);
  polishMiaHomeHero(root);
  polishAcSyllabus(root);
  polishNextTouchpoint(root);
  polishMusicPieceAvatars(root);
  polishSessionAvatars(root);
  normalizeExploreVocabulary(root);
}

function polishHeaderLogo(root: HTMLElement) {
  const header = Array.from(root.querySelectorAll<HTMLElement>("header")).find((candidate) => candidate.textContent?.includes("PINO") || candidate.querySelector("[data-v21-pino-logo='true']"));
  if (!header) return;

  const wordmark = Array.from(header.querySelectorAll<HTMLElement>("span")).find((span) => span.dataset.v21PinoLogo === "true" || span.textContent?.trim() === "PINO");
  if (!wordmark) return;

  wordmark.dataset.v21PinoLogo = "true";

  let label = wordmark.querySelector<HTMLElement>("[data-v21-pino-logo-text='true']");
  if (!label) {
    label = document.createElement("span");
    label.textContent = "PINO";
    label.dataset.v21PinoLogoText = "true";
  }

  let image = wordmark.querySelector<HTMLImageElement>("[data-v21-pino-logo-image='true']");
  if (!image) {
    image = document.createElement("img");
    image.src = PINO_LOGO_URL;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.dataset.v21PinoLogoImage = "true";
  }

  if (wordmark.firstElementChild !== image || image.nextElementSibling !== label) {
    wordmark.replaceChildren(image, label);
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
    const toggle = section.querySelector<HTMLButtonElement>("[data-v16-package-toggle='true']");
    const chevron = toggle?.querySelector<HTMLElement>("[data-v16-package-chevron='true']");
    if (toggle && chevron) chevron.textContent = toggle.getAttribute("aria-expanded") === "true" ? "↑" : "↓";
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
    return Boolean(button.dataset.v18Family) || text.includes("Founder · published") || text.includes("Founder · draft") || button.dataset.v21PracticeCard === "true";
  });

  cards.forEach((card) => {
    const text = card.textContent ?? "";
    const tags = RESOURCE_TAGS.find((entry) => entry.match(text))?.tags;
    if (!tags) return;

    const children = Array.from(card.children).filter((child) => !(child instanceof HTMLElement) || !child.dataset.v21PracticeAvatar && !child.dataset.v21ResourceTags) as HTMLElement[];
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

function polishAcSyllabus(root: HTMLElement) {
  const section = Array.from(root.querySelectorAll<HTMLElement>("section")).find((candidate) => {
    return candidate.querySelector("h3")?.textContent?.includes("12 buổi theo lịch của gói") ?? false;
  });
  if (!section) return;

  const topics = Array.from(section.querySelectorAll<HTMLElement>("article")).slice(0, AC_SYLLABUS.length);
  topics.forEach((topic, index) => {
    const detail = AC_SYLLABUS[index];
    if (!detail) return;
    topic.dataset.v21AcTopicIndex = String(index);
    topic.dataset.v21AcTopic = "true";
    topic.setAttribute("role", "button");
    topic.tabIndex = 0;
    topic.setAttribute("aria-label", `Xem chi tiết ${detail.title}`);

    const title = topic.querySelector<HTMLElement>(":scope > strong");
    if (title) {
      title.textContent = detail.title;
      title.dataset.v21AcTopicTitle = "true";
    }

    const top = topic.querySelector<HTMLElement>(":scope > div");
    const week = top?.querySelector<HTMLElement>(":scope > span");
    if (week) week.textContent = detail.week;
  });
}

function polishNextTouchpoint(root: HTMLElement) {
  const returnCards = Array.from(root.querySelectorAll<HTMLElement>("section")).filter((section) => {
    const eyebrow = Array.from(section.querySelectorAll<HTMLElement>("span")).find((span) => span.textContent?.trim() === "Quay lại PINO" || span.textContent?.trim() === "Return to PINO");
    return Boolean(eyebrow && section.querySelector("h3"));
  });

  returnCards.forEach((card) => {
    card.dataset.v21TouchpointCard = "true";
    if (!card.querySelector("[data-v21-touchpoint-avatar='true']")) {
      const avatar = document.createElement("span");
      avatar.dataset.v21TouchpointAvatar = "true";
      const image = document.createElement("img");
      image.src = CONTENT_AVATAR_URL;
      image.alt = "Ảnh đại diện buổi học sắp tới";
      avatar.appendChild(image);
      card.insertBefore(avatar, card.firstChild);
    }
  });

  const detailCards = Array.from(root.querySelectorAll<HTMLElement>("div")).filter((candidate) => {
    const strong = candidate.querySelector<HTMLElement>(":scope > strong");
    const paragraph = candidate.querySelector<HTMLElement>(":scope > p");
    return Boolean(strong && paragraph && /^Thứ|^Chủ Nhật|^Hôm/.test(strong.textContent?.trim() ?? ""));
  });

  detailCards.forEach((card) => {
    card.dataset.v21TouchpointDetail = "true";
    if (!card.querySelector("[data-v21-touchpoint-avatar='true']")) {
      const avatar = document.createElement("span");
      avatar.dataset.v21TouchpointAvatar = "true";
      const image = document.createElement("img");
      image.src = CONTENT_AVATAR_URL;
      image.alt = "Ảnh đại diện buổi học";
      avatar.appendChild(image);
      card.insertBefore(avatar, card.firstChild);
    }
  });
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
    const text = (article.textContent ?? "").toUpperCase();
    return article.dataset.v21SessionCard === "true" || (text.includes("ĐĂNG KÝ") && (text.includes("OPEN STUDIO") || text.includes("PREMIUM") || text.includes("KHÁM PHÁ")));
  });

  sessionCards.forEach((card) => {
    const text = card.textContent ?? "";
    const normalizedText = text.toUpperCase();
    const premium = card.dataset.v21SessionPremium === "true" || normalizedText.includes("PREMIUM");
    card.dataset.v21SessionCard = "true";
    card.dataset.v21SessionPremium = premium ? "true" : "false";

    const visual = Array.from(card.querySelectorAll<HTMLElement>(":scope > div")).find((candidate) => candidate.querySelector(":scope > em"));
    if (visual) {
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
    }

    const copy = visual?.nextElementSibling instanceof HTMLElement ? visual.nextElementSibling : null;
    if (!copy) return;
    copy.dataset.v21SessionCopy = "true";
    const badgeRow = copy.querySelector<HTMLElement>(":scope > div");
    if (badgeRow) {
      badgeRow.dataset.v21SessionTopline = "true";
      const primaryBadge = badgeRow.querySelector<HTMLElement>(":scope > span");
      if (primaryBadge) primaryBadge.textContent = premium ? "PREMIUM" : "KHÁM PHÁ";
    }

    const originalMeta = copy.querySelector<HTMLElement>(":scope > small");
    if (originalMeta) {
      originalMeta.dataset.v21SessionOriginalMeta = "true";
      if (badgeRow) {
        let context = badgeRow.querySelector<HTMLElement>("[data-v21-session-context='true']");
        if (!context) {
          context = document.createElement("small");
          context.dataset.v21SessionContext = "true";
          badgeRow.appendChild(context);
        }
        context.textContent = originalMeta.textContent ?? "";
      }
    }

    const time = copy.querySelector<HTMLElement>(":scope > b");
    if (time) time.dataset.v21SessionTime = "true";
    const note = copy.querySelector<HTMLElement>(":scope > p");
    if (note) note.dataset.v21SessionNote = "true";
  });

  const section = sessionCards[0]?.closest("section");
  if (section instanceof HTMLElement) {
    section.dataset.v21SessionSection = "true";
    const heading = section.querySelector<HTMLElement>("h3");
    if (heading) heading.textContent = "Khám Phá & Premium";
    const headingMeta = heading?.parentElement?.querySelector<HTMLElement>("span");
    if (headingMeta) headingMeta.textContent = "SẮP DIỄN RA";
    const headingSmall = heading?.parentElement?.parentElement?.querySelector<HTMLElement>(":scope > small");
    if (headingSmall) headingSmall.textContent = "Đăng ký theo cùng một luồng";

    const legend = Array.from(section.querySelectorAll<HTMLElement>("div")).find((candidate) => {
      const directSpans = candidate.querySelectorAll(":scope > span");
      return directSpans.length === 2 && (candidate.textContent?.includes("OPEN STUDIO") || candidate.textContent?.includes("KHÁM PHÁ"));
    });
    if (legend) {
      const spans = legend.querySelectorAll<HTMLElement>(":scope > span");
      if (spans[0]) spans[0].textContent = "KHÁM PHÁ";
      if (spans[1]) spans[1].textContent = "PREMIUM";
    }
  }

  const modalHeroes = Array.from(root.querySelectorAll<HTMLElement>("div")).filter((candidate) => {
    const directSpan = candidate.querySelector<HTMLElement>(":scope > span");
    const directBody = candidate.querySelector<HTMLElement>(":scope > div");
    if (!directSpan || !directBody) return false;
    const text = directBody.textContent ?? "";
    return (text.includes("OPEN STUDIO") || text.includes("BUỔI PREMIUM") || text.includes("PREMIUM SESSION") || text.includes("KHÁM PHÁ")) && Boolean(directBody.querySelector("strong"));
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

function normalizeExploreVocabulary(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  nodes.forEach((node) => {
    const parent = node.parentElement;
    if (!parent || parent.closest("script, style, aside, [data-v15-audit-mount='true']")) return;
    let value = node.nodeValue ?? "";
    value = value
      .replace(/Miễn phí và Premium/g, "Khám Phá <> Premium")
      .replace(/Free vs Premium/g, "Khám Phá <> Premium")
      .replace(/FREE \/ EXPIRED/g, "KHÁM PHÁ / ĐÃ HẾT HẠN")
      .replace(/Free \/ expired/g, "Khám Phá / đã hết hạn")
      .replace(/Free eligibility/g, "quyền Khám Phá")
      .replace(/FREE/g, "KHÁM PHÁ")
      .replace(/Free/g, "Khám Phá")
      .replace(/Miễn phí/g, "Khám Phá");
    if (value !== node.nodeValue) node.nodeValue = value;
  });
}
