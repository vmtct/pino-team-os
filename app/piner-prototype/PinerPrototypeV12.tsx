"use client";

import { FormEvent, MouseEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PinerPrototypeV11 from "./PinerPrototypeV11";
import { scenarios, type StudentScenario } from "./fixtures-v2";
import v12 from "./piner-prototype-v12.module.css";

type AppSurface = "home" | "journey" | "collection" | "explore";
type LifecycleState = "TRIAL" | "EXPIRED" | "REENROLLED";
type LifecycleCollectionKind = "MUSIC" | "MILESTONE";

type LifecycleCollectionDetail = {
  kind: LifecycleCollectionKind;
  state: LifecycleState;
};

const leoTrial: StudentScenario = {
  key: "leo-trial",
  name: "Leo",
  shortName: "Leo",
  ageLabel: "12 tuổi",
  avatar: "L",
  mode: "TRIAL_PREMIUM",
  membershipLabel: "Trial Premium",
  membershipNote: "PianoHouse · real Journey",
  paths: [
    {
      key: "PIANOHOUSE",
      label: "PianoHouse",
      eyebrow: "Trial Journey",
      summary: "Always With Me · L4",
      package: {
        start: "10/08/2026",
        end: "23/08/2026",
        status: "TRIAL",
        note: "Trial 14 ngày · progress thật · không phải demo shell",
      },
    },
  ],
  defaultPath: "PIANOHOUSE",
  home: {
    eyebrow: "Trial Premium · Journey thật",
    title: "Always With Me",
    description: "Leo đang tiếp tục L4 như một Premium learner bình thường trong thời gian Trial.",
    cta: "Tiếp tục đàn",
    meta: "L4 · Fundamental · Trial active",
    freshTitle: "L4 recording",
    freshDescription: "Một recording đã được ghi nhận trong Trial và trở thành lịch sử thật của Leo.",
    freshEmoji: "🎹",
  },
  nextTouchpoint: {
    title: "PianoHouse",
    subtitle: "Buổi tiếp theo",
    time: "Thứ Ba · 19:30",
    detail: "Always With Me · fixed slot 19:30–21:00",
  },
  exploreStatus: "premium",
  exploreNote: "Trial learning access đang active; Explore vẫn đọc canonical policy thay vì invent pass counter.",
  collection: [
    { id: "leo-trial-free-1", kind: "Artwork", tier: "FREE", title: "Open Studio postcard", subtitle: "Free Collection", meta: "Trước Trial", emoji: "🎨", owned: true },
    { id: "leo-trial-music-1", kind: "Music", tier: "PREMIUM", title: "Always With Me · L4", subtitle: "Trial recording", meta: "Created during Trial", emoji: "🎹", owned: true, trial: true, featured: true },
    { id: "leo-trial-mark-1", kind: "Milestone", tier: "PREMIUM", title: "Fundamental · L4", subtitle: "Trial milestone", meta: "Real learner history", emoji: "◆", owned: true, trial: true },
    { id: "leo-trial-next-preview", kind: "Milestone", tier: "PREMIUM", title: "Next Premium milestone", subtitle: "Future progression", meta: "Chưa đạt", emoji: "🔒", owned: false },
  ],
};

const leoReenrolled: StudentScenario = {
  key: "leo-reenrolled",
  name: "Leo",
  shortName: "Leo",
  ageLabel: "12 tuổi",
  avatar: "L",
  mode: "ACTIVE_PREMIUM",
  membershipLabel: "Premium · resumed",
  membershipNote: "PianoHouse · tiếp tục từ Trial",
  paths: [
    {
      key: "PIANOHOUSE",
      label: "PianoHouse",
      eyebrow: "Journey resumed",
      summary: "Always With Me · L4 · tiếp tục",
      package: {
        start: "16/08/2026",
        end: "08/11/2026",
        status: "ACTIVE",
        note: "Premium resumed · tiếp tục canonical Journey đã có · không reset",
      },
    },
  ],
  defaultPath: "PIANOHOUSE",
  home: {
    eyebrow: "Premium đã tiếp tục",
    title: "Tiếp tục Always With Me · L4",
    description: "Leo quay lại đúng Journey đã có. Không tạo learner mới và không bắt đầu lại từ L1.",
    cta: "Tiếp tục đàn",
    meta: "L4 retained continuity · access restored",
    freshTitle: "Lịch sử Trial vẫn ở đây",
    freshDescription: "Recording và milestone đã đạt trong Trial tiếp tục thuộc về Leo sau khi Premium được kích hoạt.",
    freshEmoji: "↗",
  },
  nextTouchpoint: {
    title: "PianoHouse",
    subtitle: "Buổi tiếp theo",
    time: "Thứ Ba · 19:30",
    detail: "Always With Me · tiếp tục từ L4 · fixed slot",
  },
  exploreStatus: "premium",
  exploreNote: "Premium learning access đã active trở lại; Explore vẫn theo entitlement policy canonical hiện hành.",
  collection: [
    { id: "leo-resumed-free-1", kind: "Artwork", tier: "FREE", title: "Open Studio postcard", subtitle: "Free Collection", meta: "Retained", emoji: "🎨", owned: true },
    { id: "leo-resumed-music-1", kind: "Music", tier: "PREMIUM", title: "Always With Me · L4", subtitle: "Carried from Trial", meta: "Student-owned history", emoji: "🎹", owned: true, featured: true },
    { id: "leo-resumed-mark-1", kind: "Milestone", tier: "PREMIUM", title: "Fundamental · L4", subtitle: "Achievement retained", meta: "Carried forward", emoji: "◆", owned: true },
    { id: "leo-resumed-next-preview", kind: "Milestone", tier: "PREMIUM", title: "Next Premium milestone", subtitle: "Future progression", meta: "Journey active · chưa đạt", emoji: "🔒", owned: false },
  ],
};

function ensureLifecycleScenario(scenario: StudentScenario, where: "before-expired" | "after-expired") {
  if (scenarios.some((candidate) => candidate.key === scenario.key)) return;
  const expiredIndex = scenarios.findIndex((candidate) => candidate.key === "leo-expired");
  if (expiredIndex < 0) {
    scenarios.push(scenario);
    return;
  }
  scenarios.splice(where === "before-expired" ? expiredIndex : expiredIndex + 1, 0, scenario);
}

ensureLifecycleScenario(leoTrial, "before-expired");
ensureLifecycleScenario(leoReenrolled, "after-expired");

function surfaceFromButton(text: string): AppSurface | null {
  const normalized = text.trim();
  if (normalized === "Home" || normalized.startsWith("Home")) return "home";
  if (normalized === "Journey" || normalized.startsWith("Journey")) return "journey";
  if (normalized === "Collection" || normalized.startsWith("Collection")) return "collection";
  if (normalized === "Explore" || normalized.startsWith("Explore")) return "explore";
  return null;
}

function lifecycleFromScenario(key: string): LifecycleState | null {
  if (key === "leo-trial") return "TRIAL";
  if (key === "leo-expired") return "EXPIRED";
  if (key === "leo-reenrolled") return "REENROLLED";
  return null;
}

function lifecycleCopy(state: LifecycleState, surface: AppSurface) {
  if (state === "TRIAL") {
    if (surface === "journey") return { title: "Trial dùng Journey thật", body: "Leo đang ở L4. Progress, Evidence và Achievement hợp lệ trong Trial là learner history thật — không phải demo state." };
    if (surface === "collection") return { title: "Những gì đã tạo trong Trial có thể trở thành owned history", body: "Trial badge chỉ giải thích nguồn gốc access. Nó không có nghĩa nội dung đã sở hữu sẽ bị xóa khi Trial kết thúc." };
    if (surface === "explore") return { title: "Trial learning access và Explore là hai lớp riêng", body: "Explore vẫn đọc Core entitlement/eligibility; Piner không invent số pass chỉ vì learner đang Trial." };
    return { title: "Trial là Premium thật trong thời gian giới hạn", body: "Home vẫn ưu tiên Path continuation và physical touchpoint. Trial timing chỉ là Parent-readable notice, không biến Home thành sales page." };
  }

  if (state === "EXPIRED") {
    if (surface === "journey") return { title: "Journey bị đóng băng, không bị reset", body: "L4 và lịch sử đã đạt vẫn hiển thị. Progression mới dừng cho đến khi learning access được khôi phục." };
    if (surface === "collection") return { title: "Owned history vẫn mở", body: "Recording, milestone và Artifact đã vested vẫn thuộc về Leo. Future/unowned Premium outcome tiếp tục locked." };
    if (surface === "explore") return { title: "Expired Premium không xóa Free Explore", body: "Leo vẫn có thể quay lại bằng Open Studio nếu Core cho biết Free eligibility hiện hợp lệ." };
    return { title: "Access hết hạn, learner identity vẫn nguyên", body: "Home foreground retained value và route quay lại. Không tạo lại Student, không reset Journey, không thu hồi Achievement." };
  }

  if (surface === "journey") return { title: "Journey tiếp tục từ L4", body: "Re-enroll phục hồi access trên cùng Student + Path continuity. Không bắt đầu lại từ L1 và không copy history sang learner mới." };
  if (surface === "collection") return { title: "Collection đi xuyên qua subscription boundary", body: "Recording/milestone từ Trial vẫn là cùng owned history. Re-enroll chỉ mở access mới; không cần re-award những gì đã có." };
  if (surface === "explore") return { title: "Premium active trở lại", body: "Learning access đã phục hồi; Explore vẫn tuân canonical entitlement policy và không suy diễn unlimited/pass quantity." };
  return { title: "Premium resumed · continuity restored", body: "Home quay lại Path continuation. Leo tiếp tục Always With Me · L4 với lịch sử Trial còn nguyên." };
}

export default function PinerPrototypeV12() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [surface, setSurface] = useState<AppSurface>("home");
  const [scenarioKey, setScenarioKey] = useState("minh-premium");
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [collectionDetail, setCollectionDetail] = useState<LifecycleCollectionDetail | null>(null);

  const lifecycle = lifecycleFromScenario(scenarioKey);

  useEffect(() => {
    const nav = rootRef.current?.querySelector("nav");
    const screen = nav?.previousElementSibling;
    setPortalTarget(screen instanceof HTMLElement ? screen : null);
    const select = rootRef.current?.querySelector<HTMLSelectElement>("#scenario");
    if (select) setScenarioKey(select.value);
  }, []);

  function switchScenario(key: string) {
    const select = rootRef.current?.querySelector<HTMLSelectElement>("#scenario");
    if (!select) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (setter) setter.call(select, key);
    else select.value = key;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    setScenarioKey(key);
    setSurface("home");
    setResumeOpen(false);
    setCollectionDetail(null);
  }

  function autoUnlockPracticeForActiveLifecycle() {
    window.setTimeout(() => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
      const premiumToggle = buttons.find((button) => button.textContent?.trim() === "Premium" && button.parentElement?.textContent?.includes("Prototype access"));
      premiumToggle?.click();
    }, 30);
  }

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const button = target.closest("button") as HTMLButtonElement | null;
    if (!button) return;
    const text = button.textContent ?? "";

    const nextSurface = surfaceFromButton(text);
    if (nextSurface) setSurface(nextSurface);

    if (scenarioKey === "leo-expired" && text.includes("Tiếp tục với Premium")) {
      event.preventDefault();
      event.stopPropagation();
      setResumeOpen(true);
      return;
    }

    if ((scenarioKey === "leo-trial" || scenarioKey === "leo-reenrolled") && text.includes("Founder · published")) {
      autoUnlockPracticeForActiveLifecycle();
    }

    if (surface !== "collection" || !lifecycle) return;

    if (text.includes("Always With Me · L4")) {
      event.preventDefault();
      event.stopPropagation();
      setCollectionDetail({ kind: "MUSIC", state: lifecycle });
      return;
    }

    if (text.includes("Fundamental · L4")) {
      event.preventDefault();
      event.stopPropagation();
      setCollectionDetail({ kind: "MILESTONE", state: lifecycle });
    }
  }

  function handleChangeCapture(event: FormEvent<HTMLDivElement>) {
    const target = event.target as HTMLSelectElement;
    if (target.id !== "scenario") return;
    setScenarioKey(target.value);
    setSurface("home");
    setResumeOpen(false);
    setCollectionDetail(null);
  }

  return (
    <div ref={rootRef} className={v12.v12Root} onClickCapture={handleClickCapture} onChangeCapture={handleChangeCapture}>
      <PinerPrototypeV11 />

      <aside className={v12.lifecycleLab}>
        <span>V12 · LIFECYCLE LAB</span>
        <strong>Leo · PianoHouse</strong>
        <div>
          <button type="button" className={scenarioKey === "leo-trial" ? v12.labActive : ""} onClick={() => switchScenario("leo-trial")}>Trial</button>
          <button type="button" className={scenarioKey === "leo-expired" ? v12.labActive : ""} onClick={() => switchScenario("leo-expired")}>Expired</button>
          <button type="button" className={scenarioKey === "leo-reenrolled" ? v12.labActive : ""} onClick={() => switchScenario("leo-reenrolled")}>Re-enrolled</button>
        </div>
        <small>Cùng một learner continuity · 3 access states.</small>
      </aside>

      {portalTarget && lifecycle && createPortal(
        <LifecycleBanner
          state={lifecycle}
          surface={surface}
          onExpire={() => switchScenario("leo-expired")}
          onResume={() => setResumeOpen(true)}
        />,
        portalTarget,
      )}

      {resumeOpen && <ResumePremiumModal onClose={() => setResumeOpen(false)} onResume={() => switchScenario("leo-reenrolled")} />}
      {collectionDetail && <LifecycleCollectionModal detail={collectionDetail} onClose={() => setCollectionDetail(null)} />}
    </div>
  );
}

