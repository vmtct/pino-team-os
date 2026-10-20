"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import graphData from "./ambient-house-motion-graph.saved.json";
import { LayeredCharacter, type PinoriaCharacterConfig, type PinoriaWardRender } from "./layered-character";
import { resolvePinoriaEffectPresentation } from "../../lib/pinoria-effect-presentation";
import {
  reconcileAmbientAgents,
  stepAmbientAgents,
  type AmbientAgent,
  type AmbientMotionGraph,
} from "./ambient-house-motion";
import styles from "./ambient-house.module.css";
import { resolveAmbientHouseArea, type AmbientHouseArea } from "./ambient-house-area";
import type { PresenceExperience } from "./presence-contract";

export type AmbientHouseActor = {
  id: string;
  actorType: "LEARNER" | "STAFF";
  name: string;
  config: PinoriaCharacterConfig | null;
  wardRender?: PinoriaWardRender | null;
  effectKey?: string | null;
  experience?: PresenceExperience;
};

const SAVED_GRAPH = graphData as AmbientMotionGraph;
const NO_APPROVED_AREAS: readonly AmbientHouseArea[] = [];
export const HOUSE_ASSETS = {
  back: "https://assets.pinohouse.art/draft/HouseBack.png",
  mid: "https://assets.pinohouse.art/draft/HouseMid.png",
  front: "https://assets.pinohouse.art/draft/HouseFront.png",
} as const;
export function AmbientHouseRuntime({ actors, areas = NO_APPROVED_AREAS, motionGraph, emergencePins = [], departingId = null, suppressedIds = [], frozenIds = [] }: { actors: readonly AmbientHouseActor[]; areas?: readonly AmbientHouseArea[]; motionGraph?: AmbientMotionGraph | null; emergencePins?: readonly {id:string;areaId:string;laneId:string;x:number;y:number}[]; departingId?: string | null; suppressedIds?: readonly string[]; frozenIds?: readonly string[] }) {
  const GRAPH = motionGraph ?? SAVED_GRAPH;
  const idsKey = actors.map((actor) => actor.id).sort().join("|");
  const byId = useMemo(() => new Map(actors.map((actor) => [actor.id, actor])), [actors]);
  // Areas are supplied by an explicitly approved House configuration.
  // No mapping is inferred from labels or sample data; empty config safely uses global routing.
  // Stabilize the semantic routing snapshot, not the parent actor-array identity:
  // presence polling can replace actor objects without changing any approved area.
  const resolvedLaneKey = JSON.stringify(actors.flatMap((actor) => {
    const result = resolveAmbientHouseArea(actor.experience ?? null, GRAPH, areas);
    return result.kind === "AREA" ? [[actor.id, result.laneIds] as const] : [];
  }).sort(([a], [b]) => a.localeCompare(b)));
  const preferredLaneIds = useMemo(
    () => new Map<string, readonly string[]>(JSON.parse(resolvedLaneKey) as [string, string[]][]),
    [resolvedLaneKey],
  );
  const emergenceKey = JSON.stringify(actors.flatMap((actor) => {
    const resolved = resolveAmbientHouseArea(actor.experience ?? null, GRAPH, areas);
    if (resolved.kind !== "AREA") return [];
    return [[actor.id, emergencePins.filter((pin) => pin.areaId === resolved.areaId)
      .map((pin) => ({laneId:pin.laneId,x:pin.x}))] as const];
  }).sort(([a],[b]) => a.localeCompare(b)));
  const preferredEmergencePins = useMemo(() =>
    new Map<string, readonly {laneId:string;x:number}[]>(JSON.parse(emergenceKey) as [string,{laneId:string;x:number}[]][]),
    [emergenceKey]);
  const speedMultipliers = useMemo(() => new Map(actors.map((actor) => [actor.id, resolvePinoriaEffectPresentation(actor.effectKey)?.speedMultiplier ?? 1])), [actors]);
  const departing = useMemo(() => new Set(departingId ? [departingId] : []), [departingId]);
  const suppressed = new Set(suppressedIds);
  const frozenKey = JSON.stringify(frozenIds);
  const [agents, setAgents] = useState<AmbientAgent[]>(() => reconcileAmbientAgents([], actors.map((actor) => actor.id), GRAPH, preferredLaneIds, preferredEmergencePins));
  const previousFrame = useRef<number | null>(null);
  const lastCommit = useRef(0);

  useEffect(() => {
    const desiredIds = idsKey ? idsKey.split("|") : [];
    setAgents((current) => reconcileAmbientAgents(current, desiredIds, GRAPH, preferredLaneIds, preferredEmergencePins));
    previousFrame.current = null;
  }, [idsKey, resolvedLaneKey, preferredLaneIds, preferredEmergencePins, GRAPH]);

  useEffect(() => {
    const frozen = new Set(JSON.parse(frozenKey) as string[]);
    let frame = 0;
    const tick = (now: number) => {
      const previous = previousFrame.current ?? now;
      previousFrame.current = now;
      if (now - lastCommit.current >= 40) {
        const elapsed = now - previous;
        setAgents((current) => stepAmbientAgents(current, GRAPH, elapsed, { departingIds: departing, frozenIds: frozen, speedMultipliers, preferredLaneIds }));
        lastCommit.current = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [departing, frozenKey, speedMultipliers, resolvedLaneKey, preferredLaneIds, GRAPH]);

  const behind = agents.filter((agent) => agent.depth === "behind");
  const front = agents.filter((agent) => agent.depth === "front");
  const renderAgent = (agent: AmbientAgent) => {
    const actor = byId.get(agent.id);
    if (!actor) return null;
    const effect = resolvePinoriaEffectPresentation(actor.effectKey);
    const scale = (0.72 + (agent.y / GRAPH.canvas.height) * 0.28) * (effect?.houseScale ?? 1);
    const style = {
      left: `${(agent.x / GRAPH.canvas.width) * 100}%`,
      top: `${(agent.y / GRAPH.canvas.height) * 100}%`,
      "--agent-scale": `${scale}`,
    } as CSSProperties;
    return <div key={agent.id} className={styles.agent} style={style} data-pinoria-effect={effect?.key ?? ""} data-effect-speed={effect?.speedMultiplier ?? 1} data-ambient-runtime-character={agent.id} data-ambient-runtime-self={agent.id} data-ambient-runtime-actor-type={actor.actorType} data-suppressed={suppressed.has(agent.id) ? "true" : "false"} data-lane={agent.laneId} data-motion-state={agent.motionState} data-connector={agent.connectorId ?? ""} data-departing={departing.has(agent.id) ? "true" : "false"}>
      <LayeredCharacter className={styles.character} config={actor.config ?? {}} wardRender={actor.wardRender} effectKey={actor.effectKey} effectSurface="HOUSE_MINI" />
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
