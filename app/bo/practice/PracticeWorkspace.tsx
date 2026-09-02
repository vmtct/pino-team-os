"use client";

import { useState } from "react";
import { PracticeAuthoringView } from "./PracticeAuthoringView";
import { PracticeAccessView } from "./PracticeAccessView";
import styles from "./practice-access.module.css";

type Mode = "access" | "authoring";

export function PracticeWorkspace() {
  const [mode, setMode] = useState<Mode>("access");
  return <>
    <nav className={styles.workspaceTabs} aria-label="Piano Practice workspace">
      <button className={mode === "access" ? styles.tabActive : styles.tab} onClick={() => setMode("access")}>
        Learner access
      </button>
      <button className={mode === "authoring" ? styles.tabActive : styles.tab} onClick={() => setMode("authoring")}>
        Content authoring
      </button>
    </nav>
    {mode === "access" ? <PracticeAccessView /> : <PracticeAuthoringView />}
  </>;
}
