"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import graphData from "./ambient-house-motion-graph.saved.json";
import { LayeredCharacter, type PinoriaCharacterConfig } from "./layered-character";
import {
  createAmbientAgents,
  reconcileAmbientAgents,
  stepAmbientAgents,
  type AmbientAgent,
  type AmbientMotionGraph,
} from "./ambient-house-motion";
import styles from "./ambient-house.module.css";

export type AmbientHouseActor = {
  id: string;
  actorType: "LEARNER" | "STAFF";
  name: string;
  config: PinoriaCharacterConfig | null;
};

const GRAPH = graphData as AmbientMotionGraph;
const HOUSE_ASSETS = {
  back: "https://assets.pinohouse.art/draft/HouseBack.png",
  mid: "https://assets.pinohouse.art/draft/HouseMid.png",
  front: "https://assets.pinohouse.art/draft/HouseFront.png",
} as const;
export function AmbientHouseRuntime({ actors, departingId = null, suppressedIds = [], frozenIds = [] }: { actors: readonly AmbientHouseActor[]; departingId?: string | null; suppressedIds?: readonly string[]; frozenIds?: readonly string[] }) {
  const idsKey = actors.map((actor) => actor.id).sort().join("|");
  const byId = useMemo(() => new Map(actors.map((actor) => [actor.id, actor])), [actors]);
  const departing = useMemo(() => new Set(departingId ? [departingId] : []), [departingId]);
  const suppressed = new Set(suppressedIds);
  const frozenKey = JSON.stringify(frozenIds);
  const [agents, setAgents] = useState<AmbientAgent[]>(() => createAmbientAgents(actors.map((actor) => actor.id), GRAPH));
  const previousFrame = useRef<number | null>(null);
  const lastCommit = useRef(0);

  useEffect(() => {
    const desiredIds = idsKey ? idsKey.split("|") : [];
    setAgents((current) => reconcileAmbientAgents(current, desiredIds, GRAPH));
    previousFrame.current = null;
  }, [idsKey]);

  useEffect(() => {
    const frozen = new Set(JSON.parse(frozenKey) as string[]);
    let frame = 0;
    const tick = (now: number) => {
      const previous = previousFrame.current ?? now;
      previousFrame.current = now;
      if (now - lastCommit.current >= 40) {
        const elapsed = now - previous;
        setAgents((current) => stepAmbientAgents(current, GRAPH, elapsed, { departingIds: departing, frozenIds: frozen }));
        lastCommit.current = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [departing, frozenKey]);

  const behind = agents.filter((agent) => agent.depth === "behind");
  const front = agents.filter((agent) => agent.depth === "front");
  const renderAgent = (agent: AmbientAgent) => {
    const actor = byId.get(agent.id);
    if (!actor) return null;
    const scale = 0.72 + (agent.y / GRAPH.canvas.height) * 0.28;
    const style = {
      left: `${(agent.x / GRAPH.canvas.width) * 100}%`,
      top: `${(agent.y / GRAPH.canvas.height) * 100}%`,
      "--agent-scale": `${scale}`,
    } as CSSProperties;
    return <div key={agent.id} className={styles.agent} style={style} data-ambient-runtime-character={agent.id} data-ambient-runtime-self={agent.id} data-ambient-runtime-actor-type={actor.actorType} data-suppressed={suppressed.has(agent.id) ? "true" : "false"} data-lane={agent.laneId} data-motion-state={agent.motionState} data-connector={agent.connectorId ?? ""} data-departing={departing.has(agent.id) ? "true" : "false"}>
      <LayeredCharacter className={styles.character} config={actor.config ?? {}} />
      <span>{actor.name}</span>
    </div>;
  };

  return <div className={styles.viewport} aria-label={`${actors.length} actors moving in Pinoria House`}>
    <img className={`${styles.houseLayer} ${styles.back}`} src={HOUSE_ASSETS.back} alt="" />
    <div className={`${styles.agentPlane} ${styles.behind}`}>{behind.map(renderAgent)}</div>
    <img className={`${styles.houseLayer} ${styles.mid}`} src={HOUSE_ASSETS.mid} alt="" />
    <div className={`${styles.agentPlane} ${styles.front}`}>{front.map(renderAgent)}</div>
    <img className={`${styles.houseLayer} ${styles.houseFront}`} src={HOUSE_ASSETS.front} alt="" />
  </div>;
}
