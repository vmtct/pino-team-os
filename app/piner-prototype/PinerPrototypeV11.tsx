"use client";

import { FormEvent, MouseEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PinerPrototypeV10 from "./PinerPrototypeV10";
import v11 from "./piner-prototype-v11.module.css";

type AppSurface = "home" | "journey" | "collection" | "explore";
type PracticeReviewStage = "CANDIDATE" | "CURATED" | "EVIDENCE_ONLY";
type MediaAccess = "FREE" | "PREMIUM" | "TRIAL" | "RETAINED" | "LOCKED";

type PracticeReview = {
  stage: PracticeReviewStage;
  title: string;
  page: number;
};

type CollectionMedia = {
  icon: string;
  label: string;
  access: MediaAccess;
  note: string;
};

type CollectionDetail = {
  title: string;
  kind: string;
  source: string;
  ownership: string;
  summary: string;
  media: CollectionMedia[];
};

const STORY_TITLES = [
  "Chú cá màu cam",
  "Ngôi nhà trên mây",
  "Always With Me · L4",
  "Khu rừng trong mơ · sketch",
  "ABC Song · first phrase",
  "Open Studio postcard",
  "Fundamental · L4",
];

function surfaceFromButton(text: string): AppSurface | null {
  const normalized = text.trim();
  if (normalized === "Home" || normalized.startsWith("Home")) return "home";
  if (normalized === "Journey" || normalized.startsWith("Journey")) return "journey";
  if (normalized === "Collection" || normalized.startsWith("Collection")) return "collection";
  if (normalized === "Explore" || normalized.startsWith("Explore")) return "explore";
  return null;
}

function currentScenarioKey() {
  if (typeof document === "undefined") return "";
  return document.querySelector<HTMLSelectElement>("#scenario")?.value ?? "";
}

function currentPracticePage() {
  if (typeof document === "undefined") return 1;
  const pageButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
  const active = pageButtons.find((button) => button.className.includes("pageTabActive") && /^Trang\s+\d+/.test((button.textContent ?? "").trim()));
  const match = active?.textContent?.match(/Trang\s+(\d+)/);
  return match ? Number(match[1]) : 1;
}

function accessLabel(access: MediaAccess) {
  if (access === "FREE") return "Free · mở";
  if (access === "PREMIUM") return "Premium · mở";
  if (access === "TRIAL") return "Premium · Trial";
  if (access === "RETAINED") return "Đã sở hữu · retained";
  return "Chưa sở hữu · locked";
}

function detailForStory(title: string, scenario: string): CollectionDetail | null {
  if (title === "Chú cá màu cam") {
    const premiumAccess: MediaAccess = scenario === "minh-premium" || scenario === "mia-lpa" || scenario === "bo-lpp"
      ? "PREMIUM"
      : scenario === "han-trial-ac"
        ? "TRIAL"
        : "LOCKED";
    return {
      title,
      kind: "Artwork",
      source: "Open Studio",
      ownership: "Learner item · owned",
      summary: "Một outcome duy nhất, nhưng từng representation bên trong có access riêng. Free/Premium không chia Collection thành hai lane.",
      media: [
        { icon: "🐠", label: "Ảnh tác phẩm", access: "FREE", note: "Souvenir cơ bản được giữ trong Free Collection." },
        { icon: "📷", label: "Ảnh con cùng tác phẩm", access: "FREE", note: "Representation thứ hai của cùng outcome." },
        { icon: "✨", label: "Curated portfolio view", access: premiumAccess, note: "Premium representation nằm bên trong cùng item; item không bị nhân đôi." },
      ],
    };
  }

  if (title === "Ngôi nhà trên mây") {
    return {
      title,
      kind: "Artwork",
      source: "ArtChitect · Character",
      ownership: "Premium · owned",
      summary: "Một project outcome có thể gom nhiều media đã được PINO chủ động chọn để learner xem lại.",
      media: [
        { icon: "☁️", label: "Ảnh tác phẩm chính", access: "PREMIUM", note: "Hero representation của project." },
        { icon: "🔎", label: "Ảnh chi tiết", access: "PREMIUM", note: "Close-up cho texture / detail." },
        { icon: "🖼️", label: "Portfolio treatment", access: "PREMIUM", note: "Curated learner-facing presentation, không phải raw evidence upload." },
      ],
    };
  }

  if (title === "Khu rừng trong mơ · sketch") {
    return {
      title,
      kind: "Artwork",
      source: "ArtChitect · Trial Premium",
      ownership: "Created during Trial",
      summary: "Trial dùng product thật. Media đã tạo trong Trial có thể mở với badge nhẹ; future/unowned content vẫn là trạng thái khác.",
      media: [
        { icon: "🌿", label: "Sketch hiện tại", access: "TRIAL", note: "Đã tạo trong Trial và đang mở." },
        { icon: "✏️", label: "Process snapshot", access: "TRIAL", note: "Một representation learner-facing đã được chọn." },
        { icon: "🔒", label: "Final portfolio outcome", access: "LOCKED", note: "Chưa tồn tại/chưa sở hữu; không được giả thành historical ownership." },
      ],
    };
  }

  if (title === "Always With Me · L4" && scenario === "leo-expired") {
    return {
      title,
      kind: "Music",
      source: "PianoHouse · expired Trial",
      ownership: "Historical ownership retained",
      summary: "Expired access khóa progression mới nhưng không thu hồi recording/milestone đã vested trong Trial.",
      media: [
        { icon: "▶", label: "L4 recording", access: "RETAINED", note: "Student-owned historical recording vẫn nghe được." },
        { icon: "◆", label: "L4 milestone card", access: "RETAINED", note: "Achievement đã đạt không hết hạn cùng subscription access." },
        { icon: "🔒", label: "Future L5 performance", access: "LOCKED", note: "Future/unowned Premium outcome, khác hoàn toàn retained history." },
      ],
    };
  }

  if (title === "Always With Me · L4") {
    return {
      title,
      kind: "Music",
      source: "PianoHouse",
      ownership: "Premium · owned",
      summary: "Music Collection là learner-facing outcome, không phải danh sách mọi file audio từng submit.",
      media: [
        { icon: "▶", label: "Recording được ghi nhận", access: "PREMIUM", note: "Curated/recognized recording của Journey context." },
        { icon: "◆", label: "L4 milestone", access: "PREMIUM", note: "Milestone representation gắn với thành quả đã đạt." },
        { icon: "🎬", label: "Performance cut", access: "PREMIUM", note: "Một learner-facing media representation khác của cùng music outcome." },
      ],
    };
  }

  if (title === "ABC Song · first phrase") {
    return {
      title,
      kind: "Music",
      source: "Little Piner Piano",
      ownership: "Premium · owned",
      summary: "LPP dùng cùng Collection contract nhưng giữ semantics self-paced riêng của Path.",
      media: [
        { icon: "🎵", label: "First phrase recording", access: "PREMIUM", note: "Recording moment đã được chọn để learner xem lại." },
        { icon: "🌟", label: "Practice moment", access: "PREMIUM", note: "Learner-facing moment, không phải raw practice submission queue." },
      ],
    };
  }

  if (title === "Open Studio postcard") {
    return {
      title,
      kind: "Artwork",
      source: "Open Studio",
      ownership: "Free · retained",
      summary: "Free outcome vẫn hữu ích sau khi Trial/Premium access kết thúc.",
      media: [{ icon: "🎨", label: "Postcard", access: "FREE", note: "Free-owned representation không bị paywall vì membership state thay đổi." }],
    };
  }

  if (title === "Fundamental · L4") {
    return {
      title,
      kind: "Milestone",
      source: "PianoHouse",
      ownership: "Achievement retained",
      summary: "Achievement là durable learner history. Expired access không biến achievement đã đạt thành locked content.",
      media: [{ icon: "◆", label: "L4 milestone", access: scenario === "leo-expired" ? "RETAINED" : "PREMIUM", note: "Canonical achievement projection trong Collection." }],
    };
  }

  return null;
}

function curatedPracticeDetail(review: PracticeReview): CollectionDetail {
  return {
    title: `${review.title} · Home Practice Take`,
    kind: "Music",
    source: `Home Practice · Trang ${review.page} · curated by PINO`,
    ownership: "Learner-facing curated outcome",
    summary: "Recording chỉ xuất hiện trong Collection sau quyết định curate/publish. Raw submission trước đó vẫn là Evidence candidate, không tự động trở thành Collection.",
    media: [
      { icon: "🎙️", label: `Practice recording · Trang ${review.page}`, access: "PREMIUM", note: "Đã được PINO chọn để surface cho learner." },
    ],
  };
}

export default function PinerPrototypeV11() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [surface, setSurface] = useState<AppSurface>("home");
  const [review, setReview] = useState<PracticeReview | null>(null);
  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const nav = rootRef.current?.querySelector("nav");
    const screen = nav?.previousElementSibling;
    setPortalTarget(screen instanceof HTMLElement ? screen : null);
  }, []);

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const button = target.closest("button") as HTMLButtonElement | null;
    if (!button) return;
    const text = button.textContent ?? "";

    const nextSurface = surfaceFromButton(text);
    if (nextSurface) setSurface(nextSurface);

    if (text.includes("Gửi bài luyện tập")) {
      setReview({ stage: "CANDIDATE", title: "Always With Me", page: currentPracticePage() });
      return;
    }

    if (surface !== "collection") return;
    const storyTitle = STORY_TITLES.find((title) => text.includes(title));
    if (!storyTitle) return;
    const nextDetail = detailForStory(storyTitle, currentScenarioKey());
    if (!nextDetail) return;

    event.preventDefault();
    event.stopPropagation();
    setDetail(nextDetail);
  }

  function handleChangeCapture(event: FormEvent<HTMLDivElement>) {
    const target = event.target as HTMLSelectElement;
    if (target.id !== "scenario") return;
    setReview(null);
    setDetail(null);
    setSurface("home");
  }

  function goCollection() {
    const nav = rootRef.current?.querySelector("nav");
    const button = Array.from(nav?.querySelectorAll("button") ?? []).find((candidate) => (candidate.textContent ?? "").includes("Collection"));
    button?.click();
    setSurface("collection");
  }

  return (
    <div ref={rootRef} className={v11.v11Root} onClickCapture={handleClickCapture} onChangeCapture={handleChangeCapture}>
      <PinerPrototypeV10 />

      {review && (
        <aside className={v11.staffBoundaryLab}>
          <span>V11 · PROTOTYPE STAFF BOUNDARY</span>
          <strong>{review.title} · Trang {review.page}</strong>
          {review.stage === "CANDIDATE" && (
            <>
              <small>Practice submission đang là Evidence candidate. Learner Collection chưa thay đổi.</small>
              <div>
                <button type="button" onClick={() => setReview((current) => current ? { ...current, stage: "CURATED" } : current)}>Curate vào Collection</button>
                <button type="button" onClick={() => setReview((current) => current ? { ...current, stage: "EVIDENCE_ONLY" } : current)}>Giữ Evidence only</button>
              </div>
            </>
          )}
          {review.stage === "CURATED" && (
            <>
              <small>Đã curate/publish learner-facing outcome. Collection có thể surface item mới.</small>
              <div><button type="button" onClick={goCollection}>Mở Collection →</button><button type="button" onClick={() => setReview(null)}>Reset</button></div>
            </>
          )}
          {review.stage === "EVIDENCE_ONLY" && (
            <>
              <small>Recording vẫn là internal Evidence; không xuất hiện trong Collection.</small>
              <div><button type="button" onClick={() => setReview((current) => current ? { ...current, stage: "CURATED" } : current)}>Curate sau</button><button type="button" onClick={() => setReview(null)}>Reset</button></div>
            </>
          )}
        </aside>
      )}

      {portalTarget && surface === "collection" && review?.stage === "CURATED" && createPortal(
        <button type="button" className={v11.curatedCollectionCard} onClick={() => setDetail(curatedPracticeDetail(review))}>
          <span className={v11.curatedIcon}>🎙️</span>
          <span><small>Mới được thêm vào Collection</small><strong>{review.title} · Home Practice Take</strong><em>Trang {review.page} · Curated by PINO</em></span>
          <b>→</b>
        </button>,
        portalTarget,
      )}

      {detail && <CollectionDetailModal detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function CollectionDetailModal({ detail, onClose }: { detail: CollectionDetail; onClose: () => void }) {
  return (
    <div className={v11.detailBackdrop} onMouseDown={onClose}>
      <section className={v11.detailModal} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span>{detail.kind}</span><h2>{detail.title}</h2><small>{detail.source}</small></div>
          <button type="button" onClick={onClose}>×</button>
        </header>

        <div className={v11.ownershipBanner}><strong>{detail.ownership}</strong><p>{detail.summary}</p></div>

        <div className={v11.mediaList}>
          {detail.media.map((media) => {
            const locked = media.access === "LOCKED";
            return (
              <article key={`${media.label}-${media.access}`} className={`${v11.mediaCard} ${locked ? v11.mediaLocked : ""}`}>
                <span className={v11.mediaIcon}>{locked ? "🔒" : media.icon}</span>
                <div><strong>{media.label}</strong><small>{media.note}</small></div>
                <em data-access={media.access}>{accessLabel(media.access)}</em>
              </article>
            );
          })}
        </div>

        {detail.media.some((media) => media.access === "LOCKED") && (
          <div className={v11.lockDoctrine}><strong>Locked ≠ lost ownership</strong><span>Chỉ future/unowned representation mới khóa. Media/Achievement đã vested vẫn retained khi access hết hạn.</span></div>
        )}

        <footer>Collection chỉ surface learner-facing outcomes đã được chọn; raw Evidence, audit và review queue ở ngoài surface này.</footer>
      </section>
    </div>
  );
}
