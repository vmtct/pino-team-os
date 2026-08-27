import {
  f3DeliveryApi,
  type DeliveryTopology,
  type F3BootstrapState,
  type F3LearningSpace,
  type F3RunningClass,
} from "./f3-delivery-api";

export const REVIEWED_F3_HORIZON_DAYS = 14;

interface SpaceSeed {
  code: string;
  displayName: string;
  optimal: number;
  hard: number;
}

interface ClassSeed {
  pathName: string;
  spaceCode: string;
  weekdayIso: number;
  startsLocal: string;
  endsLocal: string;
  topology: DeliveryTopology;
  defaultParticipationMinutes: number;
  optimal: number;
  hard: number;
}
const SPACE_SEEDS: SpaceSeed[] = [
  { code: "pianohouse", displayName: "PianoHouse", optimal: 8, hard: 9 },
  { code: "artchitect", displayName: "Artchitect", optimal: 8, hard: 10 },
  { code: "little-piner", displayName: "Little Piner", optimal: 8, hard: 10 },
];

const ARTCHITECT: Array<[number, string, string]> = [
  [1, "18:00", "19:30"], [2, "18:00", "21:00"], [3, "18:00", "21:00"],
  [4, "18:00", "21:00"], [5, "18:00", "21:00"], [6, "18:00", "20:00"],
  [7, "18:00", "19:30"],
];
const PIANOHOUSE: Array<[number, string, string]> = [
  [1, "18:00", "19:30"], [2, "18:00", "19:30"], [2, "19:30", "21:00"],
  [3, "18:00", "19:30"], [3, "19:00", "20:30"], [3, "19:30", "21:00"],
  [4, "18:00", "19:30"], [4, "19:30", "21:00"], [5, "18:00", "19:30"],
  [5, "19:00", "20:30"], [5, "19:30", "21:00"], [7, "18:00", "19:30"],
];
const LITTLE_PINER_ART: Array<[number, string, string]> = [
  [1, "18:00", "19:30"], [2, "18:00", "19:30"], [2, "19:00", "20:30"],
  [2, "19:30", "21:00"], [3, "18:00", "19:30"], [4, "18:00", "19:30"],
  [4, "19:00", "20:30"], [4, "19:30", "21:00"],
];
function seeds(): ClassSeed[] {
  return [
    ...ARTCHITECT.map(([weekdayIso, startsLocal, endsLocal]) => ({
      pathName: "Artchitect", spaceCode: "artchitect", weekdayIso, startsLocal, endsLocal,
      topology: "FLEXIBLE_STUDIO" as const, defaultParticipationMinutes: 90, optimal: 8, hard: 10,
    })),
    ...PIANOHOUSE.map(([weekdayIso, startsLocal, endsLocal]) => ({
      pathName: "PianoHouse", spaceCode: "pianohouse", weekdayIso, startsLocal, endsLocal,
      topology: "FIXED_COHORT" as const, defaultParticipationMinutes: 90, optimal: 8, hard: 9,
    })),
    ...LITTLE_PINER_ART.map(([weekdayIso, startsLocal, endsLocal]) => ({
      pathName: "Little Piner Art", spaceCode: "little-piner", weekdayIso, startsLocal, endsLocal,
      topology: "OVERLAPPING_COHORT" as const, defaultParticipationMinutes: 90, optimal: 8, hard: 10,
    })),
    { pathName: "Little Piner Piano", spaceCode: "little-piner", weekdayIso: 5,
      startsLocal: "18:00", endsLocal: "19:30", topology: "OVERLAPPING_COHORT",
      defaultParticipationMinutes: 90, optimal: 8, hard: 10 },
  ];
}

const BLOCKS = [
  { blockKind: "LEARNING" as const, startsOffsetMinutes: 0, endsOffsetMinutes: 30, label: null },
  { blockKind: "TRANSITION" as const, startsOffsetMinutes: 30, endsOffsetMinutes: 45, label: "Break" },
  { blockKind: "LEARNING" as const, startsOffsetMinutes: 45, endsOffsetMinutes: 75, label: null },
  { blockKind: "TRANSITION" as const, startsOffsetMinutes: 75, endsOffsetMinutes: 90, label: "Break" },
];
export interface ReviewedSeedResult {
  learningSpaces: number;
  runningClasses: number;
  blocks: number;
  materialization: { attempted: number; materialized: number; existing: number; excluded: number; noOccurrence: number };
}

type SeedApi = typeof f3DeliveryApi;

