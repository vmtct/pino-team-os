"use client";

import { FormEvent, MouseEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PinerPrototypeV16 from "./PinerPrototypeV16";
import { scenarios, type StudentScenario } from "./fixtures-v2";
import v12 from "./piner-prototype-v12.module.css";
import v17 from "./piner-prototype-v17.module.css";

type Surface = "home" | "journey" | "collection" | "explore";

const ATTRITION_KEY = "leo-attrition";

const leoAttrition: StudentScenario = {
  key: ATTRITION_KEY,
  name: "Leo",
  shortName: "Leo",
  ageLabel: "12 tuổi",
  avatar: "L",
  mode: "EXPIRED_PREMIUM",
  membershipLabel: "Premium đã ngưng",
  membershipNote: "PianoHouse · không tiếp tục gói mới",
  paths: [
    {
      key: "PIANOHOUSE",
      label: "PianoHouse",
      eyebrow: "Hành trình được giữ lại",
      summary: "Always With Me · L4",
      package: {
        start: "18/05/2026",
        end: "09/08/2026",
        status: "EXPIRED",
        note: "Gói Premium 12 tuần đã kết thúc · gia đình chưa tiếp tục gói mới",
      },
    },
  ],
  defaultPath: "PIANOHOUSE",
  home: {
    eyebrow: "Premium đã kết thúc",
    title: "Always With Me · L4 vẫn được giữ lại",
    description: "Leo từng là thành viên Premium. Hành trình và thành quả đã sở hữu vẫn còn nguyên sau khi gia đình ngưng tiếp tục.",
    cta: "Xem lịch sử đã giữ",
    meta: "Attrition · quyền học mới đã dừng · lịch sử không mất",
    freshTitle: "Lịch sử Premium vẫn ở đây",
    freshDescription: "Recording và cột mốc đã đạt vẫn thuộc về Leo dù gói Premium đã kết thúc.",
    freshEmoji: "◌",
  },
  nextTouchpoint: null,
  exploreStatus: "eligible",
  exploreNote: "Sau attrition, Leo vẫn có thể dùng Open Studio Miễn phí nếu Core xác nhận đủ điều kiện.",
  collection: [
    { id: "leo-attrition-free-1", kind: "Artwork", tier: "FREE", title: "Open Studio postcard", subtitle: "Thành quả Miễn phí", meta: "Được giữ lại", emoji: "🎨", owned: true },
    { id: "leo-attrition-music-1", kind: "Music", tier: "PREMIUM", title: "Always With Me · L4", subtitle: "Premium recording", meta: "Lịch sử đã sở hữu", emoji: "🎹", owned: true, featured: true },
    { id: "leo-attrition-mark-1", kind: "Milestone", tier: "PREMIUM", title: "Fundamental · L4", subtitle: "Achievement retained", meta: "Đã đạt khi Premium còn active", emoji: "◆", owned: true },
    { id: "leo-attrition-next-preview", kind: "Milestone", tier: "PREMIUM", title: "Next Premium milestone", subtitle: "Future progression", meta: "Chưa sở hữu", emoji: "🔒", owned: false },
  ],
};

function ensureAttritionScenario() {
  if (scenarios.some((scenario) => scenario.key === ATTRITION_KEY)) return;
  const reenrolledIndex = scenarios.findIndex((scenario) => scenario.key === "leo-reenrolled");
  if (reenrolledIndex >= 0) scenarios.splice(reenrolledIndex, 0, leoAttrition);
  else scenarios.push(leoAttrition);
}

ensureAttritionScenario();

function surfaceFromText(text: string): Surface | null {
  const normalized = text.trim();
  if (normalized === "Home" || normalized === "Trang chủ") return "home";
  if (normalized === "Journey" || normalized === "Hành trình") return "journey";
  if (normalized === "Collection" || normalized === "Thành quả") return "collection";
  if (normalized === "Explore" || normalized === "Khám phá") return "explore";
  return null;
}

function attritionCopy(surface: Surface) {
  if (surface === "journey") return {
    title: "Premium dừng, Hành trình không reset",
    body: "Attrition là trường hợp gia đình đã dùng Premium nhưng không tiếp tục gói mới. Lịch sử L4 vẫn giữ; progression mới tạm dừng.",
  };
  if (surface === "collection") return {
    title: "Thành quả đã sở hữu vẫn thuộc về Leo",
    body: "Recording, cột mốc và Artifact đã vested không mất khi Premium kết thúc. Nội dung tương lai chưa sở hữu vẫn khóa.",
  };
  if (surface === "explore") return {
    title: "Attrition không đồng nghĩa mất quyền Khám phá Miễn phí",
    body: "Open Studio Miễn phí tiếp tục theo eligibility của Core. Buổi Premium vẫn cần Premium active.",
  };
  return {
    title: "Attrition khác với Trial hết hạn",
    body: "Leo đã từng là thành viên Premium trả phí và hiện ngưng tiếp tục gói mới. Quyền học mới dừng nhưng learner identity và lịch sử vẫn nguyên.",
  };
}

export default function PinerPrototypeV17() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scenarioKey, setScenarioKey] = useState("minh-premium");
  const [surface, setSurface] = useState<Surface>("home");
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const lastScenarioRef = useRef<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const select = root.querySelector<HTMLSelectElement>("#scenario");
        const currentScenario = select?.value ?? scenarioKey;
        if (select && currentScenario !== scenarioKey) setScenarioKey(currentScenario);

        const nav = Array.from(root.querySelectorAll<HTMLElement>("nav")).find((candidate) => candidate.querySelectorAll(":scope > button").length === 4);
        const screen = nav?.previousElementSibling;
        if (screen instanceof HTMLElement) setPortalTarget((current) => current === screen ? current : screen);

        const lab = Array.from(root.querySelectorAll<HTMLElement>("aside")).find((aside) => aside.textContent?.includes("LIFECYCLE LAB"));
        if (lab) {
          lab.dataset.v17LifecycleLab = "true";
          const row = lab.querySelector<HTMLElement>(":scope > div");
          if (row) {
            let attritionButton = row.querySelector<HTMLButtonElement>("[data-v17-attrition='true']");
            if (!attritionButton) {
              attritionButton = document.createElement("button");
              attritionButton.type = "button";
              attritionButton.dataset.v17Attrition = "true";
              attritionButton.textContent = "Attrition";
              attritionButton.addEventListener("click", () => switchScenario(ATTRITION_KEY));
              const reenrolledButton = Array.from(row.querySelectorAll<HTMLButtonElement>("button")).find((button) => /Re-enrolled|Đã tiếp tục Premium/.test(button.textContent ?? ""));
              if (reenrolledButton) row.insertBefore(attritionButton, reenrolledButton);
              else row.appendChild(attritionButton);
            }
            attritionButton.className = currentScenario === ATTRITION_KEY ? v12.labActive : "";
          }
          const note = lab.querySelector<HTMLElement>(":scope > small");
          if (note) note.textContent = "Cùng learner continuity · Trial hết hạn và Attrition là hai nguyên nhân dừng access khác nhau.";
        }

        if (lastScenarioRef.current !== currentScenario) {
          lastScenarioRef.current = currentScenario;
          setSurface("home");
          if (currentScenario === ATTRITION_KEY) {
            window.requestAnimationFrame(() => {
              root.querySelectorAll<HTMLElement>("[data-v16-package-scenario='leo-attrition']").forEach((card) => {
                card.dataset.v16Expanded = "true";
                const toggle = card.querySelector<HTMLButtonElement>("[data-v16-package-toggle='true']");
                toggle?.setAttribute("aria-expanded", "true");
                const chevron = toggle?.lastElementChild;
                if (chevron) chevron.textContent = "⌃";
              });
            });
          }
        }
      });
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [scenarioKey]);

  function switchScenario(key: string) {
    const select = rootRef.current?.querySelector<HTMLSelectElement>("#scenario");
    if (!select) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (setter) setter.call(select, key);
    else select.value = key;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    setScenarioKey(key);
    setSurface("home");
  }

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    const button = (event.target as HTMLElement).closest("button") as HTMLButtonElement | null;
    if (!button) return;
    const nextSurface = surfaceFromText(button.textContent ?? "");
    if (nextSurface && (button.closest("nav") || button.closest("aside"))) setSurface(nextSurface);
  }

  function handleChangeCapture(event: FormEvent<HTMLDivElement>) {
    const target = event.target as HTMLSelectElement;
    if (target.id !== "scenario") return;
    setScenarioKey(target.value);
    setSurface("home");
  }

  const copy = attritionCopy(surface);

  return (
    <div ref={rootRef} className={v17.root} onClickCapture={handleClickCapture} onChangeCapture={handleChangeCapture}>
      <PinerPrototypeV16 />

      {portalTarget && scenarioKey === ATTRITION_KEY && createPortal(
        <section className={v17.attritionBanner}>
          <div className={v17.attritionMark}>A</div>
          <div className={v17.attritionCopy}>
            <span>ATTRITION · PREMIUM ENDED</span>
            <strong>{copy.title}</strong>
            <p>{copy.body}</p>
          </div>
        </section>,
        portalTarget,
      )}
    </div>
  );
}
