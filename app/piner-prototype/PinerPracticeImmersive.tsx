"use client";

import { useEffect } from "react";

const COLLAPSE_DISTANCE = 150;
const EXPAND_DISTANCE = 82;

type BoundState = {
  lastTop: number;
  progress: number;
  cleanup: () => void;
};

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

export default function PinerPracticeImmersive() {
  useEffect(() => {
    const bound = new Map<HTMLElement, BoundState>();
    let scanFrame = 0;

    function getParts(scroller: HTMLElement) {
      const workspace = scroller.parentElement;
      const shell = scroller.closest<HTMLElement>("[class*='viewerShell']");
      const header = shell?.querySelector<HTMLElement>("[class*='viewerHeader']") ?? null;
      if (!workspace || !shell || !header) return null;

      const tools = workspace.querySelector<HTMLElement>(":scope > [class*='stickyTools']");
      const tabs = workspace.querySelector<HTMLElement>(":scope > [class*='pageTabs']");
      const hint = workspace.querySelector<HTMLElement>(":scope > [class*='viewerHint']");
      const chrome = [tools, tabs, hint].filter((item): item is HTMLElement => Boolean(item));
      if (!chrome.length) return null;

      return { workspace, shell, header, tools, tabs, hint, chrome };
    }

    function bind(scroller: HTMLElement) {
      if (bound.has(scroller)) return;
      const parts = getParts(scroller);
      if (!parts) return;

      const { workspace, shell, header, chrome } = parts;
      const family = header.querySelector<HTMLElement>("[class*='familyBadge']");
      const context = header.querySelector<HTMLElement>("small");
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const heights = new Map<HTMLElement, number>();

      const state: BoundState = {
        lastTop: scroller.scrollTop,
        progress: 0,
        cleanup: () => undefined,
      };

      function measure() {
        chrome.forEach((item) => {
          if (!heights.has(item) || state.progress < 0.02) {
            const oldMaxHeight = item.style.maxHeight;
            const oldHeight = item.style.height;
            item.style.removeProperty("max-height");
            item.style.removeProperty("height");
            const measured = item.getBoundingClientRect().height || item.scrollHeight;
            heights.set(item, measured);
            if (oldMaxHeight) item.style.maxHeight = oldMaxHeight;
            if (oldHeight) item.style.height = oldHeight;
          }
        });
      }

      function apply(next: number) {
        state.progress = clamp(next);
        const progress = state.progress;
        shell.dataset.practiceImmersiveProgress = progress.toFixed(3);
        shell.dataset.practiceImmersive = progress >= 0.96 ? "true" : "false";

        chrome.forEach((item) => {
          const fullHeight = heights.get(item) ?? item.scrollHeight ?? 0;
          const visibleHeight = Math.max(0, fullHeight * (1 - progress));
          item.style.setProperty("height", `${visibleHeight}px`, "important");
          item.style.setProperty("max-height", `${visibleHeight}px`, "important");
          item.style.setProperty("min-height", "0px", "important");
          item.style.setProperty("margin-top", "0px", "important");
          item.style.setProperty("margin-bottom", "0px", "important");
          item.style.overflow = "hidden";
          item.style.opacity = String(Math.max(0, 1 - progress * 1.08));
          item.style.transform = `translateY(${-Math.min(fullHeight, fullHeight * progress)}px)`;
          item.style.transformOrigin = "top";
          item.style.transition = reducedMotion
            ? "none"
            : "height 120ms cubic-bezier(0.22,1,0.36,1), max-height 120ms cubic-bezier(0.22,1,0.36,1), transform 120ms cubic-bezier(0.22,1,0.36,1), opacity 90ms ease-out";
          item.style.pointerEvents = progress >= 0.94 ? "none" : "";
          if (progress >= 0.94) item.setAttribute("aria-hidden", "true");
          else item.removeAttribute("aria-hidden");
        });

        workspace.style.setProperty("gap", `${Math.max(2, 9 * (1 - progress))}px`, "important");
        workspace.style.transition = reducedMotion ? "none" : "gap 120ms ease-out";

        const headerProgress = clamp((progress - 0.58) / 0.42);
        const headerHeight = 72 - 18 * headerProgress;
        header.style.setProperty("min-height", `${headerHeight}px`, "important");
        header.style.setProperty("height", `${headerHeight}px`, "important");
        header.style.setProperty("padding", `${13 - 5 * headerProgress}px ${18 - 2 * headerProgress}px`, "important");
        header.style.transition = reducedMotion
          ? "none"
          : "height 140ms cubic-bezier(0.22,1,0.36,1), min-height 140ms cubic-bezier(0.22,1,0.36,1), padding 140ms cubic-bezier(0.22,1,0.36,1)";

        if (family) {
          family.style.opacity = String(1 - headerProgress);
          family.style.transform = `translateY(${-6 * headerProgress}px)`;
          family.style.transition = reducedMotion ? "none" : "opacity 100ms ease, transform 120ms ease";
          family.style.pointerEvents = headerProgress > 0.8 ? "none" : "";
          family.style.setProperty("width", headerProgress >= 0.98 ? "0px" : "", "important");
          family.style.setProperty("padding-inline", headerProgress >= 0.98 ? "0px" : "", "important");
          family.style.overflow = headerProgress >= 0.98 ? "hidden" : "";
        }
        if (context) {
          context.style.opacity = String(1 - headerProgress);
          context.style.transform = `translateY(${-4 * headerProgress}px)`;
          context.style.transition = reducedMotion ? "none" : "opacity 100ms ease, transform 120ms ease";
          context.style.setProperty("height", `${Math.max(0, 14 * (1 - headerProgress))}px`, "important");
          context.style.overflow = "hidden";
        }
      }

      function revealFromUpwardGesture(amount: number) {
        if (state.progress <= 0) return;
        apply(state.progress - Math.abs(amount) / EXPAND_DISTANCE);
      }

      function onScroll() {
        const currentTop = scroller.scrollTop;
        const delta = currentTop - state.lastTop;
        state.lastTop = currentTop;

        if (currentTop <= 2) {
          apply(0);
          return;
        }

        if (delta > 0.25) {
          const positionDriven = clamp(currentTop / COLLAPSE_DISTANCE);
          const gestureDriven = clamp(state.progress + delta / COLLAPSE_DISTANCE);
          apply(Math.max(positionDriven, gestureDriven));
        } else if (delta < -0.25) {
          revealFromUpwardGesture(delta);
        }
      }

      function onWheel(event: WheelEvent) {
        if (event.deltaY < -1) revealFromUpwardGesture(event.deltaY * 0.55);
      }

      function onResize() {
        heights.clear();
        chrome.forEach((item) => {
          item.style.removeProperty("height");
          item.style.removeProperty("max-height");
          item.style.removeProperty("min-height");
        });
        requestAnimationFrame(() => {
          measure();
          apply(state.progress);
        });
      }

      requestAnimationFrame(() => {
        measure();
        // If the controller attaches after the user has already scrolled, immediately
        // reconcile the chrome with the actual sheet position.
        apply(clamp(scroller.scrollTop / COLLAPSE_DISTANCE));
      });

      scroller.addEventListener("scroll", onScroll, { passive: true });
      scroller.addEventListener("wheel", onWheel, { passive: true });
      window.addEventListener("resize", onResize);

      state.cleanup = () => {
        scroller.removeEventListener("scroll", onScroll);
        scroller.removeEventListener("wheel", onWheel);
        window.removeEventListener("resize", onResize);
        chrome.forEach((item) => {
          ["height", "max-height", "min-height", "margin-top", "margin-bottom", "overflow", "opacity", "transform", "transform-origin", "transition", "pointer-events"].forEach((property) => item.style.removeProperty(property));
          item.removeAttribute("aria-hidden");
        });
        workspace.style.removeProperty("gap");
        workspace.style.removeProperty("transition");
        ["min-height", "height", "padding", "transition"].forEach((property) => header.style.removeProperty(property));
        delete shell.dataset.practiceImmersive;
        delete shell.dataset.practiceImmersiveProgress;
        [family, context].forEach((item) => {
          if (!item) return;
          ["opacity", "transform", "transition", "pointer-events", "width", "padding-inline", "overflow", "height"].forEach((property) => item.style.removeProperty(property));
        });
      };

      bound.set(scroller, state);
    }

    function scan() {
      document.querySelectorAll<HTMLElement>("[class*='phraseScroller']").forEach(bind);
      bound.forEach((state, scroller) => {
        if (!scroller.isConnected) {
          state.cleanup();
          bound.delete(scroller);
        }
      });
    }

    // Capture is a second safety net: element scroll events do not bubble, but a
    // capture listener lets us notice a newly mounted/replaced phrase scroller and bind it.
    function onDocumentScroll(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches("[class*='phraseScroller']")) return;
      bind(target);
    }

    const observer = new MutationObserver(() => {
      cancelAnimationFrame(scanFrame);
      scanFrame = requestAnimationFrame(scan);
    });

    const interval = window.setInterval(scan, 250);
    document.addEventListener("scroll", onDocumentScroll, true);
    scan();
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(scanFrame);
      window.clearInterval(interval);
      observer.disconnect();
      document.removeEventListener("scroll", onDocumentScroll, true);
      bound.forEach((state) => state.cleanup());
      bound.clear();
    };
  }, []);

  return null;
}
