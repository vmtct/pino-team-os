/** PAP-1419 / PNR-TV (PAP-650): Founder-only HO TV read projection.
 * All data comes from the existing HO BFF/Core, never from prototype fixtures.
 * This module does NOT grant access, write config, or infer renderer health.
 */
export class HoTvDirectoryError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
    this.name = "HoTvDirectoryError";
  }
}

export type HoTvDisplay = Readonly<{
  id: string; key: string; displayName: string; description: string | null;
  runtimeType: string; scopeType: "GLOBAL" | "CENTER"; scopeId: string | null;
  centerName: string | null; orientation: "LANDSCAPE" | "PORTRAIT";
  targetAspectRatio: "16:9" | "9:16"; definitionVersion: number; status: string;
}>;
export type HoTvDevice = Readonly<{
  id: string; key: string; displayName: string; centerId: string | null;
  centerName: string | null; status: string; defaultDisplayId: string | null;
  defaultDisplayName: string | null; lastSeenAt: string | null;
  actualOrientation: string | null; viewportWidth: number | null;
  viewportHeight: number | null;
}>;
export type HoTvDeviceSession = Readonly<{
  sessionId: string; deviceId: string; displayId: string;
  lastSeenAt: string; expiresAt: string; definitionVersion: number;
  runtimeType: string; heartbeatFresh: boolean; rendererAcknowledged: boolean;
  observationStatus: "FRESH" | "STALE" | "NONE";
  latestObservation: Readonly<Record<string, unknown>> | null;
}>;
export type HoTvOperatorHealth = Readonly<{
  centerId: string; deviceSessions: readonly HoTvDeviceSession[];
}>;
export type HoTvReadResult<T> = Readonly<{ data: T; requestId: string | null }>;

const invalid = (): never => { throw new HoTvDirectoryError(502, "TV_CORE_RESPONSE_INVALID"); };
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
};
const string = (row: Record<string, unknown>, key: string): string => {
  const value = row[key];
  if (typeof value !== "string" || !value.trim()) return invalid();
  return value;
};
const nullableString = (row: Record<string, unknown>, key: string): string | null => {
  const value = row[key];
  if (value === null) return null;
  return string(row, key);
};
const integer = (row: Record<string, unknown>, key: string): number => {
  const value = row[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return invalid();
  return value;
};
const nullableInteger = (row: Record<string, unknown>, key: string): number | null =>
  row[key] === null ? null : integer(row, key);
const boolean = (row: Record<string, unknown>, key: string): boolean => {
  const value = row[key];
  if (typeof value !== "boolean") return invalid();
  return value;
};
const rows = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) return invalid();
  return value.map(record);
};

