"use client";

import { useEffect } from "react";

const COLLAPSE_DISTANCE = 120;
const EXPAND_DISTANCE = 76;

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

export default function PinerPracticeImmersive() {
  useEffect(() => {
    const cleanups = new Map<HTMLElement, () => void>();
    let scanFrame = 0;

    function bind(scroller: HTMLElement) {
      if (cleanups.has(scroller)) return;

      const workspace = scroller.parentElement;
      const shell = scroller.closest<HTMLElement>("[class*='viewerShell']");
      const header = shell?.querySelector<HTMLElement>("[class*='viewerHeader']") ?? null;
      if (!workspace || !shell || !header) return;

      const tools = workspace.querySelector<HTMLElement>(":scope > [class*='stickyTools']");
      const tabs = workspace.querySelector<HTMLElement>(":scope > [class*='pageTabs']");
      const hint = workspace.querySelector<HTMLElement>(":scope > [class*='viewerHint']");
      const chrome = [tools, tabs, hint].filter((item): item is HTMLElement => Boolean(item));
      if (!chrome.length) return;

      const family = header.querySelector<HTMLElement>("[class*='familyBadge']");
      const context = header.querySelector<HTMLElement>("small");
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const heights = new Map<HTMLElement, number>();
      let progress = 0;
      let lastTop = scroller.scrollTop;
      let compact = false;

      const measure = () => {
        chrome.forEach((item) => {
          if (progress < 0.02) heights.set(item, item.getBoundingClientRect().height || item.scrollHeight);
        });
      };

      const apply = (next: number) => {
        progress = clamp(next);
        measure();

        chrome.forEach((item) => {
          const fullHeight = heights.get(item) ?? item.scrollHeight;
          item.style.height = `${Math.max(0, fullHeight * (1 - progress))}px`;
          item.style.overflow = "hidden";
          item.style.opacity = String(Math.max(0, 1 - progress * 0.9));
          item.style.transform = `translateY(${-Math.min(fullHeight * 0.3, fullHeight * progress)}px)`;
          item.style.transformOrigin = "top";
          item.style.transition = reducedMotion
            ? "none"
            : "height 150ms cubic-bezier(0.22, 1, 0.36, 1), transform 150ms cubic-bezier(0.22, 1, 0.36, 1), opacity 110ms ease-out";
          item.style.pointerEvents = progress >= 0.96 ? "none" : "";
          if (progress >= 0.96) item.setAttribute("aria-hidden", "true");
          else item.removeAttribute("aria-hidden");
        });

        workspace.style.gap = `${Math.max(3, 9 * (1 - progress))}px`;
        workspace.style.transition = reducedMotion ? "none" : "gap 150ms ease-out";

        const nextCompact = progress >= 0.96;
        if (nextCompact !== compact) {
          compact = nextCompact;
          header.dataset.practiceImmersive = compact ? "true" : "false";
          header.style.minHeight = compact ? "54px" : "";
          header.style.padding = compact ? "8px 16px" : "";
          header.style.transition = reducedMotion ? "none" : "min-height 180ms ease, padding 180ms ease";
          if (family) family.style.display = compact ? "none" : "";
          if (context) context.style.display = compact ? "none" : "";
        }
      };

      const onScroll = () => {
        const currentTop = scroller.scrollTop;
        const delta = currentTop - lastTop;
        lastTop = currentTop;

        let next = progress;
        if (currentTop <= 2) next = 0;
        else if (delta > 0.5) next += delta / COLLAPSE_DISTANCE;
        else if (delta < -0.5) next += delta / EXPAND_DISTANCE;

        if (Math.abs(next - progress) > 0.001) apply(next);
      };

      const onResize = () => {
        if (progress < 0.02) {
          chrome.forEach((item) => {
            item.style.height = "";
          });
          requestAnimationFrame(() => {
            heights.clear();
            measure();
            apply(0);
          });
        }
      };

      requestAnimationFrame(() => {
        measure();
        apply(0);
      });
      scroller.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);

      cleanups.set(scroller, () => {
        scroller.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
        chrome.forEach((item) => {
          item.style.removeProperty("height");
          item.style.removeProperty("overflow");
          item.style.removeProperty("opacity");
          item.style.removeProperty("transform");
          item.style.removeProperty("transform-origin");
          item.style.removeProperty("transition");
          item.style.removeProperty("pointer-events");
          item.removeAttribute("aria-hidden");
        });
        workspace.style.removeProperty("gap");
        workspace.style.removeProperty("transition");
        header.style.removeProperty("min-height");
        header.style.removeProperty("padding");
        header.style.removeProperty("transition");
        delete header.dataset.practiceImmersive;
        family?.style.removeProperty("display");
        context?.style.removeProperty("display");
      });
    }

    function scan() {
      document.querySelectorAll<HTMLElement>("[class*='phraseScroller']").forEach(bind);
      cleanups.forEach((cleanup, scroller) => {
        if (!scroller.isConnected) {
          cleanup();
          cleanups.delete(scroller);
        }
      });
    }

    const observer = new MutationObserver(() => {
      cancelAnimationFrame(scanFrame);
      scanFrame = requestAnimationFrame(scan);
    });

    scan();
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(scanFrame);
      observer.disconnect();
      cleanups.forEach((cleanup) => cleanup());
      cleanups.clear();
    };
  }, []);

  return null;
}
