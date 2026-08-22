"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
const MAX_STEP_MS = 40;
const CHAT_COOLDOWN_MS = 4200;
const BLOCKER_MARGIN = 18;

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

type SocialAgent = {
  id: string;
  name: string;
  laneId: string;
  x: number;
  y: number;
  direction: -1 | 1;
  speed: number;
  pauseUntil: number;
  conversationId?: string;
};

type Conversation = {
  id: string;
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
  laneId: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const GRAPH = savedGraph as AmbientMotionGraphRaw;
const DIALOGUES = savedDialogues as DialogueConfig;
const LANES = GRAPH.horizontalLanes.map(normalizeAmbientHorizontalLane);

function laneById(id: string) {
  return LANES.find((lane) => lane.id === id) ?? LANES[0];
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join("::");
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
      laneId: conversation.laneId,
      left: Math.min(a.x, b.x) - HALF_W - BLOCKER_MARGIN,
      right: Math.max(a.x, b.x) + HALF_W + BLOCKER_MARGIN,
      top: Math.min(a.y, b.y) - HALF_H - BLOCKER_MARGIN,
      bottom: Math.max(a.y, b.y) + HALF_H + BLOCKER_MARGIN,
    }];
  });
}

function seedAgents(): SocialAgent[] {
  const laneA = laneById("lane-04") ?? LANES[0];
  const laneB = laneById("lane-01") ?? LANES[1] ?? LANES[0];
  const safe = (lane: AmbientHorizontalLane, ratio: number) => lane.x1 + (lane.x2 - lane.x1) * ratio;
  return [
    { id: "bo", name: "Bơ", laneId: laneA.id, x: safe(laneA, .18), y: laneA.y, direction: 1, speed: 78, pauseUntil: 0 },
    { id: "mai", name: "Mai", laneId: laneA.id, x: safe(laneA, .82), y: laneA.y, direction: -1, speed: 72, pauseUntil: 0 },
    { id: "lan", name: "Lan", laneId: laneA.id, x: safe(laneA, .04), y: laneA.y, direction: 1, speed: 66, pauseUntil: 0 },
    { id: "tri", name: "Trí", laneId: laneB.id, x: safe(laneB, .12), y: laneB.y, direction: 1, speed: 82, pauseUntil: 0 },
    { id: "an", name: "An", laneId: laneB.id, x: safe(laneB, .88), y: laneB.y, direction: -1, speed: 76, pauseUntil: 0 },
  ];
}

