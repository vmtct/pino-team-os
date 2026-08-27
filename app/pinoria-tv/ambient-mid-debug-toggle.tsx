"use client";

import { useEffect, useState } from "react";

type MidState = "missing" | "loading" | "loaded" | "error";

function inspectMidLayer(): MidState {
  const image = document.querySelector('img[src*="layer=mid"]') as HTMLImageElement | null;
  if (!image) return "missing";
  if (image.complete && image.naturalWidth > 0) return "loaded";
  if (image.complete && image.naturalWidth === 0) return "error";
  return "loading";
}

export function AmbientMidDebugToggle() {
  const [highlighted, setHighlighted] = useState(false);
  const [midState, setMidState] = useState<MidState>("missing");

  useEffect(() => {
    const refresh = () => setMidState(inspectMidLayer());
    refresh();

    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });

    const timer = window.setInterval(refresh, 500);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      document.documentElement.classList.remove("pinoria-highlight-mid");
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("pinoria-highlight-mid", highlighted);
  }, [highlighted]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.toLowerCase() !== "m") return;
      event.preventDefault();
      setHighlighted((value) => !value);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const stateLabel = midState === "loaded"
    ? "MID LOADED"
    : midState === "loading"
      ? "MID LOADING"
      : midState === "error"
        ? "MID ERROR"
        : "MID MISSING";

  return (
    <div
      style={{
        position: "fixed",
        right: 18,
        top: 18,
        zIndex: 220,
        display: "grid",
        gap: 6,
        minWidth: 180,
        padding: 10,
        borderRadius: 12,
        border: "1px solid #ffffff2a",
        background: "#101711e8",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        backdropFilter: "blur(10px)",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".1em", color: midState === "loaded" ? "#8df5b8" : "#ffb0a8" }}>
        {stateLabel}
      </div>
      <button
        type="button"
        onClick={() => setHighlighted((value) => !value)}
        style={{
          border: highlighted ? "1px solid #ffe66c" : "1px solid #ffffff22",
          borderRadius: 9,
          padding: "8px 10px",
          background: highlighted ? "#ffe66c" : "#ffffff0d",
          color: highlighted ? "#17150b" : "#fff",
          fontSize: 11,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        MID BRIGHTNESS 200% {highlighted ? "ON" : "OFF"} · M
      </button>
    </div>
  );
}