export async function applyReviewedF3Seed(
  centerId: string,
  startLocalDate: string,
  api: SeedApi = f3DeliveryApi,
): Promise<ReviewedSeedResult> {
  let state = await api.bootstrap();
  const center = state.centers.find((item) => item.id === centerId);
  if (!center) throw new Error("Reviewed F3 Center is not present in canonical state.");

  for (const seed of SPACE_SEEDS) await ensureSpace(state, centerId, seed, api);
  state = await api.bootstrap();
  const spaceByCode = new Map(state.learningSpaces.filter((item) => item.centerId === centerId).map((item) => [item.code, item]));
  const pathByName = new Map(state.paths.filter((item) => item.status === "ACTIVE").map((item) => [item.displayName, item]));

  for (const seed of seeds()) {
    const path = pathByName.get(seed.pathName);
    const space = spaceByCode.get(seed.spaceCode);
    if (!path || !space) throw new Error(`Reviewed F3 dependency missing for ${seed.pathName}.`);
    await ensureClass(state, centerId, path.id, space.id, seed, api);
    state = await api.bootstrap();
  }
  for (const seed of seeds().filter((item) => item.topology !== "FLEXIBLE_STUDIO")) {
    const path = pathByName.get(seed.pathName)!;
    const space = spaceByCode.get(seed.spaceCode)!;
    const runningClass = findClass(state, centerId, path.id, space.id, seed);
    if (!runningClass) throw new Error(`Reviewed Running Class disappeared for ${seed.pathName}.`);
    await ensureBlocks(state, runningClass, api);
    state = await api.bootstrap();
  }

  const centerPolicy = state.materializationPolicyStreams.find((item) => item.targetType === "CENTER" && item.targetId === centerId) ?? null;
  if (centerPolicy?.draftVersionId && centerPolicy.draftValue?.horizonDays !== REVIEWED_F3_HORIZON_DAYS) {
    throw new Error("Existing CENTER materialization draft conflicts with reviewed 14-day policy.");
  }
  if (centerPolicy?.draftVersionId) {
    await api.publishMaterializationPolicy(centerPolicy.draftVersionId, {
      targetType: "CENTER", targetId: centerId, effectiveFrom: new Date().toISOString(), expectedRevision: centerPolicy.revision,
    });
  } else if (centerPolicy?.publishedValue?.horizonDays !== REVIEWED_F3_HORIZON_DAYS) {
    const draft = await api.createMaterializationPolicyDraft({
      targetType: "CENTER", targetId: centerId, value: { horizonDays: REVIEWED_F3_HORIZON_DAYS },
      changeReason: "Founder-approved F3 reviewed delivery seed",
    });
    await api.publishMaterializationPolicy(draft.versionId, {
      targetType: "CENTER", targetId: centerId, effectiveFrom: new Date().toISOString(), expectedRevision: draft.revision,
    });
  }

  state = await api.bootstrap();
  assertReviewedState(state, centerId);
  const materialization = await api.materialize({ centerId, startsOnLocalDate: startLocalDate, effectiveAt: new Date().toISOString() });
  return { learningSpaces: SPACE_SEEDS.length, runningClasses: seeds().length, blocks: seeds().filter((item) => item.topology !== "FLEXIBLE_STUDIO").length * BLOCKS.length, materialization };
}
async function ensureSpace(state: F3BootstrapState, centerId: string, seed: SpaceSeed, api: SeedApi) {
  const matches = state.learningSpaces.filter((item) => item.centerId === centerId && item.code === seed.code);
  if (matches.length > 1) throw new Error(`Duplicate reviewed Learning Space code: ${seed.code}.`);
  const existing = matches[0];
  if (existing) {
    if (!spaceMatches(existing, seed)) throw new Error(`Learning Space ${seed.code} conflicts with reviewed F3 truth.`);
    return existing;
  }
  return api.createLearningSpace({
    centerId, code: seed.code, displayName: seed.displayName,
    optimalConcurrentCapacity: seed.optimal, hardConcurrentCapacity: seed.hard, status: "ACTIVE",
  });
}

function spaceMatches(space: F3LearningSpace, seed: SpaceSeed) {
  return space.displayName === seed.displayName && space.optimalConcurrentCapacity === seed.optimal
    && space.hardConcurrentCapacity === seed.hard && space.status === "ACTIVE";
}

