"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PinerPrototypeV14 from "./PinerPrototypeV14";
import v15 from "./piner-prototype-v15.module.css";

type Surface = "Home" | "Journey" | "Collection" | "Explore";

type ReviewCase = {
  key: string;
  label: string;
  state: string;
  focus: string;
};

const reviewCases: ReviewCase[] = [
  { key: "an-free", label: "An", state: "Free", focus: "Explore → OS booking + Premium gate" },
  { key: "an-free-confirmed", label: "An", state: "Free · confirmed", focus: "weekly block + retained booking" },
  { key: "han-trial-ac", label: "Hân", state: "Trial · AC", focus: "real Journey + owned Trial media" },
  { key: "leo-trial", label: "Leo", state: "Trial · PH", focus: "multi-booking + active Premium practice" },
  { key: "leo-expired", label: "Leo", state: "Expired", focus: "retained history + upgrade CTA" },
  { key: "leo-reenrolled", label: "Leo", state: "Re-enrolled", focus: "resume L4 + shared 1-booking quota" },
  { key: "minh-premium", label: "Minh", state: "Premium · PH + AC", focus: "multi-Path continuity" },
  { key: "mia-lpa", label: "Mía", state: "Premium · LPA", focus: "scheduled topics + checkpoints" },
  { key: "bo-lpp", label: "Bơ", state: "Premium · LPP", focus: "starter practice + Collection" },
];

const surfaces: Surface[] = ["Home", "Journey", "Collection", "Explore"];

export default function PinerPrototypeV15() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [mountTarget, setMountTarget] = useState<HTMLElement | null>(null);
  const [activeCase, setActiveCase] = useState("an-free");
  const [activeSurface, setActiveSurface] = useState<Surface>("Home");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;

    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const asides = Array.from(root.querySelectorAll<HTMLElement>("aside"));
        const lab = asides.find((aside) => aside.querySelector("h1")?.textContent?.trim() === "Piner Member Space");
        if (!lab) return;

        const badge = Array.from(lab.querySelectorAll<HTMLElement>("div, span")).find((node) => node.textContent?.trim().startsWith("LOCAL PROTOTYPE"));
        if (badge) badge.textContent = "LOCAL PROTOTYPE · V15";

        const intro = lab.querySelector("h1")?.nextElementSibling as HTMLElement | null;
        if (intro?.tagName === "P") {
          intro.textContent = "Holistic review build · kiểm tra continuity, access, booking và learner state xuyên Home / Journey / Collection / Explore.";
        }

        const legacyFocus = Array.from(lab.querySelectorAll<HTMLElement>("strong")).find((node) => node.textContent?.trim() === "V4 review focus");
        const legacyBlock = legacyFocus?.parentElement as HTMLElement | null;
        if (legacyBlock) legacyBlock.style.display = "none";

        let mount = lab.querySelector<HTMLElement>("[data-v15-audit-mount='true']");
        if (!mount) {
          mount = document.createElement("div");
          mount.dataset.v15AuditMount = "true";
          lab.appendChild(mount);
        }
        setMountTarget((current) => current === mount ? current : mount);

        const select = root.querySelector<HTMLSelectElement>("#scenario");
        if (select?.value) setActiveCase(select.value);
      });
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  function switchScenario(key: string) {
    const select = rootRef.current?.querySelector<HTMLSelectElement>("#scenario");
    if (!select) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (setter) setter.call(select, key);
    else select.value = key;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    setActiveCase(key);
    setActiveSurface("Home");
  }

  function jump(surface: Surface) {
    const root = rootRef.current;
    if (!root) return;
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("button"));
    const jumpButton = buttons.find((button) => button.textContent?.trim() === surface && button.closest("aside"));
    const navButton = buttons.find((button) => button.textContent?.trim() === surface && button.closest("nav"));
    (jumpButton ?? navButton)?.click();
    setActiveSurface(surface);
  }

  return (
    <div ref={rootRef}>
      <PinerPrototypeV14 />
      {mountTarget && createPortal(
        <ReviewConsole
          activeCase={activeCase}
          activeSurface={activeSurface}
          onScenario={switchScenario}
          onSurface={jump}
        />,
        mountTarget,
      )}
    </div>
  );
}

function ReviewConsole({ activeCase, activeSurface, onScenario, onSurface }: {
  activeCase: string;
  activeSurface: Surface;
  onScenario: (key: string) => void;
  onSurface: (surface: Surface) => void;
}) {
  const current = reviewCases.find((item) => item.key === activeCase);

  return (
    <section className={v15.console}>
      <div className={v15.consoleHead}>
        <div><span>V15 · HOLISTIC AUDIT</span><strong>Founder review matrix</strong></div>
        <em>{current?.state ?? "Custom scenario"}</em>
      </div>

      <p className={v15.focus}>{current?.focus ?? "Review current Student state across all surfaces."}</p>

      <div className={v15.surfaceRow}>
        {surfaces.map((surface) => (
          <button key={surface} type="button" className={activeSurface === surface ? v15.surfaceActive : ""} onClick={() => onSurface(surface)}>{surface}</button>
        ))}
      </div>

      <div className={v15.caseList}>
        {reviewCases.map((item) => (
          <button key={item.key} type="button" className={activeCase === item.key ? v15.caseActive : ""} onClick={() => onScenario(item.key)}>
            <span>{item.label}</span>
            <strong>{item.state}</strong>
            <small>{item.focus}</small>
          </button>
        ))}
      </div>

      <div className={v15.invariants}>
        <strong>Audit invariants</strong>
        <span>Student context không merge giữa siblings.</span>
        <span>Access có thể hết; achievement/owned history không mất.</span>
        <span>Booking Pending ≠ Confirmed ≠ Attendance.</span>
        <span>Practice submit ≠ auto level-up ≠ auto Collection.</span>
        <span>Trial nhiều booking; Active Premium quota 1 dùng chung OS + Premium Session.</span>
      </div>
    </section>
  );
}
