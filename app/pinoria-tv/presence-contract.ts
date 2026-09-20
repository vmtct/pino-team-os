import type { PinoriaCharacterConfig, PinoriaWardRender } from "./layered-character";
import type { WardSession, WardSessionCandidate, WardSlot } from "@/lib/pinoria-ward-session";

export type PresenceActorType = "LEARNER" | "STAFF";
export type PresenceSourceType = "STUDENT_VISIT" | "TIMEKEEPING_SESSION";
export type PresenceSource = {
  actorType: PresenceActorType;
  sourceType: PresenceSourceType;
  sourceId: string;
  openedAt: string;
};
export type PresenceLoadout = { version: number; slots: Record<string, string> } | null;
export type PresenceWardRender = PinoriaWardRender | null;
export type PresenceActor = {
  pinoriaSelfId: string;
  actorType: PresenceActorType;
  displayName: string;
  characterId: string | null;
  character: PinoriaCharacterConfig | null;
  loadout: PresenceLoadout;
  wardRender: PresenceWardRender;
  sources: PresenceSource[];
  wardSession?: WardSession;
};
export type PresenceSnapshot = { cursor: number; actors: PresenceActor[] };
export type PresenceEvent = {
  sequence: number;
  kind: "PRESENCE_EVENT";
  id: string;
  type: "ARRIVAL" | "DEPARTURE";
  actorType: PresenceActorType;
  sourceType: PresenceSourceType;
  sourceId: string;
  pinoriaSelfId: string;
  occurredAt: string;
  payload: {
    displayName: string;
    characterId: string | null;
    character: PinoriaCharacterConfig | null;
    loadout: PresenceLoadout;
  };
};
export type PresenceReconcile = {
  sequence: number;
  kind: "RECONCILE_REQUIRED";
  pinoriaSelfId: string;
  sourceType: PresenceSourceType;
  sourceId: string;
  occurredAt: string;
};
export type PresenceStreamEvent = PresenceEvent | PresenceReconcile;
export type PresenceEventPage = { cursor: number; events: PresenceStreamEvent[] };

export function sourceKey(sourceType: PresenceSourceType, sourceId: string) {
  return `${sourceType}:${sourceId}`;
}

export function actorHasSource(actor: PresenceActor, sourceType: PresenceSourceType, sourceId: string) {
  const expected = sourceKey(sourceType, sourceId);
  return actor.sources.some((source) => sourceKey(source.sourceType, source.sourceId) === expected);
}

export function actorFromArrival(event: PresenceEvent): PresenceActor {
  if (event.type !== "ARRIVAL") throw new Error("PINORIA_PRESENCE_ARRIVAL_REQUIRED");
  return {
    pinoriaSelfId: event.pinoriaSelfId,
    actorType: event.actorType,
    displayName: event.payload.displayName,
    characterId: event.payload.characterId,
    character: event.payload.character,
    loadout: event.payload.loadout,
    wardRender: null,
    sources: [{ actorType: event.actorType, sourceType: event.sourceType, sourceId: event.sourceId, openedAt: event.occurredAt }],
  };
}

export function parsePresenceSnapshot(value: unknown): PresenceSnapshot {
  const row = object(value, "PINORIA_PRESENCE_SNAPSHOT_INVALID");
  const cursor = integer(row.cursor, "PINORIA_PRESENCE_CURSOR_INVALID");
  const actors = array(row.actors, "PINORIA_PRESENCE_ACTORS_INVALID").map(parseActor);
  if (new Set(actors.map((actor) => actor.pinoriaSelfId)).size !== actors.length) throw new Error("PINORIA_PRESENCE_DUPLICATE_SELF");
  return { cursor, actors };
}



export function mergePresenceWardSessions(presenceValue: unknown, learnerHouseValue: unknown): PresenceSnapshot {
  const presence = parsePresenceSnapshot(presenceValue);
  const house = object(learnerHouseValue, "PINORIA_WARD_HOUSE_SNAPSHOT_INVALID");
  const learners = array(house.learners, "PINORIA_WARD_HOUSE_LEARNERS_INVALID");
  const wardByVisit = new Map<string, WardSession>();
  for (const item of learners) {
    const learner = object(item, "PINORIA_WARD_HOUSE_LEARNER_INVALID");
    const visit = object(learner.visit, "PINORIA_WARD_HOUSE_VISIT_INVALID");
    const visitId = text(visit.id, "PINORIA_WARD_HOUSE_VISIT_INVALID");
    if (learner.wardSession !== undefined) wardByVisit.set(visitId, wardSession(learner.wardSession));
  }
  return {
    ...presence,
    actors: presence.actors.map((actor) => {
      const learnerSource = actor.sources.find((source) => source.sourceType === "STUDENT_VISIT");
      const session = learnerSource ? wardByVisit.get(learnerSource.sourceId) : undefined;
      return session ? { ...actor, wardSession: session } : actor;
    }),
  };
}

