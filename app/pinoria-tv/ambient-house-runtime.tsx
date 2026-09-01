"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import graphData from "./ambient-house-motion-graph.saved.json";
import { LayeredCharacter, type PinoriaCharacterConfig } from "./layered-character";
import {
  createAmbientAgents,
  stepAmbientAgents,
  type AmbientAgent,
  type AmbientMotionGraph,
} from "./ambient-house-motion";
import styles from "./ambient-house.module.css";

export type AmbientHouseLearner = {
  id: string;
  name: string;
  config: PinoriaCharacterConfig;
};

const GRAPH = graphData as AmbientMotionGraph;
const HOUSE_ASSETS = {
  back: "https://assets.pinohouse.art/draft/HouseBack.png",
  mid: "https://assets.pinohouse.art/draft/HouseMid.png",
  front: "https://assets.pinohouse.art/draft/HouseFront.png",
} as const;
export function AmbientHouseRuntime({ learners, departingId = null }: { learners: readonly AmbientHouseLearner[]; departingId?: string | null }) {
  const idsKey = learners.map((learner) => learner.id).sort().join("|");
  const byId = useMemo(() => new Map(learners.map((learner) => [learner.id, learner])), [learners]);
  const departing = useMemo(() => new Set(departingId ? [departingId] : []), [departingId]);
  const [agents, setAgents] = useState<AmbientAgent[]>(() => createAmbientAgents(learners.map((learner) => learner.id), GRAPH));
  const previousFrame = useRef<number | null>(null);
  const lastCommit = useRef(0);

  useEffect(() => {
    setAgents(createAmbientAgents(learners.map((learner) => learner.id), GRAPH));
    previousFrame.current = null;
  }, [idsKey, learners]);

  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      const previous = previousFrame.current ?? now;
      previousFrame.current = now;
      if (now - lastCommit.current >= 40) {
        const elapsed = now - previous;
        setAgents((current) => stepAmbientAgents(current, GRAPH, elapsed, { departingIds: departing }));
        lastCommit.current = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [departing]);

  const behind = agents.filter((agent) => agent.depth === "behind");
  const front = agents.filter((agent) => agent.depth === "front");
  const renderAgent = (agent: AmbientAgent) => {
    const learner = byId.get(agent.id);
    if (!learner) return null;
    const scale = 0.72 + (agent.y / GRAPH.canvas.height) * 0.28;
    const style = {
      left: `${(agent.x / GRAPH.canvas.width) * 100}%`,
      top: `${(agent.y / GRAPH.canvas.height) * 100}%`,
      "--agent-scale": `${scale}`,
    } as CSSProperties;
    return <div key={agent.id} className={styles.agent} style={style} data-lane={agent.laneId} data-motion-state={agent.motionState} data-connector={agent.connectorId ?? ""} data-departing={departing.has(agent.id) ? "true" : "false"}>
      <LayeredCharacter className={styles.character} config={learner.config} />
      <span>{learner.name}</span>
    </div>;
  };

  return <div className={styles.viewport} aria-label={`${learners.length} learners moving in Pinoria House`}>
    <img className={`${styles.houseLayer} ${styles.back}`} src={HOUSE_ASSETS.back} alt="" />
    <div className={`${styles.agentPlane} ${styles.behind}`}>{behind.map(renderAgent)}</div>
    <img className={`${styles.houseLayer} ${styles.mid}`} src={HOUSE_ASSETS.mid} alt="" />
    <div className={`${styles.agentPlane} ${styles.front}`}>{front.map(renderAgent)}</div>
    <img className={`${styles.houseLayer} ${styles.houseFront}`} src={HOUSE_ASSETS.front} alt="" />
  </div>;
}