function display(value: unknown): HoTvDisplay {
  const d = record(value);
  const scopeType = string(d, "scopeType");
  const orientation = string(d, "orientation");
  const targetAspectRatio = string(d, "targetAspectRatio");
  if ((scopeType !== "GLOBAL" && scopeType !== "CENTER") ||
      (orientation !== "LANDSCAPE" && orientation !== "PORTRAIT") ||
      (targetAspectRatio !== "16:9" && targetAspectRatio !== "9:16")) return invalid();
  const scopeId = nullableString(d, "scopeId");
  if (scopeType === "CENTER" && !scopeId) return invalid();
  return {
    id: string(d, "id"), key: string(d, "key"),
    displayName: string(d, "displayName"),
    description: nullableString(d, "description"),
    runtimeType: string(d, "runtimeType"),
    scopeType, scopeId, centerName: nullableString(d, "centerName"),
    orientation, targetAspectRatio,
    definitionVersion: integer(d, "definitionVersion"),
    status: string(d, "status"),
  };
}
function device(value: unknown): HoTvDevice {
  const d = record(value);
  return {
    id: string(d, "id"), key: string(d, "key"),
    displayName: string(d, "displayName"),
    centerId: nullableString(d, "centerId"),
    centerName: nullableString(d, "centerName"),
    status: string(d, "status"),
    defaultDisplayId: nullableString(d, "defaultDisplayId"),
    defaultDisplayName: nullableString(d, "defaultDisplayName"),
    lastSeenAt: nullableString(d, "lastSeenAt"),
    actualOrientation: nullableString(d, "actualOrientation"),
    viewportWidth: nullableInteger(d, "viewportWidth"),
    viewportHeight: nullableInteger(d, "viewportHeight"),
  };
}
function session(value: unknown): HoTvDeviceSession {
  const d = record(value);
  const observationStatus = string(d, "observationStatus");
  if (observationStatus !== "FRESH" && observationStatus !== "STALE" &&
      observationStatus !== "NONE") return invalid();
  const latest = d.latestObservation;
  return {
    sessionId: string(d, "sessionId"), deviceId: string(d, "deviceId"),
    displayId: string(d, "displayId"), lastSeenAt: string(d, "lastSeenAt"),
    expiresAt: string(d, "expiresAt"), definitionVersion: integer(d, "definitionVersion"),
    runtimeType: string(d, "runtimeType"),
    heartbeatFresh: boolean(d, "heartbeatFresh"),
    rendererAcknowledged: boolean(d, "rendererAcknowledged"),
    observationStatus,
    latestObservation: latest === null ? null : record(latest),
  };
}
function health(value: unknown): HoTvOperatorHealth {
  const d = record(value);
  return { centerId: string(d, "centerId"), deviceSessions: rows(d.deviceSessions).map(session) };
}

async function read<T>(
  path: string, decode: (value: unknown) => T,
  fetcher: typeof fetch, signal?: AbortSignal,
): Promise<HoTvReadResult<T>> {
  const response = await fetcher(path, {
    method: "GET", credentials: "same-origin", cache: "no-store", signal,
  });
  let body: Record<string, unknown>;
  try { body = record(await response.json()); }
  catch (error) {
    if (error instanceof HoTvDirectoryError) throw error;
    return invalid();
  }
  if (!response.ok) {
    const code = recordErrorCode(body);
    throw new HoTvDirectoryError(response.status, code);
  }
  if (!("data" in body)) return invalid();
  return { data: decode(body.data), requestId: response.headers.get("x-request-id") };
}
function recordErrorCode(body: Record<string, unknown>): string {
  if (!body.error || typeof body.error !== "object" || Array.isArray(body.error))
    return "TV_READ_FAILED";
  const code = (body.error as Record<string, unknown>).code;
  return typeof code === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(code)
    ? code : "TV_READ_FAILED";
}
const centerIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** No client-side authorization filtering: Core returns only permitted rows. */
export async function loadHoTvDirectory(fetcher: typeof fetch, signal?: AbortSignal):
  Promise<Readonly<{ displays: HoTvReadResult<readonly HoTvDisplay[]>; devices: HoTvReadResult<readonly HoTvDevice[]> }>> {
  const [displays, devices] = await Promise.all([
    read("/api/ho/pinoria/tv-health/displays", value => rows(value).map(display), fetcher, signal),
    read("/api/ho/pinoria/tv-health/devices", value => rows(value).map(device), fetcher, signal),
  ]);
  return { displays, devices };
}
/** Missing/denied Center is never converted to an empty or online state. */
export function loadHoTvOperatorHealth(
  centerId: string, fetcher: typeof fetch, signal?: AbortSignal,
): Promise<HoTvReadResult<HoTvOperatorHealth>> {
  if (!centerIdPattern.test(centerId)) throw new HoTvDirectoryError(400, "TV_INVALID_CENTER");
  const path = "/api/ho/pinoria/tv-health/operator-health?" +
    new URLSearchParams({ centerId }).toString();
  return read(path, health, fetcher, signal).then(result => {
    if (result.data.centerId !== centerId) return invalid();
    return result;
  });
}
