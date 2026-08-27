import type { EnergySeedReward } from "../../app/pinoria-tv/shop-types";
import type { PinoriaHouseLearner } from "./house-presence";

export type EnergySeedActivationStatus = "available" | "activated";

export type EnergySeedActivationSnapshot = {
  surfaceId: string;
  learnerId: string;
  status: EnergySeedActivationStatus;
  reward: EnergySeedReward | null;
  activatedAt: number | null;
  activatedByStaffId: string | null;
  queuedEventId: number | null;
};

type MutableEnergySeedActivation = EnergySeedActivationSnapshot;
type EnergySeedStore = { byKey: Record<string, MutableEnergySeedActivation> };

const globalWithEnergySeeds = globalThis as typeof globalThis & {
  __pinoriaPrototypeEnergySeeds?: EnergySeedStore;
};
const store = globalWithEnergySeeds.__pinoriaPrototypeEnergySeeds ?? { byKey: {} };
globalWithEnergySeeds.__pinoriaPrototypeEnergySeeds = store;

function key(surfaceId: string, learnerId: string) {
  return `${surfaceId}:${learnerId}`;
}

function getMutable(surfaceId: string, learnerId: string): MutableEnergySeedActivation {
  const id = key(surfaceId, learnerId);
  store.byKey[id] ??= {
    surfaceId,
    learnerId,
    status: "available",
    reward: null,
    activatedAt: null,
    activatedByStaffId: null,
    queuedEventId: null,
  };
  return store.byKey[id];
}

function prototypeRewardFor(_learner: PinoriaHouseLearner): EnergySeedReward {
  // Prototype Core resolver. The important semantic is that this outcome is
  // committed once before any TV event is emitted; production can replace the
  // recipe without changing the reveal contract.
  return {
    id: "prototype-fruit-01",
    kind: "fruit",
    label: "Fruit ×1",
    detail: "Một nguồn năng lượng mới đã được ghi nhận.",
    region: "Pinoria",
  };
}

export function energySeedSnapshot(surfaceId: string, learnerId: string): EnergySeedActivationSnapshot {
  return { ...getMutable(surfaceId, learnerId), reward: getMutable(surfaceId, learnerId).reward ? { ...getMutable(surfaceId, learnerId).reward! } : null };
}

export function activateEnergySeed(
  surfaceId: string,
  learner: PinoriaHouseLearner,
  staffId: string,
  now = Date.now(),
) {
  const activation = getMutable(surfaceId, learner.id);
  if (activation.status === "activated") {
    return { ok: false as const, activation: energySeedSnapshot(surfaceId, learner.id) };
  }

  // Resolve + commit first. TV delivery happens later and may fail/replay; the
  // committed reward never changes and activation never rerolls.
  activation.status = "activated";
  activation.reward = prototypeRewardFor(learner);
  activation.activatedAt = now;
  activation.activatedByStaffId = staffId;
  activation.queuedEventId = null;
  return { ok: true as const, activation: energySeedSnapshot(surfaceId, learner.id) };
}

export function markEnergySeedQueued(surfaceId: string, learnerId: string, eventId: number) {
  const activation = getMutable(surfaceId, learnerId);
  if (activation.status !== "activated") return energySeedSnapshot(surfaceId, learnerId);
  activation.queuedEventId = eventId;
  return energySeedSnapshot(surfaceId, learnerId);
}
