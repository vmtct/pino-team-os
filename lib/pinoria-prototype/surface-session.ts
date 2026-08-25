import type {
  PinoriaStoreView,
  PinoriaSurfaceBaseMode,
  PinoriaSurfaceSessionSnapshot,
  PinoriaWorldStateSnapshot,
  ShopSubject,
} from "../../app/pinoria-tv/shop-types";
import { DEFAULT_PINORIA_WORLD_STATE } from "../../app/pinoria-tv/shop-types";

type MutableSurfaceInteractive = {
  view: PinoriaStoreView;
  subjectId: string;
  subjectName: string;
  openedAt: number;
  updatedAt: number;
};

type MutableSurfaceSession = {
  surfaceId: string;
  baseMode: PinoriaSurfaceBaseMode;
  lastSeenAt: number | null;
  subjectId: string | null;
  subjectName: string | null;
  interactive: MutableSurfaceInteractive | null;
  worldState: PinoriaWorldStateSnapshot;
  updatedAt: number;
};

type SurfaceSessionStore = {
  sessions: Record<string, MutableSurfaceSession>;
};

declare global {
  // eslint-disable-next-line no-var
  var __pinoriaPrototypeSurfaceSessions: SurfaceSessionStore | undefined;
}

const ONLINE_WINDOW_MS = 6500;
const store = globalThis.__pinoriaPrototypeSurfaceSessions ?? { sessions: {} };
globalThis.__pinoriaPrototypeSurfaceSessions = store;

function defaultWorldState(now = Date.now()): PinoriaWorldStateSnapshot {
  return { ...DEFAULT_PINORIA_WORLD_STATE, updatedAt: now };
}

function getMutableSurface(surfaceId: string): MutableSurfaceSession {
  if (!store.sessions[surfaceId]) {
    store.sessions[surfaceId] = {
      surfaceId,
      baseMode: "ambient",
      lastSeenAt: null,
      subjectId: null,
      subjectName: null,
      interactive: null,
      worldState: defaultWorldState(),
      updatedAt: Date.now(),
    };
  }
  const surface = store.sessions[surfaceId];
  // Migration for prototype sessions created before World State existed.
  if (!surface.worldState) surface.worldState = defaultWorldState(surface.updatedAt);
  return surface;
}

function writeBaseSubject(
  surface: MutableSurfaceSession,
  subject: { id: string; name: string } | null | undefined,
  now: number,
  invalidateMismatchedInteractive: boolean,
) {
  if (!subject?.id) return;
  surface.subjectId = subject.id;
  surface.subjectName = subject.name;

  // Only an explicit learner handoff (event claim) invalidates an interactive
  // session. Ambient heartbeats merely report what the backplane is showing;
  // Shop/Inventory may intentionally be opened for another selected learner.
  if (
    invalidateMismatchedInteractive
    && surface.interactive
    && surface.interactive.subjectId !== subject.id
  ) {
    surface.interactive = null;
  }
  surface.updatedAt = now;
}

export function getSurfaceSessionSnapshot(surfaceId: string, now = Date.now()): PinoriaSurfaceSessionSnapshot {
  const surface = getMutableSurface(surfaceId);
  const online = surface.lastSeenAt !== null && now - surface.lastSeenAt < ONLINE_WINDOW_MS;
  const interactiveSuspended = !!surface.interactive && surface.baseMode !== "ambient";
  const effectiveMode = surface.baseMode !== "ambient"
    ? surface.baseMode
    : surface.interactive?.view ?? "ambient";

  return {
    surfaceId: surface.surfaceId,
    online,
    baseMode: surface.baseMode,
    effectiveMode,
    lastSeenAt: surface.lastSeenAt,
    subjectId: surface.subjectId,
    subjectName: surface.subjectName,
    interactive: surface.interactive ? { ...surface.interactive } : null,
    interactiveSuspended,
    worldState: { ...surface.worldState },
    updatedAt: surface.updatedAt,
  };
}

export function heartbeatSurface(input: {
  surfaceId: string;
  mode: PinoriaSurfaceBaseMode;
  subject?: { id: string; name: string } | null;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const surface = getMutableSurface(input.surfaceId);
  surface.baseMode = input.mode;
  surface.lastSeenAt = now;
  writeBaseSubject(surface, input.subject, now, false);
  surface.updatedAt = now;
  return getSurfaceSessionSnapshot(input.surfaceId, now);
}

export function setSurfaceSubject(
  surfaceId: string,
  subject: { id: string; name: string },
  now = Date.now(),
) {
  const surface = getMutableSurface(surfaceId);
  writeBaseSubject(surface, subject, now, true);
  return getSurfaceSessionSnapshot(surfaceId, now);
}

export function setSurfaceWorldState(
  surfaceId: string,
  next: PinoriaWorldStateSnapshot,
  now = Date.now(),
) {
  const surface = getMutableSurface(surfaceId);
  surface.worldState = {
    ...next,
    revision: Math.max(surface.worldState.revision + 1, Number(next.revision) || 0),
    updatedAt: now,
  };
  surface.updatedAt = now;
  return getSurfaceSessionSnapshot(surfaceId, now);
}

export function openSurfaceInteractive(
  surfaceId: string,
  subject: Pick<ShopSubject, "id" | "name">,
  view: PinoriaStoreView = "shop",
  now = Date.now(),
) {
  const surface = getMutableSurface(surfaceId);
  surface.interactive = {
    view,
    subjectId: subject.id,
    subjectName: subject.name,
    openedAt: surface.interactive?.subjectId === subject.id ? surface.interactive.openedAt : now,
    updatedAt: now,
  };
  surface.updatedAt = now;
  return getSurfaceSessionSnapshot(surfaceId, now);
}

export function setSurfaceInteractiveView(
  surfaceId: string,
  view: PinoriaStoreView,
  now = Date.now(),
) {
  const surface = getMutableSurface(surfaceId);
  if (surface.interactive) {
    surface.interactive.view = view;
    surface.interactive.updatedAt = now;
    surface.updatedAt = now;
  }
  return getSurfaceSessionSnapshot(surfaceId, now);
}

export function closeSurfaceInteractive(surfaceId: string, now = Date.now()) {
  const surface = getMutableSurface(surfaceId);
  surface.interactive = null;
  surface.updatedAt = now;
  return getSurfaceSessionSnapshot(surfaceId, now);
}