async function ensureClass(state: F3BootstrapState, centerId: string, pathProgramId: string, learningSpaceId: string, seed: ClassSeed, api: SeedApi) {
  const existing = findClass(state, centerId, pathProgramId, learningSpaceId, seed);
  if (existing) return existing;
  const conflicting = state.runningClasses.filter((item) => item.centerId === centerId && item.pathProgramId === pathProgramId
    && item.weekdayIso === seed.weekdayIso && item.windowStartsLocal === seed.startsLocal && item.windowEndsLocal === seed.endsLocal);
  if (conflicting.length) throw new Error(`Running Class slot conflicts with reviewed F3 seed: ${operationalName(seed)}.`);
  return api.createRunningClass({
    centerId, pathProgramId, learningSpaceId, operationalName: operationalName(seed), weekdayIso: seed.weekdayIso,
    windowStartsLocal: seed.startsLocal, windowEndsLocal: seed.endsLocal, deliveryTopology: seed.topology,
    defaultParticipationMinutes: seed.defaultParticipationMinutes, optimalConcurrentCapacity: seed.optimal,
    hardConcurrentCapacity: seed.hard, status: "ACTIVE",
  });
}
function findClass(state: F3BootstrapState, centerId: string, pathProgramId: string, learningSpaceId: string, seed: ClassSeed) {
  const matches = state.runningClasses.filter((item) => item.centerId === centerId && item.pathProgramId === pathProgramId
    && item.learningSpaceId === learningSpaceId && item.weekdayIso === seed.weekdayIso
    && item.windowStartsLocal === seed.startsLocal && item.windowEndsLocal === seed.endsLocal);
  if (matches.length > 1) throw new Error(`Duplicate reviewed Running Class: ${operationalName(seed)}.`);
  const existing = matches[0];
  if (!existing) return null;
  if (!classMatches(existing, seed)) throw new Error(`Running Class conflicts with reviewed F3 truth: ${operationalName(seed)}.`);
  return existing;
}

function classMatches(item: F3RunningClass, seed: ClassSeed) {
  return item.operationalName === operationalName(seed) && item.deliveryTopology === seed.topology
    && item.defaultParticipationMinutes === seed.defaultParticipationMinutes
    && item.optimalConcurrentCapacity === seed.optimal && item.hardConcurrentCapacity === seed.hard
    && item.status === "ACTIVE";
}

async function ensureBlocks(state: F3BootstrapState, runningClass: F3RunningClass, api: SeedApi) {
  const existing = state.runningClassBlocks.filter((item) => item.runningClassId === runningClass.id);
  const unexpected = existing.filter((item) => !BLOCKS.some((block) => block.blockKind === item.blockKind
    && block.startsOffsetMinutes === item.startsOffsetMinutes && block.endsOffsetMinutes === item.endsOffsetMinutes
    && block.label === item.label));
  if (unexpected.length) throw new Error(`Running Class has unexpected blocks: ${runningClass.operationalName}.`);
  for (const block of BLOCKS) {
    const found = existing.some((item) => item.blockKind === block.blockKind && item.startsOffsetMinutes === block.startsOffsetMinutes
      && item.endsOffsetMinutes === block.endsOffsetMinutes && item.label === block.label);
    if (!found) await api.createRunningClassBlock({ runningClassId: runningClass.id, ...block });
  }
}
function assertReviewedState(state: F3BootstrapState, centerId: string) {
  const activeCenterClasses = state.runningClasses.filter((item) => item.centerId === centerId && item.status === "ACTIVE");
  if (activeCenterClasses.length !== seeds().length) throw new Error(`Reviewed F3 materialization requires exactly ${seeds().length} active Running Classes; found ${activeCenterClasses.length}.`);
  const centerSpaces = state.learningSpaces.filter((item) => item.centerId === centerId);
  for (const seed of SPACE_SEEDS) {
    const space = centerSpaces.find((item) => item.code === seed.code);
    if (!space || !spaceMatches(space, seed)) throw new Error(`Reviewed Learning Space reconciliation failed: ${seed.code}.`);
  }
  const pathByName = new Map(state.paths.filter((item) => item.status === "ACTIVE").map((item) => [item.displayName, item]));
  const spaceByCode = new Map(centerSpaces.map((item) => [item.code, item]));
  for (const seed of seeds()) {
    const path = pathByName.get(seed.pathName), space = spaceByCode.get(seed.spaceCode);
    if (!path || !space || !findClass(state, centerId, path.id, space.id, seed)) {
      throw new Error(`Reviewed Running Class reconciliation failed: ${operationalName(seed)}.`);
    }
  }
  const centerPolicy = state.materializationPolicyStreams.find((item) => item.targetType === "CENTER" && item.targetId === centerId);
  if (centerPolicy?.publishedValue?.horizonDays !== REVIEWED_F3_HORIZON_DAYS) {
    throw new Error("Reviewed 14-day materialization policy is not effective at CENTER scope.");
  }
}

function operationalName(seed: ClassSeed) {
  const weekday = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][seed.weekdayIso];
  const suffix = seed.topology === "FLEXIBLE_STUDIO" ? "Studio" : seed.startsLocal;
  return `${seed.pathName} · ${weekday} ${suffix}`;
}
