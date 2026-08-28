"use client";
/* eslint-disable @next/next/no-img-element -- House layers are pixel-registered to the canonical 1920x1080 stage. */

import { useEffect, useMemo, useRef, useState } from "react";
import savedAreas from "./ambient-house-areas.saved.json";
import savedDialogues from "./ambient-dialogues.saved.json";
import savedGraph from "./ambient-house-motion-graph.saved.json";
import {
  normalizeAmbientHorizontalLane,
  type AmbientHorizontalLane,
  type AmbientMotionGraphRaw,
} from "./ambient-house-motion-graph";
import { PinoriaStage } from "./pinoria-stage";
import { PrototypeCharacter } from "./prototype-assets";

const MINI_WIDTH = 164;
const MINI_HEIGHT = 115;
const HALF_W = MINI_WIDTH / 2;
const HALF_H = MINI_HEIGHT / 2;
const REQUIRED_OVERLAP_PX = 90;
const CONVERSATION_CENTER_GAP = MINI_WIDTH - REQUIRED_OVERLAP_PX;
const MAX_STEP_MS = 40;
const CHAT_COOLDOWN_MS = 4200;
const BLOCKER_MARGIN = 18;
const BUBBLE_WIDTH = 250;
const BUBBLE_GAP = 18;
const BUBBLE_PULL_IN_X_PX = 40;
const BUBBLE_PULL_IN_Y_PX = 40;
const GLOBAL_BUBBLE_HARD_CAP = 3;
const ZONE_BUBBLE_HARD_CAP = 1;

type ZoneId = "reception" | "artchitect" | "little-piner" | "pianohouse";
type Point = { x: number; y: number };
export type AmbientSocialSubject = {
  id: string;
  name: string;
  path: string;
  room: string;
};
type AreaSnapshot = {
  canvas: { width: number; height: number };
  areas: { id: ZoneId; label: string; points: Point[] }[];
};

const ASSET_VERSION = "ambient-house-1920-20260821-runtime-area-v1";
const ASSETS = {
  back: `/api/pinoria-prototype/ambient-house-asset?layer=back&v=${ASSET_VERSION}`,
  mid: `/api/pinoria-prototype/ambient-house-asset?layer=mid&v=${ASSET_VERSION}`,
  front: `/api/pinoria-prototype/ambient-house-asset?layer=front&v=${ASSET_VERSION}`,
};

type DialogueConfig = {
  version: number;
  maxConcurrentBubbles: number;
  conversationDurationMs: number;
  exchanges: { first: string; reply: string }[];
};

type ZoneLaneSegment = {
  zoneId: ZoneId;
  laneId: string;
  y: number;
  x1: number;
  x2: number;
  midLayer: "front" | "behind";
};

type SocialAgent = {
  id: string;
  name: string;
  zoneId: ZoneId;
  laneId: string;
  x: number;
  y: number;
  minX: number;
  maxX: number;
  direction: -1 | 1;
  speed: number;
  pauseUntil: number;
  conversationId?: string;
};

type Conversation = {
  id: string;
  zoneId: ZoneId;
  aId: string;
  bId: string;
  laneId: string;
  startedAt: number;
  until: number;
  exchangeIndex: number;
};

type WorldState = {
  agents: SocialAgent[];
  conversations: Conversation[];
};

type CooldownMap = Record<string, number>;

type Blocker = {
  conversationId: string;
  zoneId: ZoneId;
  laneId: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const GRAPH = savedGraph as AmbientMotionGraphRaw;
const AREAS = savedAreas as AreaSnapshot;
const DIALOGUES = savedDialogues as DialogueConfig;
const LANES = GRAPH.horizontalLanes.map(normalizeAmbientHorizontalLane);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function laneById(id: string) {
  return LANES.find((lane) => lane.id === id) ?? LANES[0];
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join("::");
}

function pointOnSegment(point: Point, a: Point, b: Point, epsilon = 0.75) {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > epsilon * Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))) return false;
  const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y);
  if (dot < -epsilon) return false;
  const squaredLength = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return dot <= squaredLength + epsilon;
}

