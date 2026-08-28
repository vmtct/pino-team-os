"use client";

import { useCallback, useEffect, useState } from "react";
import {
  toppiStagingApi,
  type ToppiDeliverySlot,
  type ToppiEnrollment,
  type ToppiLearner,
} from "@/lib/toppi-staging-api";

export function useCanonicalToppi() {
  const [students, setStudents] = useState<ToppiLearner[]>([]);
  const [slots, setSlots] = useState<ToppiDeliverySlot[]>([]);
  const [enrollments, setEnrollments] = useState<ToppiEnrollment[]>([]);
  const [renewals, setRenewals] = useState<ToppiEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextStudents, nextSlots, nextEnrollments, nextRenewals] = await Promise.all([
        toppiStagingApi.students(),
        toppiStagingApi.slots(),
        toppiStagingApi.enrollments(),
        toppiStagingApi.renewals(),
      ]);      setStudents(nextStudents);
      setSlots(nextSlots);
      setEnrollments(nextEnrollments);
      setRenewals(nextRenewals);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Canonical Toppi staging could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return { students, slots, enrollments, renewals, loading, error, refresh };
}
