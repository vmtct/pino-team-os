"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { recoverInvalidStaffPasswordSession } from "@/lib/staff-session-recovery";

export function BoSessionBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    let active = true;

    async function verifySession() {
      try {
        const response = await fetch("/api/bo/context", { cache: "no-store" });
        if (active && response.status === 401) {
          await recoverInvalidStaffPasswordSession();
        }
      } catch {
        // Availability failure is not proof that authentication expired.
      }
    }

    void verifySession();
    function onFocus() { void verifySession(); }
    function onVisibility() {
      if (document.visibilityState === "visible") void verifySession();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname]);

  return children;
}