function pointInPolygon(point: Point, polygon: readonly Point[]) {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const a = polygon[previousIndex];
    const b = polygon[index];
    if (pointOnSegment(point, a, b)) return true;
    const crosses = (b.y > point.y) !== (a.y > point.y);
    if (!crosses) continue;
    const x = ((a.x - b.x) * (point.y - b.y)) / (a.y - b.y) + b.x;
    if (point.x < x) inside = !inside;
  }
  return inside;
}

function zonePolygon(zoneId: ZoneId) {
  return AREAS.areas.find((area) => area.id === zoneId)?.points ?? [];
}

function inferZone(subject: AmbientSocialSubject): ZoneId {
  const value = `${subject.path} ${subject.room}`.toLocaleLowerCase("vi-VN");
  if (value.includes("artchitect") || value.includes("phòng họa") || value.includes("mỹ thuật")) return "artchitect";
  if (value.includes("piano") || value.includes("phòng đàn")) return "pianohouse";
  if (value.includes("little piner") || value.includes("mầm non")) return "little-piner";
  return "reception";
}

function laneSegmentsInZone(zoneId: ZoneId): ZoneLaneSegment[] {
  const polygon = zonePolygon(zoneId);
  if (polygon.length < 3) return [];

  return LANES.flatMap((lane) => {
    const xs = [lane.x1, lane.x2];
    for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
      const a = polygon[previousIndex];
      const b = polygon[index];
      if (Math.abs(a.y - b.y) < 0.001) continue;
      const minY = Math.min(a.y, b.y);
      const maxY = Math.max(a.y, b.y);
      if (lane.y < minY || lane.y > maxY) continue;
      const t = (lane.y - a.y) / (b.y - a.y);
      if (t < 0 || t > 1) continue;
      const x = a.x + (b.x - a.x) * t;
      if (x >= lane.x1 && x <= lane.x2) xs.push(x);
    }

    const ordered = Array.from(new Set(xs.map((x) => Math.round(x * 10) / 10))).sort((a, b) => a - b);
    const segments: ZoneLaneSegment[] = [];
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const x1 = ordered[index];
      const x2 = ordered[index + 1];
      if (x2 - x1 < MINI_WIDTH * 2 + 36) continue;
      const midpoint = { x: (x1 + x2) / 2, y: lane.y };
      if (!pointInPolygon(midpoint, polygon)) continue;
      segments.push({ zoneId, laneId: lane.id, y: lane.y, x1, x2, midLayer: lane.midLayer });
    }
    return segments;
  });
}

const ZONE_SEGMENTS: Record<ZoneId, ZoneLaneSegment[]> = {
  reception: laneSegmentsInZone("reception"),
  artchitect: laneSegmentsInZone("artchitect"),
  "little-piner": laneSegmentsInZone("little-piner"),
  pianohouse: laneSegmentsInZone("pianohouse"),
};

function preferredSegment(zoneId: ZoneId, preferredLaneIds: string[]) {
  const source = ZONE_SEGMENTS[zoneId];
  const preferred = source.filter((segment) => preferredLaneIds.includes(segment.laneId));
  return [...(preferred.length ? preferred : source)].sort((a, b) => (b.x2 - b.x1) - (a.x2 - a.x1))[0];
}

function preferredLaneIdsForZone(zoneId: ZoneId) {
  if (zoneId === "artchitect") return ["lane-04", "lane-01"];
  if (zoneId === "pianohouse") return ["lane-10", "lane-11"];
  if (zoneId === "little-piner") return ["lane-04", "lane-01", "lane-07"];
  return ["lane-01", "lane-04"];
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash);
}

