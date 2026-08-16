"use client";

import { useEffect, useRef } from "react";
import PinerPrototypeV13 from "./PinerPrototypeV13";

export default function PinerPrototypeV14() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;

    const repairExploreMount = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const mount = root.querySelector<HTMLElement>("[data-v13-explore-mount='true']");
        const hiddenSections = Array.from(root.querySelectorAll<HTMLElement>("section[data-v13-hidden='true']"));
        if (!mount || hiddenSections.length === 0) return;

        const outerHidden = hiddenSections.find((section) => section.querySelector("nav")) ?? hiddenSections[0];
        const legacyHeading = Array.from(outerHidden.querySelectorAll<HTMLHeadingElement>("h3"))
          .find((heading) => heading.textContent?.trim() === "Open Studio gần nhất");
        const legacySection = legacyHeading?.closest("section") as HTMLElement | null;

        if (!legacyHeading || !legacySection || legacySection === outerHidden || !legacySection.parentElement) return;

        // V13 originally matched the first ancestor section whose text contained the heading,
        // which could hide the entire device shell. Rename only the hidden legacy heading so
        // the V13 observer no longer re-selects that ancestor after we move its portal mount.
        if (!legacyHeading.dataset.v14MountFix) {
          legacyHeading.dataset.v14MountFix = "true";
          legacyHeading.textContent = "Open Studio sessions · legacy";
        }

        legacySection.style.display = "none";
        outerHidden.style.display = "";

        if (mount.parentElement !== legacySection.parentElement || mount.nextElementSibling !== legacySection) {
          legacySection.parentElement.insertBefore(mount, legacySection);
        }
      });
    };

    repairExploreMount();
    const observer = new MutationObserver(repairExploreMount);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef}>
      <PinerPrototypeV13 />
    </div>
  );
}
