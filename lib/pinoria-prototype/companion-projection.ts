import type {
  ActiveCompanionSnapshot,
  CompanionProjectionSnapshot,
} from "../../app/pinoria-tv/shop-types";

const STARTING_ACTIVE: Record<string, ActiveCompanionSnapshot | null> = {
  bo: {
    id: "bum",
    displayName: "Bùm",
    species: "Ploo",
    level: 2,
    formLabel: "Hiện hình II",
    visualId: "ploo-default",
  },
  tri: {
    id: "may",
    displayName: "Mây",
    species: "Ploo",
    level: 2,
    formLabel: "Hiện hình II",
    visualId: "ploo-default",
  },
  an: {
    id: "mam",
    displayName: "Mầm",
    species: "Ploo",
    level: 1,
    formLabel: "Hiện hình I",
    visualId: "ploo-default",
  },
  mai: null,
};

const STARTING_COLLECTIONS: Record<string, string[]> = {
  bo: ["bum"],
  tri: ["may"],
  an: ["mam"],
  mai: [],
};

type MutableCompanionProjection = CompanionProjectionSnapshot;
type CompanionProjectionStore = {
  subjects: Record<string, MutableCompanionProjection>;
};

declare global {
  var __pinoriaPrototypeCompanionProjection: CompanionProjectionStore | undefined;
}

const store = globalThis.__pinoriaPrototypeCompanionProjection ?? { subjects: {} };
globalThis.__pinoriaPrototypeCompanionProjection = store;

function cloneActive(active: ActiveCompanionSnapshot | null) {
  return active ? { ...active } : null;
}

function seed(subjectId: string): MutableCompanionProjection {
  return {
    subjectId,
    active: cloneActive(STARTING_ACTIVE[subjectId] ?? null),
    collectionIds: [...(STARTING_COLLECTIONS[subjectId] ?? [])],
    revision: 1,
    updatedAt: Date.now(),
  };
}

function mutable(subjectId: string) {
  store.subjects[subjectId] ??= seed(subjectId);
  return store.subjects[subjectId];
}

function snapshot(source: MutableCompanionProjection): CompanionProjectionSnapshot {
  return {
    subjectId: source.subjectId,
    active: cloneActive(source.active),
    collectionIds: [...source.collectionIds],
    revision: source.revision,
    updatedAt: source.updatedAt,
  };
}

export function getCompanionProjection(subjectId: string) {
  return snapshot(mutable(subjectId));
}