function seedSubjects(subjects: readonly AmbientSocialSubject[]): SocialAgent[] {
  const grouped = new Map<ZoneId, AmbientSocialSubject[]>();
  for (const subject of subjects) {
    const zoneId = inferZone(subject);
    grouped.set(zoneId, [...(grouped.get(zoneId) ?? []), subject]);
  }

  return Array.from(grouped.entries()).flatMap(([zoneId, entries]) => {
    const segment = preferredSegment(zoneId, preferredLaneIdsForZone(zoneId));
    if (!segment) return [];
    const minX = segment.x1 + HALF_W;
    const maxX = segment.x2 - HALF_W;
    const span = Math.max(1, maxX - minX);
    return entries.map((subject, index) => {
      const hash = hashString(subject.id);
      const fraction = (index + 1) / (entries.length + 1);
      return { id: subject.id, name: subject.name, zoneId, laneId: segment.laneId, x: minX + span * fraction, y: segment.y, minX, maxX, direction: hash % 2 ? 1 : -1, speed: 68 + (hash % 13), pauseUntil: 0 } satisfies SocialAgent;
    });
  });
}

function reconcileSubjects(current: WorldState, subjects: readonly AmbientSocialSubject[]): WorldState {
  const seeded = seedSubjects(subjects);
  const previous = new Map(current.agents.map((agent) => [agent.id, agent]));
  const agents = seeded.map((seed) => {
    const existing = previous.get(seed.id);
    if (!existing || existing.zoneId !== seed.zoneId || existing.laneId !== seed.laneId) return seed;
    return { ...seed, x: clamp(existing.x, seed.minX, seed.maxX), direction: existing.direction, pauseUntil: existing.pauseUntil, conversationId: existing.conversationId };
  });
  const ids = new Set(agents.map((agent) => agent.id));
  const conversations = current.conversations.filter((conversation) => ids.has(conversation.aId) && ids.has(conversation.bId));
  return { agents, conversations };
}

function intersectsBlocker(x: number, y: number, blocker: Blocker) {
  const left = x - HALF_W;
  const right = x + HALF_W;
  const top = y - HALF_H;
  const bottom = y + HALF_H;
  return right > blocker.left && left < blocker.right && bottom > blocker.top && top < blocker.bottom;
}

function buildBlockers(agents: SocialAgent[], conversations: Conversation[]): Blocker[] {
  return conversations.flatMap((conversation) => {
    const a = agents.find((agent) => agent.id === conversation.aId);
    const b = agents.find((agent) => agent.id === conversation.bId);
    if (!a || !b) return [];
    return [{
      conversationId: conversation.id,
      zoneId: conversation.zoneId,
      laneId: conversation.laneId,
      left: Math.min(a.x, b.x) - HALF_W - BLOCKER_MARGIN,
      right: Math.max(a.x, b.x) + HALF_W + BLOCKER_MARGIN,
      top: Math.min(a.y, b.y) - HALF_H - BLOCKER_MARGIN,
      bottom: Math.max(a.y, b.y) + HALF_H + BLOCKER_MARGIN,
    }];
  });
}

