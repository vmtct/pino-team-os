"use client";

import { useEffect, useState } from "react";
import { AmbientHouseEditor } from "./ambient-house-editor";
import { AMBIENT_HOUSE_MOTION_GRAPH_SEED } from "./ambient-house-motion-graph-canonical";

const EDITOR_STORAGE_KEY = "pinoria:ambient-house:motion-graph:1920-v1";
const SEED_MARKER_KEY = "pinoria:ambient-house:motion-graph:seed:20260821-clean-v2";

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
 * One-time bootstrap for the founder-approved graph pasted back from the editor.
 *
 * v2 also repairs a dev/StrictMode hydration race in AmbientHouseEditor where the
 * editor's initial empty draft could briefly overwrite localStorage after the seed
 * had been injected. We verify the stored graph after the child mounts; if it was
 * wiped, restore the canonical seed and remount the editor once more. The marker is
 * written only after a usable graph survives verification, so subsequent local edits
 * are left untouched.
 */
export function AmbientHouseEditorBootstrap() {
  const [ready, setReady] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const alreadySeeded = window.localStorage.getItem(SEED_MARKER_KEY) === "1";

    if (!alreadySeeded) {
      window.localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(AMBIENT_HOUSE_MOTION_GRAPH_SEED));
    }

    setReady(true);

    if (alreadySeeded) return;

    let cancelled = false;
    let attempt = 0;
    const verify = () => {
      if (cancelled) return;
      attempt += 1;

      const stored = window.localStorage.getItem(EDITOR_STORAGE_KEY);
      if (!hasUsableGraph(stored)) {
        window.localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(AMBIENT_HOUSE_MOTION_GRAPH_SEED));
        setGeneration((value) => value + 1);
      }

      if (attempt < 4) {
        window.setTimeout(verify, 60);
        return;
      }

      if (hasUsableGraph(window.localStorage.getItem(EDITOR_STORAGE_KEY))) {
        window.localStorage.setItem(SEED_MARKER_KEY, "1");
      }
    };

    const timer = window.setTimeout(verify, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (!ready) return null;
  return <AmbientHouseEditor key={`ambient-seed-v2-${generation}`} />;
}