function LifecycleBanner({ state, surface, onExpire, onResume }: {
  state: LifecycleState;
  surface: AppSurface;
  onExpire: () => void;
  onResume: () => void;
}) {
  const copy = lifecycleCopy(state, surface);
  return (
    <section className={`${v12.lifecycleBanner} ${state === "TRIAL" ? v12.bannerTrial : state === "EXPIRED" ? v12.bannerExpired : v12.bannerResumed}`}>
      <div className={v12.lifecycleMark}>{state === "TRIAL" ? "T" : state === "EXPIRED" ? "×" : "✓"}</div>
      <div className={v12.lifecycleCopy}>
        <span>{state === "TRIAL" ? "TRIAL PREMIUM · ACTIVE" : state === "EXPIRED" ? "TRIAL · EXPIRED" : "PREMIUM · RESUMED"}</span>
        <strong>{copy.title}</strong>
        <p>{copy.body}</p>
      </div>
      <div className={v12.lifecycleActions}>
        {state === "TRIAL" && <button type="button" onClick={onExpire}>Mô phỏng hết Trial →</button>}
        {state === "EXPIRED" && <button type="button" onClick={onResume}>Tiếp tục Premium →</button>}
        {state === "REENROLLED" && <span>Không reset Journey</span>}
      </div>
    </section>
  );
}

