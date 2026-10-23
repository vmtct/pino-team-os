"use client";

import { useEffect, useState } from "react";
import type { BoContext } from "@/lib/bo-model";
import type { BoPublicViewRuntime } from "@/lib/bo-public-view-runtime";
import { boPublicViewActorRole } from "@/lib/bo-public-view-actor-role";
import { createBoPublicViewBrowserRuntime } from "@/lib/bo-public-view-browser-runtime";

/** Fail closed: never construct a shared-view client before session permissions arrive. */
export function useAuthorizedBoPublicView(moduleKey: string, moduleReadPermission: string, allowedFields: readonly string[]) {
  const [runtime, setRuntime] = useState<BoPublicViewRuntime | null>(null);
  useEffect(() => {
    let active = true;
    let current: BoPublicViewRuntime | null = null;
    void (async () => {
      try {
        const response = await fetch("/api/bo/context", { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) return;
        const body = await response.json() as { data?: BoContext };
        if (!active) return;
        const role = boPublicViewActorRole(body.data, moduleReadPermission);
        if (!role) return;
        current = createBoPublicViewBrowserRuntime({ moduleKey, role, allowedFields });
        setRuntime(current);
      } catch {
        // Missing or unavailable session never grants shared-view access.
      }
    })();
    return () => {
      active = false;
      current?.dispose();
    };
  }, [moduleKey, moduleReadPermission, allowedFields]);
  return runtime;
}

