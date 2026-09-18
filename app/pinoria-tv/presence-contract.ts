import type { PinoriaCharacterConfig } from "./layered-character";

export type PresenceActorType = "LEARNER" | "STAFF";
export type PresenceSourceType = "STUDENT_VISIT" | "TIMEKEEPING_SESSION";
export type PresenceSource = {
  actorType: PresenceActorType;
  sourceType: PresenceSourceType;
  sourceId: string;
  openedAt: string;
};
export type PresenceLoadout = { version: number; slots: Record<string, string> } | null;
export type PresenceActor = {
  pinoriaSelfId: string;
  actorType: PresenceActorType;
  displayName: string;
  characterId: string | null;
  character: PinoriaCharacterConfig | null;
  loadout: PresenceLoadout;
  sources: PresenceSource[];
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
    sources,
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
