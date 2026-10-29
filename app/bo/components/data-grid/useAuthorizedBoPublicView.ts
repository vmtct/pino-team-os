"use client";

import { useEffect, useState } from "react";
import type { BoContext } from "@/lib/bo-model";
import type { BoPublicViewRuntime } from "@/lib/bo-public-view-runtime";
import { boPublicViewActorRole } from "@/lib/bo-public-view-actor-role";
import { canLoadAuthorizedBoPublicView } from "@/lib/bo-public-view-server-admission";
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
        // Session permissionKeys are not scope-aware. Core is authoritative for
        // organization-wide Subscription Shared Views; never instantiate a
        // persistent runtime for a Center-only Manager that receives HTTP 403.
        if (!(await canLoadAuthorizedBoPublicView(moduleKey))) return;
        if (!active) return;
        current = createBoPublicViewBrowserRuntime({ moduleKey, role, allowedFields });
        setRuntime(current);
      } catch {
        // Missing or unavailable session never grants shared-view access.
      }
    })();
    return () => {
      active = false;
      current?.dispose();
      setRuntime((previous) => previous === current ? null : previous);
    };
  }, [moduleKey, moduleReadPermission, allowedFields]);
  return runtime;
}

