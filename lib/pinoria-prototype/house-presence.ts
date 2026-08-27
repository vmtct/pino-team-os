export type PinoriaHouseLearner = {
  id: string;
  name: string;
  pls: number;
  path: string;
  room: string;
  companion: string;
  fruit: number;
  checkedInAt: number;
  updatedAt: number;
};

type PresenceStore = {
  bySurface: Record<string, Record<string, PinoriaHouseLearner>>;
};

type ArrivalSubject = {
  id: string;
  name: string;
  pls?: number;
  path?: string;
  room?: string;
  companion?: string;
  fruit?: number;
};

const globalWithPresence = globalThis as typeof globalThis & {
  __pinoriaPrototypeHousePresence?: PresenceStore;
};
const store = globalWithPresence.__pinoriaPrototypeHousePresence ?? { bySurface: {} };
globalWithPresence.__pinoriaPrototypeHousePresence = store;

function bucket(surfaceId: string) {
  store.bySurface[surfaceId] ??= {};
  return store.bySurface[surfaceId];
}

export function markHouseArrival(surfaceId: string, subject: ArrivalSubject, now = Date.now()) {
  if (!subject?.id || !subject.name) return;
  const learners = bucket(surfaceId);
  const previous = learners[subject.id];
  learners[subject.id] = {
    id: subject.id,
    name: subject.name,
    pls: Number.isFinite(Number(subject.pls)) ? Math.max(0, Math.round(Number(subject.pls))) : previous?.pls ?? 0,
    path: subject.path ?? previous?.path ?? "",
    room: subject.room ?? previous?.room ?? "",
    companion: subject.companion ?? previous?.companion ?? "",
    fruit: Number.isFinite(Number(subject.fruit)) ? Math.max(0, Math.round(Number(subject.fruit))) : previous?.fruit ?? 0,
    checkedInAt: previous?.checkedInAt ?? now,
    updatedAt: now,
  };
}

export function markHouseDeparture(surfaceId: string, learnerId: string) {
  if (!learnerId) return;
  delete bucket(surfaceId)[learnerId];
}

export function listHousePresence(surfaceId: string) {
  return Object.values(bucket(surfaceId))
    .map((learner) => ({ ...learner }))
    .sort((a, b) => a.checkedInAt - b.checkedInAt || a.name.localeCompare(b.name, "vi"));
}

export function isLearnerPresent(surfaceId: string, learnerId: string) {
  return !!bucket(surfaceId)[learnerId];
}
