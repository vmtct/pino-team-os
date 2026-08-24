import type {
  PinoriaStoreView,
  PinoriaSurfaceBaseMode,
  PinoriaSurfaceSessionSnapshot,
  ShopSubject,
} from "../../app/pinoria-tv/shop-types";

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

function getMutableSurface(surfaceId: string): MutableSurfaceSession {
  if (!store.sessions[surfaceId]) {
    store.sessions[surfaceId] = {
      surfaceId,
      baseMode: "ambient",
      lastSeenAt: null,
      subjectId: null,
      subjectName: null,
      interactive: null,
      updatedAt: Date.now(),
    };
  }
  return store.sessions[surfaceId];
}

function applySubject(
  surface: MutableSurfaceSession,
  subject: { id: string; name: string } | null | undefined,
  now: number,
) {
  if (!subject?.id) return;
  const changed = !!surface.subjectId && surface.subjectId !== subject.id;
  surface.subjectId = subject.id;
  surface.subjectName = subject.name;

  // A shared TV can only have one learner owner. When a transient learner
  // handoff changes that owner, never resurrect a stale Shop/Inventory session.
  if (changed && surface.interactive && surface.interactive.subjectId !== subject.id) {
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
  applySubject(surface, input.subject, now);
  surface.updatedAt = now;
  return getSurfaceSessionSnapshot(input.surfaceId, now);
}

export function setSurfaceSubject(
  surfaceId: string,
  subject: { id: string; name: string },
  now = Date.now(),
) {
  const surface = getMutableSurface(surfaceId);
  applySubject(surface, subject, now);
  return getSurfaceSessionSnapshot(surfaceId, now);
}

export function openSurfaceInteractive(
  surfaceId: string,
  subject: Pick<ShopSubject, "id" | "name">,
  view: PinoriaStoreView = "shop",
  now = Date.now(),
) {
  const surface = getMutableSurface(surfaceId);
  applySubject(surface, subject, now);
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