export function parsePresenceEventPage(value: unknown): PresenceEventPage {
  const row = object(value, "PINORIA_PRESENCE_EVENT_PAGE_INVALID");
  return {
    cursor: integer(row.cursor, "PINORIA_PRESENCE_CURSOR_INVALID"),
    events: array(row.events, "PINORIA_PRESENCE_EVENTS_INVALID").map(parseEvent),
  };
}

function parseActor(value: unknown): PresenceActor {
  const row = object(value, "PINORIA_PRESENCE_ACTOR_INVALID");
  const sources = array(row.sources, "PINORIA_PRESENCE_SOURCES_INVALID").map(parseSource);
  if (!sources.length) throw new Error("PINORIA_PRESENCE_SOURCES_INVALID");
  if (new Set(sources.map((source) => sourceKey(source.sourceType, source.sourceId))).size !== sources.length) throw new Error("PINORIA_PRESENCE_DUPLICATE_SOURCE");
  return {
    pinoriaSelfId: text(row.pinoriaSelfId, "PINORIA_PRESENCE_SELF_INVALID"),
    actorType: actorType(row.actorType),
    displayName: text(row.displayName, "PINORIA_PRESENCE_NAME_INVALID"),
    characterId: nullableText(row.characterId, "PINORIA_PRESENCE_CHARACTER_ID_INVALID"),
    character: character(row.character),
    loadout: loadout(row.loadout),
    wardRender: wardRender(row.wardRender),
    sources,
    ...(row.wardSession === undefined ? {} : { wardSession: wardSession(row.wardSession) }),
  };
}
function parseSource(value: unknown): PresenceSource {
  const row = object(value, "PINORIA_PRESENCE_SOURCE_INVALID");
  const parsed = { actorType: actorType(row.actorType), sourceType: sourceType(row.sourceType), sourceId: text(row.sourceId, "PINORIA_PRESENCE_SOURCE_ID_INVALID"), openedAt: text(row.openedAt, "PINORIA_PRESENCE_SOURCE_TIME_INVALID") };
  assertSourceActorPair(parsed.actorType, parsed.sourceType);
  return parsed;
}
function parseEvent(value: unknown): PresenceStreamEvent {
  const row = object(value, "PINORIA_PRESENCE_EVENT_INVALID");
  const sequence = positiveInteger(row.sequence, "PINORIA_PRESENCE_SEQUENCE_INVALID");
  const kind = row.kind;
  if (kind === "RECONCILE_REQUIRED") return {
    sequence,
    kind,
    pinoriaSelfId: text(row.pinoriaSelfId, "PINORIA_PRESENCE_SELF_INVALID"),
    sourceType: sourceType(row.sourceType),
    sourceId: text(row.sourceId, "PINORIA_PRESENCE_SOURCE_ID_INVALID"),
    occurredAt: text(row.occurredAt, "PINORIA_PRESENCE_SOURCE_TIME_INVALID"),
  };
  if (kind !== "PRESENCE_EVENT") throw new Error("PINORIA_PRESENCE_EVENT_KIND_INVALID");
  const type = row.type;
  if (type !== "ARRIVAL" && type !== "DEPARTURE") throw new Error("PINORIA_PRESENCE_EVENT_TYPE_INVALID");
  const parsedActorType = actorType(row.actorType);
  const parsedSourceType = sourceType(row.sourceType);
  assertSourceActorPair(parsedActorType, parsedSourceType);
  const payload = object(row.payload, "PINORIA_PRESENCE_EVENT_PAYLOAD_INVALID");
  return {
    sequence,
    kind,
    id: text(row.id, "PINORIA_PRESENCE_EVENT_ID_INVALID"),
    type,
    actorType: parsedActorType,
    sourceType: parsedSourceType,
    sourceId: text(row.sourceId, "PINORIA_PRESENCE_SOURCE_ID_INVALID"),
    pinoriaSelfId: text(row.pinoriaSelfId, "PINORIA_PRESENCE_SELF_INVALID"),
    occurredAt: text(row.occurredAt, "PINORIA_PRESENCE_SOURCE_TIME_INVALID"),
    payload: {
      displayName: text(payload.displayName, "PINORIA_PRESENCE_NAME_INVALID"),
      characterId: payload.characterId === undefined ? null : nullableText(payload.characterId, "PINORIA_PRESENCE_CHARACTER_ID_INVALID"),
      character: character(payload.character),
      loadout: payload.loadout === undefined ? null : loadout(payload.loadout),
    },
  };
}
function character(value: unknown): PinoriaCharacterConfig | null {
  if (value === null) return null;
  const row = object(value, "PINORIA_PRESENCE_CHARACTER_INVALID");
  const result: PinoriaCharacterConfig = {};
  for (const [key, item] of Object.entries(row)) {
    if (typeof item !== "string") throw new Error("PINORIA_PRESENCE_CHARACTER_INVALID");
    result[key] = item;
  }
  return result;
}
function loadout(value: unknown): PresenceLoadout {
  if (value === null) return null;
  const row = object(value, "PINORIA_PRESENCE_LOADOUT_INVALID");
  const slots = object(row.slots, "PINORIA_PRESENCE_LOADOUT_INVALID");
  const parsed: Record<string, string> = {};
  for (const [slot, variantId] of Object.entries(slots)) parsed[slot] = text(variantId, "PINORIA_PRESENCE_LOADOUT_INVALID");
  return { version: integer(row.version, "PINORIA_PRESENCE_LOADOUT_INVALID"), slots: parsed };
}
function wardRender(value: unknown): PresenceWardRender {
  if (value === null) return null;
  const row = object(value, "PINORIA_PRESENCE_WARD_RENDER_INVALID");
  const mode = row.mode;
  if (mode !== "LAYERED" && mode !== "SET_WEBM") throw new Error("PINORIA_PRESENCE_WARD_RENDER_INVALID");
  const webmAssetKey = nullableText(row.webmAssetKey, "PINORIA_PRESENCE_WARD_RENDER_INVALID");
  if ((mode === "SET_WEBM") !== Boolean(webmAssetKey)) throw new Error("PINORIA_PRESENCE_WARD_RENDER_INVALID");
  const variants = array(row.variants, "PINORIA_PRESENCE_WARD_RENDER_INVALID").map((value) => {
    const variant = object(value, "PINORIA_PRESENCE_WARD_RENDER_INVALID");
    const slot = text(variant.slot, "PINORIA_PRESENCE_WARD_RENDER_INVALID") as WardSlot;
    if (!WARD_SLOTS.has(slot)) throw new Error("PINORIA_PRESENCE_WARD_RENDER_INVALID");
    const renderMode = variant.renderMode;
    if (renderMode !== "LAYER" && renderMode !== "STANDALONE" && renderMode !== "WEBM") throw new Error("PINORIA_PRESENCE_WARD_RENDER_INVALID");
    return {
      slot,
      variantId: text(variant.variantId, "PINORIA_PRESENCE_WARD_RENDER_INVALID"),
      renderMode: renderMode as "LAYER" | "STANDALONE" | "WEBM",
      assetKey: nullableText(variant.assetKey, "PINORIA_PRESENCE_WARD_RENDER_INVALID"),
      posterAssetKey: nullableText(variant.posterAssetKey, "PINORIA_PRESENCE_WARD_RENDER_INVALID"),
      renderMetadata: variant.renderMetadata,
    };
  });
  if (new Set(variants.map((variant) => variant.slot)).size !== variants.length) throw new Error("PINORIA_PRESENCE_WARD_RENDER_INVALID");
  return { mode, webmAssetKey, variants };
}