function advanceWorld(current: WorldState, now: number, dt: number, cooldowns: CooldownMap): WorldState {
  const conversations = current.conversations.filter((conversation) => conversation.until > now);
  const expired = current.conversations.filter((conversation) => conversation.until <= now);
  for (const conversation of expired) {
    cooldowns[pairKey(conversation.aId, conversation.bId)] = now + CHAT_COOLDOWN_MS;
  }

  const activeIds = new Set(conversations.flatMap((conversation) => [conversation.aId, conversation.bId]));
  const blockers = buildBlockers(current.agents, conversations);

  let agents: SocialAgent[] = current.agents.map<SocialAgent>((agent) => {
    if (activeIds.has(agent.id)) return agent;
    if (now < agent.pauseUntil) return agent;

    let direction = agent.direction;
    let candidateX = agent.x + direction * agent.speed * (dt / 1000);

    if (candidateX <= agent.minX || candidateX >= agent.maxX) {
      direction = direction === 1 ? -1 : 1;
      candidateX = clamp(candidateX, agent.minX, agent.maxX);
    }

    const blocker = blockers.find((item) =>
      item.zoneId === agent.zoneId
      && item.laneId === agent.laneId
      && intersectsBlocker(candidateX, agent.y, item));
    if (blocker) {
      return {
        ...agent,
        direction: direction === 1 ? -1 : 1,
        pauseUntil: now + 420 + Math.random() * 420,
      };
    }

    return { ...agent, x: candidateX, direction };
  });

  const nextConversations = [...conversations];
  const globalBubbleCap = Math.min(GLOBAL_BUBBLE_HARD_CAP, Math.max(1, DIALOGUES.maxConcurrentBubbles));
  const activeZones = new Set(nextConversations.map((conversation) => conversation.zoneId));

  if (nextConversations.length < globalBubbleCap) {
    outer:
    for (let i = 0; i < agents.length; i += 1) {
      for (let j = i + 1; j < agents.length; j += 1) {
        const a = agents[i];
        const b = agents[j];
        if (activeIds.has(a.id) || activeIds.has(b.id)) continue;
        if (a.zoneId !== b.zoneId) continue;
        if (activeZones.has(a.zoneId)) continue;
        if (a.laneId !== b.laneId) continue;
        if (Math.abs(a.y - b.y) > 4) continue;

        const key = pairKey(a.id, b.id);
        if ((cooldowns[key] ?? 0) > now) continue;

        const distanceX = Math.abs(a.x - b.x);
        const overlapX = MINI_WIDTH - distanceX;
        const areApproaching = (a.x < b.x && a.direction === 1 && b.direction === -1)
          || (b.x < a.x && b.direction === 1 && a.direction === -1);
        if (!areApproaching || overlapX < REQUIRED_OVERLAP_PX) continue;

        const leftFirst = a.x <= b.x;
        const midpoint = (a.x + b.x) / 2;
        const leftX = midpoint - CONVERSATION_CENTER_GAP / 2;
        const rightX = midpoint + CONVERSATION_CENTER_GAP / 2;
        agents[i] = {
          ...a,
          x: leftFirst ? leftX : rightX,
          conversationId: key,
          pauseUntil: now + DIALOGUES.conversationDurationMs,
        };
        agents[j] = {
          ...b,
          x: leftFirst ? rightX : leftX,
          conversationId: key,
          pauseUntil: now + DIALOGUES.conversationDurationMs,
        };

        const exchangeIndex = Math.floor(Math.random() * Math.max(1, DIALOGUES.exchanges.length));
        nextConversations.push({
          id: key,
          zoneId: a.zoneId,
          aId: a.id,
          bId: b.id,
          laneId: a.laneId,
          startedAt: now,
          until: now + DIALOGUES.conversationDurationMs,
          exchangeIndex,
        });
        activeIds.add(a.id);
        activeIds.add(b.id);
        activeZones.add(a.zoneId);
        if (nextConversations.length >= globalBubbleCap) break outer;
      }
    }
  }

  const activeConversationIds = new Set(nextConversations.map((conversation) => conversation.id));
  agents = agents.map<SocialAgent>((agent) => agent.conversationId && !activeConversationIds.has(agent.conversationId)
    ? { ...agent, conversationId: undefined, direction: (agent.direction === 1 ? -1 : 1) as SocialAgent["direction"], pauseUntil: now + 320 }
    : agent);

  return { agents, conversations: nextConversations };
}

function zoneLabel(zoneId: ZoneId) {
  return AREAS.areas.find((area) => area.id === zoneId)?.label ?? zoneId;
}

