"use client";

import { type RefObject, useEffect, useRef } from "react";

type PrototypePolishOptions = {
  listenToChange?: boolean;
  observeMutations?: boolean;
  settleFrames?: number;
};

export function usePrototypePolish<T extends HTMLElement>(
  rootRef: RefObject<T | null>,
  polish: (root: T) => void,
  options: PrototypePolishOptions = {},
) {
  const polishRef = useRef(polish);
  polishRef.current = polish;
  const listenToChange = options.listenToChange ?? false;
  const observeMutations = options.observeMutations ?? false;
  const settleFrames = Math.max(1, options.settleFrames ?? 4);

  useEffect(() => {
    const current = rootRef.current;
    if (current === null) return;
    const root: T = current;
    let frame = 0;
    let remaining = 0;
    let scheduled = false;
    const observer = observeMutations ? new MutationObserver(() => schedule(2)) : null;

    function run() {
      scheduled = false;
      observer?.disconnect();
      polishRef.current(root);
      if (observeMutations) observer?.observe(root, { childList: true, subtree: true, characterData: true });
      remaining -= 1;
      if (remaining > 0) {
        scheduled = true;
        frame = requestAnimationFrame(run);
      }
    }

    function schedule(frames = settleFrames) {
      remaining = Math.max(remaining, frames);
      if (scheduled) return;
      scheduled = true;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(run);
    }

    const handleResize = () => schedule();
    const handleClick = () => schedule();
    const handleChange = () => schedule();

    schedule();
    window.addEventListener("resize", handleResize);
    root.addEventListener("click", handleClick, true);
    if (listenToChange) root.addEventListener("change", handleChange, true);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", handleResize);
      root.removeEventListener("click", handleClick, true);
      if (listenToChange) root.removeEventListener("change", handleChange, true);
    };
  }, [rootRef, listenToChange, observeMutations, settleFrames]);
}
