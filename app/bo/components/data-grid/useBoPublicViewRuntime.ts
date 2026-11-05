"use client";

import { useEffect, useState } from "react";
import { BoPublicViewRuntime, type BoPublicViewRuntimeSnapshot } from "../../../../lib/bo-public-view-runtime";

/**
 * Subscribe to the source-owned public view runtime without unstable snapshot
 * references. Runtime remains scoped to one BO module and must be disposed by
 * its owner when no longer needed.
 */
export function useBoPublicViewRuntime(runtime: BoPublicViewRuntime): BoPublicViewRuntimeSnapshot {
  const [snapshot, setSnapshot] = useState<BoPublicViewRuntimeSnapshot>(()=>runtime.getSnapshot());

  useEffect(()=>{
    const unsubscribe = runtime.subscribe(setSnapshot);
    if (runtime.getSnapshot().status==="unloaded") {
      void runtime.load().catch(()=>{ /* Runtime exposes error in subscribed state. */ });
    }
    return unsubscribe;
  },[runtime]);
  return snapshot;
}
