"use client";

import { useEffect, useState } from "react";
import { AmbientHouseEditor } from "./ambient-house-editor";
import savedGraph from "./ambient-house-motion-graph.saved.json";

const EDITOR_STORAGE_KEY = "pinoria:ambient-house:motion-graph:1920-v1";

function hasUsableGraph(raw: string | null) {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as {
      horizontalLanes?: unknown[];
      rawConnectors?: unknown[];
    };
    return Array.isArray(parsed.horizontalLanes)
      && parsed.horizontalLanes.length > 0
      && Array.isArray(parsed.rawConnectors)
      && parsed.rawConnectors.length > 0;
  } catch {
    return false;
  }
}

/**
 * The editor source of truth is the checked-in JSON file above.
 *
 * On every page load we seed the editor from code instead of trusting stale
 * browser storage. In dev, React StrictMode mounts effects twice; the editor's
 * legacy autosave effect can briefly try to persist its initial empty draft
 * before the stored graph has hydrated. We block only that empty bootstrap
 * write for a short window so both StrictMode mounts read the code-backed graph.
 */
export function AmbientHouseEditorBootstrap() {
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("READ FROM CODE");

  useEffect(() => {
    const seed = JSON.stringify(savedGraph);
    const originalSetItem = Storage.prototype.setItem;

    Storage.prototype.setItem = function patchedSetItem(key: string, value: string) {
      if (key === EDITOR_STORAGE_KEY && !hasUsableGraph(value)) return;
      return originalSetItem.call(this, key, value);
    };

    originalSetItem.call(window.localStorage, EDITOR_STORAGE_KEY, seed);
    setReady(true);

    const restoreTimer = window.setTimeout(() => {
      if (!hasUsableGraph(window.localStorage.getItem(EDITOR_STORAGE_KEY))) {
        originalSetItem.call(window.localStorage, EDITOR_STORAGE_KEY, seed);
      }
      Storage.prototype.setItem = originalSetItem;
    }, 350);

    return () => {
      window.clearTimeout(restoreTimer);
      Storage.prototype.setItem = originalSetItem;
    };
  }, []);

  async function saveToCode() {
    const raw = window.localStorage.getItem(EDITOR_STORAGE_KEY);
    if (!hasUsableGraph(raw)) {
      setSaveState("error");
      setSaveMessage("NO USABLE GRAPH TO SAVE");
      return;
    }

    setSaveState("saving");
    setSaveMessage("SAVING TO CODE…");

    try {
      const response = await fetch("/api/pinoria-prototype/ambient-motion-graph-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: raw,
      });
      const payload = await response.json() as { ok?: boolean; path?: string; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || `HTTP_${response.status}`);

      setSaveState("saved");
      setSaveMessage("SAVED TO CODE");
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? `SAVE FAILED · ${error.message}` : "SAVE FAILED");
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      void saveToCode();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!ready) return null;

  return (
    <>
      <AmbientHouseEditor />
      <div
        style={{
          position: "fixed",
          left: 470,
          top: 18,
          zIndex: 230,
          display: "grid",
          gap: 5,
          minWidth: 168,
          padding: 9,
          borderRadius: 12,
          border: "1px solid #ffffff2a",
          background: "#101711e8",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          backdropFilter: "blur(10px)",
        }}
      >
        <button
          type="button"
          onClick={() => void saveToCode()}
          disabled={saveState === "saving"}
          style={{
            border: saveState === "saved" ? "1px solid #8df5b8" : saveState === "error" ? "1px solid #ff9d9d" : "1px solid #ffffff24",
            borderRadius: 9,
            padding: "8px 10px",
            background: saveState === "saved" ? "#174b31" : saveState === "error" ? "#5b2424" : "#ffffff0d",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            cursor: saveState === "saving" ? "wait" : "pointer",
          }}
        >
          SAVE TO CODE · Ctrl+S
        </button>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".08em", opacity: .72 }}>
          {saveMessage}
        </div>
      </div>
    </>
  );
}