export function AmbientSocialSimulation({ subjects = [], debug = false, hiddenSubjectId = null }: { subjects?: readonly AmbientSocialSubject[]; debug?: boolean; hiddenSubjectId?: string | null }) {
  const subjectSignature = useMemo(() => subjects.map((subject) => `${subject.id}:${subject.name}:${subject.path}:${subject.room}`).join("|"), [subjects]);
  const [world, setWorld] = useState<WorldState>(() => ({ agents: seedSubjects(subjects), conversations: [] }));
  const cooldownRef = useRef<CooldownMap>({});
  const lastFrameRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    setWorld((current) => reconcileSubjects(current, subjects));
  }, [subjectSignature, subjects]);

  useEffect(() => {
    const tick = (now: number) => {
      const previous = lastFrameRef.current ?? now;
      const dt = Math.min(MAX_STEP_MS, Math.max(0, now - previous));
      lastFrameRef.current = now;
      setWorld((current) => advanceWorld(current, now, dt, cooldownRef.current));
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      lastFrameRef.current = null;
    };
  }, []);

  const { agents, conversations } = world;
  const blockers = useMemo(() => buildBlockers(agents, conversations), [agents, conversations]);
  const activeZoneCounts = useMemo(() => conversations.reduce<Record<string, number>>((acc, conversation) => {
    acc[conversation.zoneId] = (acc[conversation.zoneId] ?? 0) + 1;
    return acc;
  }, {}), [conversations]);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#101711" }}>
      <PinoriaStage dataStage="ambient-social-sim" style={{ background: "#101711" }}>
        <img src={ASSETS.back} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 0, pointerEvents: "none" }} />

        {agents.filter((agent) => laneById(agent.laneId).midLayer === "behind").map((agent) => (
          <SocialMini key={agent.id} agent={agent} hidden={agent.id === hiddenSubjectId} />
        ))}

        <img src={ASSETS.mid} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 500000000, pointerEvents: "none" }} />

        {agents.filter((agent) => laneById(agent.laneId).midLayer === "front").map((agent) => (
          <SocialMini key={agent.id} agent={agent} hidden={agent.id === hiddenSubjectId} />
        ))}

        <img src={ASSETS.front} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 1100000000, pointerEvents: "none" }} />

        <svg
          aria-hidden="true"
          viewBox="0 0 1920 1080"
          style={{ display: debug ? undefined : "none", position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 1130000000, pointerEvents: "none", opacity: .34 }}
        >
          {AREAS.areas.map((area) => (
            <g key={area.id}>
              <polygon
                points={area.points.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="rgba(245,233,181,.035)"
                stroke="rgba(245,233,181,.7)"
                strokeWidth="2"
                strokeDasharray="8 8"
              />
              <text
                x={area.points.reduce((sum, point) => sum + point.x, 0) / Math.max(1, area.points.length)}
                y={area.points.reduce((sum, point) => sum + point.y, 0) / Math.max(1, area.points.length)}
                textAnchor="middle"
                fill="rgba(255,246,208,.88)"
                fontSize="18"
                fontWeight="700"
              >
                {area.label}
              </text>
            </g>
          ))}
        </svg>

        {conversations.filter((conversation) => conversation.aId !== hiddenSubjectId && conversation.bId !== hiddenSubjectId).slice(0, GLOBAL_BUBBLE_HARD_CAP).map((conversation) => {
          const a = agents.find((agent) => agent.id === conversation.aId);
          const b = agents.find((agent) => agent.id === conversation.bId);
          if (!a || !b) return null;
          const exchange = DIALOGUES.exchanges[conversation.exchangeIndex % DIALOGUES.exchanges.length] ?? DIALOGUES.exchanges[0];
          if (!exchange) return null;

          const duration = Math.max(1, conversation.until - conversation.startedAt);
          const progress = clamp((performance.now() - conversation.startedAt) / duration, 0, 1);
          const firstTurn = progress < .5;
          const speaker = firstTurn ? a : b;
          const listener = firstTurn ? b : a;
          const text = firstTurn ? exchange.first : exchange.reply;
          const speakerIsLeft = speaker.x < listener.x;
          const desiredLeft = speakerIsLeft
            ? speaker.x - HALF_W - BUBBLE_GAP - BUBBLE_WIDTH + BUBBLE_PULL_IN_X_PX
            : speaker.x + HALF_W + BUBBLE_GAP - BUBBLE_PULL_IN_X_PX;
          const bubbleLeft = clamp(desiredLeft, 18, 1920 - BUBBLE_WIDTH - 18);
          const bubbleTop = clamp(speaker.y - 126 + BUBBLE_PULL_IN_Y_PX, 28, 1080 - 150);

          return (
            <div
              key={`${conversation.id}:${firstTurn ? "first" : "reply"}`}
              data-ambient-chat-bubble={speaker.id}
              data-ambient-chat-zone={conversation.zoneId}
              style={{
                position: "absolute",
                left: bubbleLeft,
                top: bubbleTop,
                zIndex: 1150000000 + Math.round(Math.max(a.y, b.y) * 1000),
                width: BUBBLE_WIDTH,
                padding: "11px 13px",
                borderRadius: 17,
                background: "rgba(255,255,250,.97)",
                color: "#243126",
                border: "1px solid rgba(42,61,45,.14)",
                boxShadow: "0 16px 38px rgba(0,0,0,.22)",
                fontSize: 14,
                lineHeight: 1.3,
                pointerEvents: "none",
              }}
            >
              <strong style={{ display: "block", fontSize: 11, marginBottom: 5, color: "#657266" }}>
                {speaker.name} · {zoneLabel(conversation.zoneId)}
              </strong>
              <span style={{ display: "block" }}>{text}</span>
              <i
                style={{
                  position: "absolute",
                  [speakerIsLeft ? "right" : "left"]: -7,
                  bottom: 22,
                  width: 14,
                  height: 14,
                  background: "rgba(255,255,250,.97)",
                  transform: "rotate(45deg)",
                  borderTop: speakerIsLeft ? "1px solid rgba(42,61,45,.10)" : undefined,
                  borderRight: speakerIsLeft ? "1px solid rgba(42,61,45,.10)" : undefined,
                  borderBottom: !speakerIsLeft ? "1px solid rgba(42,61,45,.10)" : undefined,
                  borderLeft: !speakerIsLeft ? "1px solid rgba(42,61,45,.10)" : undefined,
                }}
              />
            </div>
          );
        })}

        {debug ? <div style={{ display: debug ? undefined : "none", position: "absolute", left: 18, top: 18, zIndex: 1200000000, padding: "9px 11px", borderRadius: 10, background: "rgba(10,16,11,.76)", color: "#e7eee8", fontSize: 11, lineHeight: 1.45, backdropFilter: "blur(8px)" }}>
          <strong style={{ display: "block" }}>SOCIAL SIM · ZONE BOUNDARY</strong>
          <span>{conversations.length}/{Math.min(GLOBAL_BUBBLE_HARD_CAP, DIALOGUES.maxConcurrentBubbles)} bubble · {blockers.length} blocker · overlap {REQUIRED_OVERLAP_PX}px</span>
          <span style={{ display: "block", opacity: .72 }}>
            Artchitect {activeZoneCounts.artchitect ?? 0}/{ZONE_BUBBLE_HARD_CAP} · Piano {activeZoneCounts.pianohouse ?? 0}/{ZONE_BUBBLE_HARD_CAP} · Little Piner {activeZoneCounts["little-piner"] ?? 0}/{ZONE_BUBBLE_HARD_CAP}
          </span>
        </div> : null}
      </PinoriaStage>
    </div>
  );
}

function SocialMini({ agent, hidden = false }: { agent: SocialAgent; hidden?: boolean }) {
  const lane = laneById(agent.laneId);
  const localZ = Math.round(agent.y * 100) * 4096 + Math.round(agent.x) * 2;
  const zIndex = (lane.midLayer === "behind" ? 1000 : 600000000) + localZ;
  return (
    <div
      data-ambient-runtime-character={agent.id}
      data-ambient-social-agent
      data-ambient-social-zone={agent.zoneId}
      data-ambient-social-conversation={agent.conversationId ?? ""}
      style={{
        display: hidden ? "none" : undefined,
        position: "absolute",
        left: agent.x - HALF_W,
        top: agent.y - HALF_H,
        width: MINI_WIDTH,
        height: MINI_HEIGHT,
        zIndex,
        pointerEvents: "none",
      }}
    >
      <div
        data-ambient-mini-character
        data-ambient-mini-body="on"
        style={{ position: "absolute", inset: 0, ["--ambient-mini-name" as string]: JSON.stringify(agent.name) }}
      >
        <PrototypeCharacter subjectId={agent.id} size={164} wingMotion="off" />
      </div>
    </div>
  );
}