function ResumePremiumModal({ onClose, onResume }: { onClose: () => void; onResume: () => void }) {
  return (
    <div className={v12.modalBackdrop} onMouseDown={onClose}>
      <section className={v12.resumeModal} onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span>PREMIUM CONTINUATION</span><h2>Tiếp tục Journey của Leo</h2></div><button type="button" onClick={onClose}>×</button></header>
        <p className={v12.resumeLead}>Re-enroll phục hồi learning access trên cùng learner history. Không tạo lại Student và không reset progress.</p>
        <div className={v12.resumeFacts}>
          <span><small>Student</small><strong>Leo · giữ nguyên</strong></span>
          <span><small>Journey</small><strong>Always With Me · L4</strong></span>
          <span><small>Collection</small><strong>Owned history giữ nguyên</strong></span>
          <span><small>Practice</small><strong>Normal access theo unlock rule</strong></span>
        </div>
        <div className={v12.resumeDoctrine}><strong>Access restored ≠ history recreated</strong><p>Subscription/access mới chỉ mở lại quyền tiếp tục. Achievement, recording và Artifact đã sở hữu không được re-award hoặc duplicate.</p></div>
        <button type="button" className={v12.resumePrimary} onClick={onResume}>Mô phỏng kích hoạt Premium →</button>
        <small className={v12.billingNote}>Prototype không mô phỏng pricing, checkout hoặc billing vì commercial/payment policy chưa được chốt.</small>
      </section>
    </div>
  );
}