const WARD_SLOTS = new Set<WardSlot>(["HEAD/HAIR","FACE","HEADWEAR","OUTFIT","BACK","AURA_BACK","AURA_GROUND","PATH_MARK"]);
function wardSession(value: unknown): WardSession {
  const row = object(value, "PINORIA_WARD_SESSION_INVALID");
  const candidates = array(row.candidates, "PINORIA_WARD_SESSION_INVALID").map(wardCandidate);
  if (candidates.length !== 3) throw new Error("PINORIA_WARD_SESSION_INVALID");
  const status = row.status;
  if (status !== "OPEN" && status !== "SELECTED") throw new Error("PINORIA_WARD_SESSION_INVALID");
  return {
    id: text(row.id, "PINORIA_WARD_SESSION_INVALID"),
    visitId: text(row.visitId, "PINORIA_WARD_SESSION_INVALID"),
    studentProfileId: text(row.studentProfileId, "PINORIA_WARD_SESSION_INVALID"),
    centerId: text(row.centerId, "PINORIA_WARD_SESSION_INVALID"),
    policyVersion: text(row.policyVersion, "PINORIA_WARD_SESSION_INVALID"),
    loadoutVersionBefore: integer(row.loadoutVersionBefore, "PINORIA_WARD_SESSION_INVALID"),
    wardrobeVersionBefore: integer(row.wardrobeVersionBefore, "PINORIA_WARD_SESSION_INVALID"),
    status,
    candidates: candidates as [WardSessionCandidate,WardSessionCandidate,WardSessionCandidate],
    selectedVariantId: nullableText(row.selectedVariantId, "PINORIA_WARD_SESSION_INVALID"),
    selectedAt: nullableText(row.selectedAt, "PINORIA_WARD_SESSION_INVALID"),
    loadoutVersionAfter: row.loadoutVersionAfter === null ? null : integer(row.loadoutVersionAfter, "PINORIA_WARD_SESSION_INVALID"),
    createdAt: text(row.createdAt, "PINORIA_WARD_SESSION_INVALID"),
    version: positiveInteger(row.version, "PINORIA_WARD_SESSION_INVALID"),
  };
}
function wardCandidate(value: unknown): WardSessionCandidate {
  const row = object(value, "PINORIA_WARD_SESSION_INVALID");
  const slot = text(row.slot, "PINORIA_WARD_SESSION_INVALID") as WardSlot;
  if (!WARD_SLOTS.has(slot)) throw new Error("PINORIA_WARD_SESSION_INVALID");
  const render = object(row.render, "PINORIA_WARD_SESSION_INVALID");
  const mode = render.mode;
  if (mode !== "LAYER" && mode !== "STANDALONE" && mode !== "WEBM") throw new Error("PINORIA_WARD_SESSION_INVALID");
  return {
    id: text(row.id, "PINORIA_WARD_SESSION_INVALID"),
    key: text(row.key, "PINORIA_WARD_SESSION_INVALID"),
    displayName: text(row.displayName, "PINORIA_WARD_SESSION_INVALID"),
    wearableName: text(row.wearableName, "PINORIA_WARD_SESSION_INVALID"),
    slot,
    rarity: text(row.rarity, "PINORIA_WARD_SESSION_INVALID"),
    render: {
      mode,
      assetKey: nullableText(render.assetKey, "PINORIA_WARD_SESSION_INVALID"),
      posterAssetKey: nullableText(render.posterAssetKey, "PINORIA_WARD_SESSION_INVALID"),
      metadata: render.metadata,
    },
  };
}

