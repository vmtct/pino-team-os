import type { OperatorDeviceSession, OperatorHealth } from "@/app/pinoria-tv/operator-presentation-client";

/** A capped health snapshot provides candidate hints, never dispatch authority.
 * Replay must ALWAYS recheck the exact selected identity against Core preflight. */
export function verifiedReplayCandidates(health: OperatorHealth, centerId: string): OperatorDeviceSession[] {
  if (!centerId || health.centerId !== centerId) return [];
  const sessionCounts = new Map<string, number>();
  const displayCounts = new Map<string, number>();
  for (const session of health.deviceSessions) {
    if (session.sessionId && session.displayId && session.deviceId && session.heartbeatFresh === true) {
      sessionCounts.set(session.sessionId, (sessionCounts.get(session.sessionId) ?? 0) + 1);
      displayCounts.set(session.displayId, (displayCounts.get(session.displayId) ?? 0) + 1);
    }
  }
  // Two live sessions on one display are ambiguous even when their session IDs differ.
  // The Core replay-target CAS is still the sole dispatch authority.
  return health.deviceSessions.filter(session =>
    session.heartbeatFresh === true && !!session.sessionId && !!session.deviceId && !!session.displayId &&
    sessionCounts.get(session.sessionId) === 1 && displayCounts.get(session.displayId) === 1
  );
}

export function targetMatchesSelected(
  selected: Pick<OperatorDeviceSession, "sessionId" | "deviceId" | "displayId">,
  target: { displayId: string; deviceId: string; sessionId: string } | null,
): boolean {
  return !!target && !!selected.sessionId && !!selected.deviceId && !!selected.displayId &&
    target.displayId === selected.displayId &&
    target.deviceId === selected.deviceId &&
    target.sessionId === selected.sessionId;
}