function LifecycleCollectionModal({ detail, onClose }: { detail: LifecycleCollectionDetail; onClose: () => void }) {
  const trial = detail.state === "TRIAL";
  const expired = detail.state === "EXPIRED";
  const title = detail.kind === "MUSIC" ? "Always With Me · L4" : "Fundamental · L4";
  const kind = detail.kind === "MUSIC" ? "Music" : "Milestone";

  const accessLabel = trial ? "TRIAL · OPEN" : expired ? "RETAINED · OPEN" : "OWNED · OPEN";
  const ownership = trial
    ? "Được tạo/đạt trong Trial · real learner history"
    : expired
      ? "Historical ownership retained sau khi access hết hạn"
      : "Carried forward sau re-enroll · không duplicate";

  return (
    <div className={v12.modalBackdrop} onMouseDown={onClose}>
      <section className={v12.collectionModal} onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span>{kind} · LIFECYCLE VIEW</span><h2>{title}</h2><small>Leo · PianoHouse</small></div><button type="button" onClick={onClose}>×</button></header>
        <div className={v12.ownershipState}><strong>{ownership}</strong><p>{expired ? "Current Premium access đã hết nhưng ownership đã vested không bị thu hồi." : trial ? "Nếu Trial kết thúc, item đã vested vẫn ở lại; chỉ access/progression mới thay đổi." : "Re-enroll nối tiếp cùng owned history thay vì tạo một bản copy mới."}</p></div>
        <div className={v12.lifecycleMediaList}>
          <article><span>{detail.kind === "MUSIC" ? "▶" : "◆"}</span><div><strong>{detail.kind === "MUSIC" ? "L4 recording" : "L4 milestone"}</strong><small>{accessLabel}</small><p>{detail.kind === "MUSIC" ? "Learner-facing recording đã được ghi nhận." : "Achievement projection đã đạt."}</p></div></article>
          {detail.kind === "MUSIC" && <article><span>▣</span><div><strong>Performance context</strong><small>{accessLabel}</small><p>Cùng outcome/history; access state thay đổi nhưng identity của item không đổi.</p></div></article>}
          <article className={v12.futureMedia}><span>🔒</span><div><strong>Future L5 outcome</strong><small>CHƯA SỞ HỮU</small><p>{detail.state === "REENROLLED" ? "Journey đã active lại nhưng future outcome vẫn phải được thực sự đạt/tạo; re-enroll không auto-award." : "Future/unowned content khác với historical ownership đã vested."}</p></div></article>
        </div>
        <button type="button" className={v12.closeButton} onClick={onClose}>Đóng</button>
      </section>
    </div>
  );
}
