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
        const headings = Array.from(root.querySelectorAll<HTMLHeadingElement>("h3"));
        const legacyHeading = headings.find((heading) => {
          const text = heading.textContent?.trim();
          return text === "Open Studio gần nhất" || text === "Open Studio sessions · legacy";
        });
        const legacySection = legacyHeading?.closest("section") as HTMLElement | null;
        if (!legacyHeading || !legacySection || !legacySection.parentElement) return;

        // V13 searches by textContent and can temporarily match an ancestor section.
        // Neutralize the exact legacy heading so subsequent observer passes cannot
        // select the entire device/stage as the portal target.
        if (legacyHeading.textContent?.trim() === "Open Studio gần nhất") {
          legacyHeading.dataset.v14MountFix = "true";
          legacyHeading.textContent = "Open Studio sessions · legacy";
        }

        legacySection.style.display = "none";
        legacySection.dataset.v14LegacyExplore = "true";

        // Undo any accidental ancestor hiding from V13. Only the true leaf legacy
        // Explore section should stay hidden; the learner device and bottom nav must remain.
        Array.from(root.querySelectorAll<HTMLElement>("section[data-v13-hidden='true']")).forEach((section) => {
          if (section === legacySection) return;
          section.style.display = "";
        });

        const mounts = Array.from(root.querySelectorAll<HTMLElement>("[data-v13-explore-mount='true']"));
        if (!mounts.length) return;

        // The live React portal mount is the one containing rendered V13 content.
        // A V13 race can leave an older empty mount behind and create a new one beside
        // an ancestor. Always move the live mount back beside the leaf legacy section.
        const liveMount = mounts.find((mount) => mount.childElementCount > 0) ?? mounts[mounts.length - 1];
        if (liveMount.parentElement !== legacySection.parentElement || liveMount.nextElementSibling !== legacySection) {
          legacySection.parentElement.insertBefore(liveMount, legacySection);
        }

        mounts.forEach((mount) => {
          if (mount !== liveMount && mount.childElementCount === 0) mount.remove();
        });
      });
    };

    repairExploreMount();
    const observer = new MutationObserver(repairExploreMount);
    observer.observe(root, { childList: true, subtree: true, characterData: true });

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
