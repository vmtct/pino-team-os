"use client";

import { useEffect, useState } from "react";
import { AmbientHouseEditor } from "./ambient-house-editor";
import { AMBIENT_HOUSE_MOTION_GRAPH_SEED } from "./ambient-house-motion-graph-canonical";

const EDITOR_STORAGE_KEY = "pinoria:ambient-house:motion-graph:1920-v1";
const SEED_MARKER_KEY = "pinoria:ambient-house:motion-graph:seed:20260821-clean-v1";

/**
 * One-time bootstrap for the founder-approved graph pasted back from the editor.
 * It intentionally replaces the previous local v1 draft once on each browser,
 * then leaves subsequent local edits untouched.
 */
export function AmbientHouseEditorBootstrap() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(SEED_MARKER_KEY) !== "1") {
      window.localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(AMBIENT_HOUSE_MOTION_GRAPH_SEED));
      window.localStorage.setItem(SEED_MARKER_KEY, "1");
    }
    setReady(true);
  }, []);

  if (!ready) return null;
  return <AmbientHouseEditor />;
}
