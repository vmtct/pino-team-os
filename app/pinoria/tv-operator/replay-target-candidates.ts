import type { OperatorDeviceSession, OperatorHealth } from "@/app/pinoria-tv/operator-presentation-client";

/** A capped health snapshot provides candidate hints, never dispatch authority.
 * Replay must ALWAYS recheck the exact selected identity against Core preflight. */
export function verifiedReplayCandidates(health: OperatorHealth, centerId: string): OperatorDeviceSession[] {
  if (!centerId || health.centerId !== centerId) return [];
  const counts = new Map<string, number>();
  for (const session of health.deviceSessions) {
    if (session.sessionId && session.displayId && session.deviceId && session.heartbeatFresh === true)
      counts.set(session.sessionId, (counts.get(session.sessionId) ?? 0) + 1);
  }
  return health.deviceSessions.filter(session =>
    session.heartbeatFresh === true && !!session.sessionId && !!session.deviceId && !!session.displayId &&
    counts.get(session.sessionId) === 1
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
