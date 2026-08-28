import type {
  CharacterProjectionSnapshot,
  InventoryAchievementSlot,
  InventoryEquipmentState,
  InventoryWearableSlot,
} from "../../app/pinoria-tv/shop-types";

const STARTING_OWNED: Record<string, string[]> = {
  bo: ["asset_hologram_wings", "asset_painting_outfit_01", "asset_hair_01", "asset_face_01", "asset_birthday_hat", "asset_star_glasses"],
  tri: ["asset_piano_outfit_01", "asset_hair_01", "asset_face_02", "asset_conical_hat", "asset_party_glasses"],
  an: ["asset_hologram_wings", "asset_painting_outfit_02", "asset_hair_01", "asset_face_03", "asset_conical_hat"],
  mai: ["asset_base_body_01", "asset_hair_01", "asset_face_04", "asset_birthday_hat", "asset_party_glasses"],
};

const STARTING_ACHIEVEMENTS: Record<string, string[]> = {
  bo: ["achievement-brush-l2", "achievement-scroll-l3", "achievement-palette-l2", "achievement-maker-l1", "badge-artchitect-l3", "badge-pianohouse-l2", "badge-house-helper-l1"],
  tri: ["achievement-scroll-l3", "achievement-maker-l2", "badge-pianohouse-l3", "badge-house-helper-l1"],
  an: ["achievement-brush-l3", "achievement-palette-l2", "badge-artchitect-l3", "badge-house-helper-l2"],
  mai: ["achievement-brush-l1", "achievement-scroll-l1", "badge-artchitect-l1"],
};

const STARTING_EQUIPMENT: Record<string, InventoryEquipmentState> = {
  bo: {
    wearables: { back: "asset_hologram_wings", body: "asset_painting_outfit_01", hair: "asset_hair_01", face: "asset_face_01", headwear: "asset_birthday_hat", eyewear: "asset_star_glasses" },
    achievements: { "achievement-1": "achievement-brush-l2", "achievement-2": "achievement-palette-l2" },
  },
  tri: {
    wearables: { body: "asset_piano_outfit_01", hair: "asset_hair_01", face: "asset_face_02", headwear: "asset_conical_hat", eyewear: "asset_party_glasses" },
    achievements: { "achievement-1": "achievement-scroll-l3", "achievement-2": "achievement-maker-l2" },
  },
  an: {
    wearables: { back: "asset_hologram_wings", body: "asset_painting_outfit_02", hair: "asset_hair_01", face: "asset_face_03", headwear: "asset_conical_hat" },
    achievements: { "achievement-1": "achievement-brush-l3", "achievement-2": "achievement-palette-l2" },
  },
  mai: {
    wearables: { body: "asset_base_body_01", hair: "asset_hair_01", face: "asset_face_04", headwear: "asset_birthday_hat", eyewear: "asset_party_glasses" },
    achievements: { "achievement-1": "achievement-brush-l1" },
  },
};

type MutableCharacterProjection = CharacterProjectionSnapshot;
type CharacterProjectionStore = { subjects: Record<string, MutableCharacterProjection> };

declare global {
  var __pinoriaPrototypeCharacterProjection: CharacterProjectionStore | undefined;
}

const store = globalThis.__pinoriaPrototypeCharacterProjection ?? { subjects: {} };
globalThis.__pinoriaPrototypeCharacterProjection = store;

function cloneEquipment(source: InventoryEquipmentState): InventoryEquipmentState {
  return {
    wearables: { ...source.wearables },
    achievements: { ...source.achievements },
  };
}

function seed(subjectId: string): MutableCharacterProjection {
  const equipment = cloneEquipment(STARTING_EQUIPMENT[subjectId] ?? { wearables: {}, achievements: {} });
  return {
    subjectId,
    ownedAssetIds: [...(STARTING_OWNED[subjectId] ?? [])],
    earnedAchievementIds: [...(STARTING_ACHIEVEMENTS[subjectId] ?? [])],
    equipment,
    revision: 1,
    updatedAt: Date.now(),
  };
}

function mutable(subjectId: string) {
  store.subjects[subjectId] ??= seed(subjectId);
  return store.subjects[subjectId];
}

function snapshot(source: MutableCharacterProjection): CharacterProjectionSnapshot {
  return {
    subjectId: source.subjectId,
    ownedAssetIds: [...source.ownedAssetIds],
    earnedAchievementIds: [...source.earnedAchievementIds],
    equipment: cloneEquipment(source.equipment),
    revision: source.revision,
    updatedAt: source.updatedAt,
  };
}

function touch(source: MutableCharacterProjection) {
  source.revision += 1;
  source.updatedAt = Date.now();
}

export function getCharacterProjection(subjectId: string) {
  return snapshot(mutable(subjectId));
}

export function grantCharacterAsset(subjectId: string, assetId: string) {
  const source = mutable(subjectId);
  if (!source.ownedAssetIds.includes(assetId)) {
    source.ownedAssetIds.push(assetId);
    touch(source);
  }
  return snapshot(source);
}

export function setCharacterWearable(subjectId: string, slot: InventoryWearableSlot, assetId: string | null) {
  const source = mutable(subjectId);
  if (assetId) source.equipment.wearables[slot] = assetId;
  else delete source.equipment.wearables[slot];
  touch(source);
  return snapshot(source);
}

export function setCharacterAchievement(subjectId: string, slot: InventoryAchievementSlot, achievementId: string | null) {
  const source = mutable(subjectId);
  if (achievementId) {
    for (const key of Object.keys(source.equipment.achievements) as InventoryAchievementSlot[]) {
      if (source.equipment.achievements[key] === achievementId) delete source.equipment.achievements[key];
    }
    source.equipment.achievements[slot] = achievementId;
  } else delete source.equipment.achievements[slot];
  touch(source);
  return snapshot(source);
}