function assertSourceActorPair(actor: PresenceActorType, source: PresenceSourceType): void {
  if ((source === "STUDENT_VISIT" && actor !== "LEARNER") || (source === "TIMEKEEPING_SESSION" && actor !== "STAFF")) throw new Error("PINORIA_PRESENCE_SOURCE_ACTOR_MISMATCH");
}
function actorType(value: unknown): PresenceActorType { if (value !== "LEARNER" && value !== "STAFF") throw new Error("PINORIA_PRESENCE_ACTOR_TYPE_INVALID"); return value; }
function sourceType(value: unknown): PresenceSourceType { if (value !== "STUDENT_VISIT" && value !== "TIMEKEEPING_SESSION") throw new Error("PINORIA_PRESENCE_SOURCE_TYPE_INVALID"); return value; }
function object(value: unknown, code: string): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code); return value as Record<string, unknown>; }
function array(value: unknown, code: string): unknown[] { if (!Array.isArray(value)) throw new Error(code); return value; }
function text(value: unknown, code: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(code); return value; }
function nullableText(value: unknown, code: string): string | null { return value === null ? null : text(value, code); }
function integer(value: unknown, code: string): number { if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(code); return Number(value); }
function positiveInteger(value: unknown, code: string): number { const result = integer(value, code); if (result < 1) throw new Error(code); return result; }
