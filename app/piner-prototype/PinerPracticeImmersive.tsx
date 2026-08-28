"use client";

import { useEffect } from "react";

const COLLAPSE_DISTANCE = 150;
const EXPAND_DISTANCE = 82;
const UP_INTENT_THRESHOLD = 18;
const INTENT_WINDOW_MS = 260;
const SETTLE_DELAY_MS = 110;
const PARTIAL_SETTLE_THRESHOLD = 0.18;
const COMPACT_HEADER_HEIGHT = 54;
const COLLAPSED_WORKSPACE_GAP = 2;
const MIN_FOCUS_VIEWPORT = 260;

type ScrollIntent = "idle" | "down" | "up";

type BoundState = {
  lastTop: number;
  progress: number;
  intent: ScrollIntent;
  lastIntentAt: number;
  upwardIntent: number;
  syncFocus: () => void;
  cleanup: () => void;
};

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function numberStyle(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

      return { workspace, shell, header, chrome };
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
      let settleTimer = 0;
      let touchY: number | null = null;
      let lastFocusHeight = 0;

      const state: BoundState = {
        lastTop: scroller.scrollTop,
        progress: 0,
        intent: "idle",
        lastIntentAt: 0,
        upwardIntent: 0,
        syncFocus: () => undefined,
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

      function targetFocusHeight() {
        const workspaceStyle = window.getComputedStyle(workspace);
        const paddingY = numberStyle(workspaceStyle.paddingTop) + numberStyle(workspaceStyle.paddingBottom);
        const nonChrome = Array.from(workspace.children).filter((child): child is HTMLElement => {
          return child instanceof HTMLElement && child !== scroller && !chrome.includes(child);
        });
        const reservedHeight = nonChrome.reduce((total, child) => total + child.getBoundingClientRect().height, 0);
        const gapCount = Math.max(0, workspace.children.length - 1);
        const collapsedGapHeight = gapCount * COLLAPSED_WORKSPACE_GAP;
        const available = shell.clientHeight
          - COMPACT_HEADER_HEIGHT
          - paddingY
          - reservedHeight
          - collapsedGapHeight;
        return Math.max(MIN_FOCUS_VIEWPORT, Math.round(available));
      }

      function syncFocusSlots() {
        if (!scroller.isConnected) return;
        const focusHeight = targetFocusHeight();
        const phrases = Array.from(scroller.querySelectorAll<HTMLElement>(":scope > [class*='phrasePair']"));
        if (!phrases.length) return;

        scroller.dataset.practiceFocusScroller = "true";
        if (Math.abs(focusHeight - lastFocusHeight) > 1) {
          scroller.style.setProperty("--practice-focus-height", `${focusHeight}px`);
          lastFocusHeight = focusHeight;
        }

        phrases.forEach((phrase) => {
          phrase.dataset.practiceFocusPhrase = "true";
          const naturalHeight = phrase.getBoundingClientRect().height;
          // Keep the card at its natural height and use the remaining viewport as quiet space.
          // When a phrase is snapped to the top, the next phrase therefore starts fully outside
          // the maximum collapsed practice viewport instead of peeking into the learner's view.
          const spacer = Math.max(10, Math.ceil(focusHeight - naturalHeight));
          const nextMargin = `${spacer}px`;
          if (phrase.style.marginBottom !== nextMargin) {
            phrase.style.setProperty("margin-bottom", nextMargin, "important");
          }
        });
      }

      state.syncFocus = syncFocusSlots;

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
            : "height 150ms cubic-bezier(0.22,1,0.36,1), max-height 150ms cubic-bezier(0.22,1,0.36,1), transform 150ms cubic-bezier(0.22,1,0.36,1), opacity 100ms ease-out";
          item.style.pointerEvents = progress >= 0.94 ? "none" : "";
          if (progress >= 0.94) item.setAttribute("aria-hidden", "true");
          else item.removeAttribute("aria-hidden");
        });

        workspace.style.setProperty("gap", `${Math.max(COLLAPSED_WORKSPACE_GAP, 9 * (1 - progress))}px`, "important");
        workspace.style.transition = reducedMotion ? "none" : "gap 150ms ease-out";

        const headerProgress = clamp((progress - 0.58) / 0.42);
        const headerHeight = 72 - 18 * headerProgress;
        header.style.setProperty("min-height", `${headerHeight}px`, "important");
        header.style.setProperty("height", `${headerHeight}px`, "important");
        header.style.setProperty("padding", `${13 - 5 * headerProgress}px ${18 - 2 * headerProgress}px`, "important");
        header.style.transition = reducedMotion
          ? "none"
          : "height 170ms cubic-bezier(0.22,1,0.36,1), min-height 170ms cubic-bezier(0.22,1,0.36,1), padding 170ms cubic-bezier(0.22,1,0.36,1)";

        if (family) {
          family.style.opacity = String(1 - headerProgress);
          family.style.transform = `translateY(${-6 * headerProgress}px)`;
          family.style.transition = reducedMotion ? "none" : "opacity 110ms ease, transform 140ms ease";
          family.style.pointerEvents = headerProgress > 0.8 ? "none" : "";
          family.style.setProperty("width", headerProgress >= 0.98 ? "0px" : "", "important");
          family.style.setProperty("padding-inline", headerProgress >= 0.98 ? "0px" : "", "important");
          family.style.overflow = headerProgress >= 0.98 ? "hidden" : "";
        }
        if (context) {
          context.style.opacity = String(1 - headerProgress);
          context.style.transform = `translateY(${-4 * headerProgress}px)`;
          context.style.transition = reducedMotion ? "none" : "opacity 110ms ease, transform 140ms ease";
          context.style.setProperty("height", `${Math.max(0, 14 * (1 - headerProgress))}px`, "important");
          context.style.overflow = "hidden";
        }
      }

      function clearSettle() {
        if (!settleTimer) return;
        window.clearTimeout(settleTimer);
        settleTimer = 0;
      }

      function settle(direction: "down" | "up") {
        clearSettle();
        settleTimer = window.setTimeout(() => {
          settleTimer = 0;
          if (direction === "down") {
            if (state.progress >= PARTIAL_SETTLE_THRESHOLD) apply(1);
          } else if (state.progress < 0.94) {
            apply(0);
          }
          state.intent = "idle";
          state.upwardIntent = 0;
          window.setTimeout(() => {
            state.lastTop = scroller.scrollTop;
          }, reducedMotion ? 0 : 190);
        }, SETTLE_DELAY_MS);
      }

      function noteDownIntent() {
        state.intent = "down";
        state.lastIntentAt = performance.now();
        state.upwardIntent = 0;
        settle("down");
      }

      function noteUpIntent(amount: number) {
        state.intent = "up";
        state.lastIntentAt = performance.now();
        state.upwardIntent += Math.abs(amount);
        clearSettle();

        if (state.upwardIntent <= UP_INTENT_THRESHOLD) return;
        const effective = Math.abs(amount) + Math.max(0, state.upwardIntent - UP_INTENT_THRESHOLD) * 0.25;
        apply(state.progress - effective / EXPAND_DISTANCE);
        settle("up");
      }

      function onScroll() {
        const currentTop = scroller.scrollTop;
        const delta = currentTop - state.lastTop;
        state.lastTop = currentTop;

        if (currentTop <= 2) {
          clearSettle();
          state.intent = "idle";
          state.upwardIntent = 0;
          apply(0);
          return;
        }

        if (delta > 0.25) {
          noteDownIntent();
          const positionDriven = clamp(currentTop / COLLAPSE_DISTANCE);
          const gestureDriven = clamp(state.progress + delta / COLLAPSE_DISTANCE);
          apply(Math.max(positionDriven, gestureDriven));
          return;
        }

        if (delta < -0.25) {
          const recentExplicitUp = state.intent === "up" && performance.now() - state.lastIntentAt < INTENT_WINDOW_MS;
          if (recentExplicitUp) {
            noteUpIntent(delta);
          }
        }
      }

      function onWheel(event: WheelEvent) {
        if (event.deltaY > 1) {
          noteDownIntent();
        } else if (event.deltaY < -1) {
          noteUpIntent(event.deltaY * 0.58);
        }
      }

      function onTouchStart(event: TouchEvent) {
        touchY = event.touches[0]?.clientY ?? null;
        state.upwardIntent = 0;
      }

      function onTouchMove(event: TouchEvent) {
        const nextY = event.touches[0]?.clientY;
        if (touchY == null || nextY == null) return;
        const fingerDelta = nextY - touchY;
        touchY = nextY;
        if (fingerDelta < -1) noteDownIntent();
        else if (fingerDelta > 1) noteUpIntent(fingerDelta);
      }

      function onTouchEnd() {
        touchY = null;
        if (state.intent === "down") settle("down");
        else if (state.intent === "up") settle("up");
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
          syncFocusSlots();
          apply(state.progress);
          state.lastTop = scroller.scrollTop;
        });
      }

      requestAnimationFrame(() => {
        measure();
        syncFocusSlots();
        apply(clamp(scroller.scrollTop / COLLAPSE_DISTANCE));
        state.lastTop = scroller.scrollTop;
      });

      scroller.addEventListener("scroll", onScroll, { passive: true });
      scroller.addEventListener("wheel", onWheel, { passive: true });
      scroller.addEventListener("touchstart", onTouchStart, { passive: true });
      scroller.addEventListener("touchmove", onTouchMove, { passive: true });
      scroller.addEventListener("touchend", onTouchEnd, { passive: true });
      window.addEventListener("resize", onResize);

      state.cleanup = () => {
        clearSettle();
        scroller.removeEventListener("scroll", onScroll);
        scroller.removeEventListener("wheel", onWheel);
        scroller.removeEventListener("touchstart", onTouchStart);
        scroller.removeEventListener("touchmove", onTouchMove);
        scroller.removeEventListener("touchend", onTouchEnd);
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
        delete scroller.dataset.practiceFocusScroller;
        scroller.style.removeProperty("--practice-focus-height");
        scroller.querySelectorAll<HTMLElement>("[data-practice-focus-phrase='true']").forEach((phrase) => {
          delete phrase.dataset.practiceFocusPhrase;
          phrase.style.removeProperty("margin-bottom");
        });
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
          return;
        }
        state.syncFocus();
      });
    }

    function onDocumentScroll(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches("[class*='phraseScroller']")) return;
      bind(target);
    }

    const observer = new MutationObserver(() => {
      cancelAnimationFrame(scanFrame);
      scanFrame = requestAnimationFrame(scan);
    });

    document.addEventListener("scroll", onDocumentScroll, true);
    scan();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelAnimationFrame(scanFrame);
      observer.disconnect();
      document.removeEventListener("scroll", onDocumentScroll, true);
      bound.forEach((state) => state.cleanup());
      bound.clear();
    };
  }, []);

  return null;
}
