/**
 * PAP-659 read-only evidence projection. Core is authoritative for this Center;
 * a missing/capped session is NOT proof a physical device is offline.
 * Never turn heartbeat into renderer ACK or assume target uniqueness.
 */
export type DeviceSessionEvidence =
  | { kind: "unverified" | "not-observed" | "ambiguous"; sessionId: null; displayId: null; lastSeenAt: null }
  | { kind: "recent-heartbeat" | "stale-heartbeat"; sessionId: string; displayId: string; lastSeenAt: string };

type DeviceScope = { id: string; centerId: string | null };
type CenterHealth = {
  centerId: string;
  deviceSessions: readonly {
    sessionId: string;
    deviceId: string;
    displayId: string;
    lastSeenAt: string;
    heartbeatFresh: boolean;
  }[];
};

export function describeDeviceSession(
  health: CenterHealth | null,
  selectedCenter: string,
  device: DeviceScope,
): DeviceSessionEvidence {
  if (!selectedCenter || !health || health.centerId !== selectedCenter || device.centerId !== selectedCenter)
    return { kind: "unverified", sessionId: null, displayId: null, lastSeenAt: null };

  const sessions = health.deviceSessions.filter(session => session.deviceId === device.id);
  if (!sessions.length)
    return { kind: "not-observed", sessionId: null, displayId: null, lastSeenAt: null };
  // Multiple active sessions may exist for one device. Do not invent a unique target.
  if (sessions.length !== 1)
    return { kind: "ambiguous", sessionId: null, displayId: null, lastSeenAt: null };
  const session = sessions[0]!;
  return {
    kind: session.heartbeatFresh ? "recent-heartbeat" : "stale-heartbeat",
    sessionId: session.sessionId,
    displayId: session.displayId,
    lastSeenAt: session.lastSeenAt,
  };
}
