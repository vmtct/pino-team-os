"use client";

import { type RefObject, useEffect, useRef } from "react";

export function usePrototypePolish<T extends HTMLElement>(
  rootRef: RefObject<T | null>,
  polish: (root: T) => void,
  options: { listenToChange?: boolean } = {},
) {
  const polishRef = useRef(polish);
  polishRef.current = polish;
  const listenToChange = options.listenToChange ?? false;

  useEffect(() => {
    const current = rootRef.current;
    if (current === null) return;
    const root: T = current;

    let frame = 0;
    let scheduled = false;
    const observer = new MutationObserver(schedule);

    function run() {
      scheduled = false;
      observer.disconnect();
      try {
        polishRef.current(root);
      } finally {
        observer.observe(root, { childList: true, subtree: true, characterData: true });
      }
    }
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(run);
    }

    schedule();
    window.addEventListener("resize", schedule);
    if (listenToChange) root.addEventListener("change", schedule);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      if (listenToChange) root.removeEventListener("change", schedule);
    };
  }, [rootRef, listenToChange]);
}
