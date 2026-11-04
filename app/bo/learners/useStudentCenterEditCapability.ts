"use client";
// PAP-1426 / SCH-STUDENT-MGMT: truthful Center-specific edit affordance.
// Core PATCH independently reauthorizes at mutation time; this hook is UI-only.
import { useEffect, useState } from "react";
import { studentCenterApi } from "@/lib/bo-student-center-api";

export function useStudentCenterEditCapability(centerId: string): boolean {
  const [result, setResult] = useState<{ centerId: string; allowed: boolean }>({ centerId: "", allowed: false });
  useEffect(() => {
    let active = true;
    if (centerId) {
      void studentCenterApi.editCapability(centerId)
        .then(allowed => { if (active) setResult({ centerId, allowed }); })
        .catch(() => { if (active) setResult({ centerId, allowed: false }); });
    }
    return () => { active = false; };
  }, [centerId]);
  return Boolean(centerId) && result.centerId === centerId && result.allowed;
}