function advanceWorld(current: WorldState, now: number, dt: number, cooldowns: CooldownMap): WorldState {
  const conversations = current.conversations.filter((conversation) => conversation.until > now);
  const expired = current.conversations.filter((conversation) => conversation.until <= now);
  for (const conversation of expired) {
    cooldowns[pairKey(conversation.aId, conversation.bId)] = now + CHAT_COOLDOWN_MS;
  }

  const activeIds = new Set(conversations.flatMap((conversation) => [conversation.aId, conversation.bId]));
  const blockers = buildBlockers(current.agents, conversations);

  let agents = current.agents.map((agent) => {
    if (activeIds.has(agent.id)) return agent;
    if (now < agent.pauseUntil) return agent;

    const lane = laneById(agent.laneId);
    const minX = lane.x1 + HALF_W;
    const maxX = lane.x2 - HALF_W;
    let direction = agent.direction;
    let candidateX = agent.x + direction * agent.speed * (dt / 1000);

    if (candidateX <= minX || candidateX >= maxX) {
      direction = direction === 1 ? -1 : 1;
      candidateX = Math.max(minX, Math.min(maxX, candidateX));
    }

    const blocker = blockers.find((item) => item.laneId === agent.laneId && intersectsBlocker(candidateX, agent.y, item));
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
  const maxBubbles = Math.min(3, Math.max(1, DIALOGUES.maxConcurrentBubbles));

  if (nextConversations.length < maxBubbles) {
    outer:
    for (let i = 0; i < agents.length; i += 1) {
      for (let j = i + 1; j < agents.length; j += 1) {
        const a = agents[i];
        const b = agents[j];
        if (activeIds.has(a.id) || activeIds.has(b.id)) continue;
        if (a.laneId !== b.laneId) continue;
        if (Math.abs(a.y - b.y) > 4) continue;

        const key = pairKey(a.id, b.id);
        if ((cooldowns[key] ?? 0) > now) continue;

        const distanceX = Math.abs(a.x - b.x);
        const areApproaching = (a.x < b.x && a.direction === 1 && b.direction === -1)
          || (b.x < a.x && b.direction === 1 && a.direction === -1);
        if (!areApproaching || distanceX > MINI_WIDTH + 6) continue;

        const leftFirst = a.x <= b.x;
        const midpoint = (a.x + b.x) / 2;
        const leftX = midpoint - HALF_W;
        const rightX = midpoint + HALF_W;
        agents[i] = { ...a, x: leftFirst ? leftX : rightX, conversationId: key, pauseUntil: now + DIALOGUES.conversationDurationMs };
        agents[j] = { ...b, x: leftFirst ? rightX : leftX, conversationId: key, pauseUntil: now + DIALOGUES.conversationDurationMs };

        const exchangeIndex = Math.floor(Math.random() * Math.max(1, DIALOGUES.exchanges.length));
        nextConversations.push({
          id: key,
          aId: a.id,
          bId: b.id,
          laneId: a.laneId,
          startedAt: now,
          until: now + DIALOGUES.conversationDurationMs,
          exchangeIndex,
        });
        activeIds.add(a.id);
        activeIds.add(b.id);
        if (nextConversations.length >= maxBubbles) break outer;
      }
    }
  }

  const activeConversationIds = new Set(nextConversations.map((conversation) => conversation.id));
  agents = agents.map((agent) => agent.conversationId && !activeConversationIds.has(agent.conversationId)
    ? { ...agent, conversationId: undefined, direction: agent.direction === 1 ? -1 : 1, pauseUntil: now + 320 }
    : agent);

  return { agents, conversations: nextConversations };
}

export function AmbientSocialSimulation() {
  const [world, setWorld] = useState<WorldState>(() => ({ agents: seedAgents(), conversations: [] }));
  const cooldownRef = useRef<CooldownMap>({});
  const lastFrameRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

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

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#101711" }}>
      <PinoriaStage dataStage="ambient-social-sim" style={{ background: "#101711" }}>
        <img src={ASSETS.back} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 0, pointerEvents: "none" }} />

        {agents.filter((agent) => laneById(agent.laneId).midLayer === "behind").map((agent) => (
          <SocialMini key={agent.id} agent={agent} />
        ))}

        <img src={ASSETS.mid} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 500000000, pointerEvents: "none" }} />

        {agents.filter((agent) => laneById(agent.laneId).midLayer === "front").map((agent) => (
          <SocialMini key={agent.id} agent={agent} />
        ))}

        {conversations.slice(0, 3).map((conversation) => {
          const a = agents.find((agent) => agent.id === conversation.aId);
          const b = agents.find((agent) => agent.id === conversation.bId);
          if (!a || !b) return null;
          const exchange = DIALOGUES.exchanges[conversation.exchangeIndex % DIALOGUES.exchanges.length] ?? DIALOGUES.exchanges[0];
          const centerX = (a.x + b.x) / 2;
          const topY = Math.min(a.y, b.y) - 150;
          return (
            <div
              key={conversation.id}
              data-ambient-chat-bubble
              style={{
                position: "absolute",
                left: centerX,
                top: topY,
                zIndex: 1000000000 + Math.round(Math.max(a.y, b.y) * 1000),
                width: 300,
                transform: "translateX(-50%)",
                padding: "12px 14px",
                borderRadius: 18,
                background: "rgba(255,255,250,.96)",
                color: "#243126",
                border: "1px solid rgba(42,61,45,.14)",
                boxShadow: "0 16px 38px rgba(0,0,0,.22)",
                fontSize: 14,
                lineHeight: 1.3,
                pointerEvents: "none",
              }}
            >
              <strong style={{ display: "block", fontSize: 12, marginBottom: 5 }}>{a.name}</strong>
              <span style={{ display: "block" }}>{exchange.first}</span>
              <span style={{ display: "block", marginTop: 7, color: "#5b695d", fontSize: 12 }}><b>{b.name}:</b> {exchange.reply}</span>
              <i style={{ position: "absolute", left: "50%", bottom: -8, width: 16, height: 16, background: "rgba(255,255,250,.96)", transform: "translateX(-50%) rotate(45deg)", borderRight: "1px solid rgba(42,61,45,.10)", borderBottom: "1px solid rgba(42,61,45,.10)" }} />
            </div>
          );
        })}

        <img src={ASSETS.front} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, zIndex: 1100000000, pointerEvents: "none" }} />

        <div style={{ position: "absolute", left: 18, top: 18, zIndex: 1200000000, padding: "8px 10px", borderRadius: 10, background: "rgba(10,16,11,.72)", color: "#e7eee8", fontSize: 11, lineHeight: 1.4, backdropFilter: "blur(8px)" }}>
          <strong style={{ display: "block" }}>SOCIAL SIM</strong>
          <span>{conversations.length} convo · {blockers.length} blocker · max {Math.min(3, DIALOGUES.maxConcurrentBubbles)} bubble</span>
        </div>
      </PinoriaStage>
    </div>
  );
}

function SocialMini({ agent }: { agent: SocialAgent }) {
  const lane = laneById(agent.laneId);
  const localZ = Math.round(agent.y * 100) * 4096 + Math.round(agent.x) * 2;
  const zIndex = (lane.midLayer === "behind" ? 1000 : 600000000) + localZ;
  return (
    <div
      data-ambient-runtime-character={agent.id}
      data-ambient-social-agent
      data-ambient-social-conversation={agent.conversationId ?? ""}
      style={{
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
