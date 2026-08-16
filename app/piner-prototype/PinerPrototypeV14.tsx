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
        const nav = Array.from(root.querySelectorAll<HTMLElement>("nav")).find((candidate) => {
          return candidate.querySelectorAll(":scope > button").length === 4;
        });
        const device = nav?.parentElement instanceof HTMLElement ? nav.parentElement : null;
        if (!device) return;

        const headings = Array.from(device.querySelectorAll<HTMLHeadingElement>("h3"));
        const legacyHeading = headings.find((heading) => {
          const text = heading.textContent?.trim();
          return text === "Open Studio gần nhất" || text === "Open Studio sessions · legacy";
        });

        const legacyByContent = Array.from(device.querySelectorAll<HTMLElement>("section")).find((section) => {
          const text = section.textContent ?? "";
          return text.includes("Màu nước & những sinh vật nhỏ")
            && text.includes("Giai điệu quen thuộc")
            && text.includes("Hình khối biết kể chuyện");
        });

        const legacySection = (legacyHeading?.closest("section") as HTMLElement | null) ?? legacyByContent ?? null;
        if (!legacySection || !legacySection.parentElement) return;

        // Stop V13's broad textContent matcher from ever selecting an ancestor again.
        if (legacyHeading && legacyHeading.textContent?.trim() === "Open Studio gần nhất") {
          legacyHeading.dataset.v14MountFix = "true";
          legacyHeading.textContent = "Open Studio sessions · legacy";
        }

        // V13 may already have hidden the whole device-stage ancestor. Restore only
        // the ancestor chain that contains the real learner device.
        let ancestor: HTMLElement | null = legacySection.parentElement;
        while (ancestor) {
          if (ancestor !== legacySection) {
            ancestor.style.removeProperty("display");
            if (ancestor.dataset.v13Hidden === "true") delete ancestor.dataset.v13Hidden;
          }
          if (ancestor === device || ancestor === root) break;
          ancestor = ancestor.parentElement;
        }

        legacySection.style.display = "none";
        legacySection.dataset.v14LegacyExplore = "true";

        const mounts = Array.from(root.querySelectorAll<HTMLElement>("[data-v13-explore-mount='true']"));
        if (!mounts.length) return;

        // Pick the React portal mount by rendered content, not DOM position. When V13
        // inserts the mount beside deviceStage it becomes an accidental third grid item.
        const liveMount = mounts.find((mount) => {
          const text = mount.textContent ?? "";
          return text.includes("Open Studio & Premium Sessions")
            || text.includes("Khám Phá & Premium")
            || mount.querySelectorAll("article").length >= 5;
        }) ?? mounts.find((mount) => mount.childElementCount > 0) ?? mounts[mounts.length - 1];

        const targetParent = legacySection.parentElement;
        if (liveMount.parentElement !== targetParent || liveMount.nextElementSibling !== legacySection) {
          targetParent.insertBefore(liveMount, legacySection);
        }
        liveMount.dataset.v14PortalRepaired = "true";
        liveMount.style.removeProperty("display");
        liveMount.style.removeProperty("width");
        liveMount.style.removeProperty("grid-column");

        mounts.forEach((mount) => {
          if (mount === liveMount) return;
          if (mount.childElementCount === 0) mount.remove();
          else mount.style.display = "none";
        });

        // Defensive cleanup: no V13 portal mount may remain as a sibling of the
        // deviceStage/main grid after repair.
        const deviceStage = device.parentElement;
        const main = deviceStage?.parentElement;
        if (main) {
          Array.from(main.children).forEach((child) => {
            if (!(child instanceof HTMLElement)) return;
            if (child.dataset.v13ExploreMount === "true" && child !== liveMount) child.style.display = "none";
          });
        }
      });
    };

    repairExploreMount();
    const observer = new MutationObserver(repairExploreMount);
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["style"] });
    const interval = window.setInterval(repairExploreMount, 250);

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef}>
      <PinerPrototypeV13 />
    </div>
  );
}
