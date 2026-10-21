"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {parseDialogueConfig,type DialogueConfig} from "../../lib/pap657-dialogue-config";
import { LayeredCharacter, pinoriaAssetUrl, type PinoriaCharacterConfig } from "./layered-character";
import { WardSessionTv } from "./ward-session-tv";
import { AmbientHouseRuntime, HOUSE_ASSETS } from "./ambient-house-runtime";
import type { AmbientHouseArea } from "./ambient-house-area";
import savedSpatialGraph from "./ambient-house-motion-graph.saved.json";
import type { AmbientMotionGraph } from "./ambient-house-motion";
import {parsePublishedHouseSpatialConfig,reconcileHouseSpatialRefresh,type HouseSpatialRefresh} from "../../lib/pinoria-house-spatial-runtime";
import {assetStatusFromEvidence,recordAssetFailure,type AssetEvidence} from "../../lib/pap659-asset-observation";
import {fetchBuildManifestProvenance} from "../../lib/pap659-build-provenance-client";
import {observedRuntimeFacts} from "../../lib/pap659-runtime-facts";
import {makeRuntimeObservation,sendRuntimeObservation} from "../../lib/pap659-runtime-observation-client";
import {readAppliedSpatialRevision} from "../../lib/pinoria-house-spatial-runtime";

import { advanceHouseSnapshotCursor, housePresenceSceneIsCurrent, houseRefreshSnapshotIsCurrent, selectUnseenHouseEvents } from "./house-event-sequence";
import { actorFromArrival, actorHasSource, parsePresenceEventPage, parsePresenceSnapshot, type PresenceActor, type PresenceActorType, type PresenceEvent, type PresenceSourceType } from "./presence-contract";
import { claimPresentation, completePresentation, presentationStatus, shouldReleaseTvScene, isCurrentTvPresentationClaim, completionAlreadyReleased } from "./presentation-client";
import { WishRevealScene, wishRevealSceneMs } from "./wish-reveal-scene";
import type { PinoriaPresentation } from "./presentation-types";
import { pollPendingReplay, loadReplayProjection, acknowledgeRenderedReplay, type PendingTvReplay } from "./replay-runtime-client";
import { acceptsTvReplayInstruction } from "./replay-command-guard";
import { EggHatchScene, EGG_HATCH_SCENE_MS } from "./egg-hatch-scene";
import { CompanionRitualScene, COMPANION_RITUAL_SCENE_MS } from "./companion-ritual-scene";
import { OnboardingCeremonyScene, OnboardingPreviewScene, ONBOARDING_CEREMONY_SCENE_MS } from "./onboarding-ceremony-scene";
import type { OnboardingPreview } from "./onboarding-ceremony-types";
import { eligibleTvEvent, readSafeTvPolicy, displayNameForSharedTv, defaultSharedTvPolicy, redactTvPresentationName } from "@/lib/pinoria-tv-policy-runtime";
import styles from "./reception-tv.module.css";


type Scene = {
  id: string;
  kind: "arrival" | "departure";
  name: string;
  occurredAt: string;
  config: PinoriaCharacterConfig;
  actorType: PresenceActorType;
  pinoriaSelfId: string;
  sourceType: PresenceSourceType;
  sourceId: string;
  phase: "transition" | "performance" | "handoff";
};

const CENTER_STORAGE = "pino.arrival.centerId";
const ARRIVAL_PERFORMANCE_MS = 5200;
const ARRIVAL_HANDOFF_MS = 1800;
const DEPARTURE_TRANSITION_MS = 1200;
const DEPARTURE_PERFORMANCE_MS = 5200;

export function ReceptionTv({ fixedCenterId, apiBase = "/api/pinoria-tv", approvedHouseAreas, runtimeIdentity }: { fixedCenterId?: string; apiBase?: string; approvedHouseAreas?: readonly AmbientHouseArea[]; runtimeIdentity?: {displayId:string;sessionId:string;deviceId:string|null} } = {}) {
  const [centerId, setCenterId] = useState("");
  const [spatial,setSpatial]=useState<HouseSpatialRefresh>({active:null,pending:null});
  const [assetEvidence,setAssetEvidence]=useState<AssetEvidence>({failedAssetIds:[]});
  // Asset failures belong to a single authenticated TV session, not the next device session.
  useEffect(()=>{setAssetEvidence({failedAssetIds:[]});},[runtimeIdentity?.sessionId]);
  const observedAssetStatus=assetStatusFromEvidence(assetEvidence);
  const [manifestDigest,setManifestDigest]=useState<string|null>(null);
  useEffect(()=>{
    let cancelled=false;
    setManifestDigest(null);
    if(!runtimeIdentity?.sessionId)return;
    void fetchBuildManifestProvenance().then(value=>{if(!cancelled)setManifestDigest(value);});
    return()=>{cancelled=true;};
  },[runtimeIdentity?.sessionId]);
  const liveActorCountRef=useRef(0);
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState(false);
  const [inside, setInside] = useState<PresenceActor[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [presentation, setPresentation] = useState<PinoriaPresentation | null>(null);
  const activePresentationIdRef = useRef<string | null>(null);
  activePresentationIdRef.current = presentation?.id ?? null;
  const runtimeDisplayId=runtimeIdentity?.displayId ?? "";
  const runtimeSessionId=runtimeIdentity?.sessionId ?? "";
  const runtimeDeviceId=runtimeIdentity?.deviceId ?? null;
  const appliedRevision=readAppliedSpatialRevision(spatial);
  useEffect(()=>{
    if(!runtimeSessionId||!runtimeDisplayId||!runtimeDeviceId)return;
    const observation=makeRuntimeObservation({sessionId:runtimeSessionId,displayId:runtimeDisplayId,deviceId:runtimeDeviceId},observedRuntimeFacts({buildDigest:manifestDigest,appliedConfigRevision:appliedRevision,assetEvidence}));
    if(!observation)return;
    // A session-bound report only; Core retains rendererAcknowledged:false until actual render proof.
    // Core considers observations stale after 30s; keep a 15s heartbeat while mounted.
    // The same strictly validated report is renewed without fabricating render ACK.
    let inFlight=false;
    const report=async()=>{if(inFlight)return;inFlight=true;try{await sendRuntimeObservation(`${apiBase}/observation`,observation);}finally{inFlight=false;}};
    void report();
    const timer=window.setInterval(()=>void report(),15000);
    return()=>window.clearInterval(timer);
  },[runtimeSessionId,runtimeDisplayId,runtimeDeviceId,manifestDigest,appliedRevision,assetEvidence,apiBase]);
  const [replayFrame, setReplayFrame] = useState<{command:PendingTvReplay;generation:number}|null>(null);
  const replayBusy = useRef(false);
  const replayLastRevision = useRef(0);
  const replayLoadedCommand = useRef("");
  const [replaySceneKey, setReplaySceneKey] = useState("");
  const [replayedPresentationId, setReplayedPresentationId] = useState("");
  const replayScope = useRef("");
  const [onboardingPreview, setOnboardingPreview] = useState<OnboardingPreview | null>(null);
  const [policy,setPolicy] = useState(defaultSharedTvPolicy);
  const [publishedDialogue,setPublishedDialogue] = useState<DialogueConfig|null>(null);
  useEffect(()=>{
    if(!centerId){setPublishedDialogue(null);return;}
    let mounted=true;
    setPublishedDialogue(null); // Never carry another Center dialogue configuration.
    const pull=async()=>{
      try{
        const response=await fetch(apiBase+"/dialogue-config",{cache:"no-store"});
        if(response.status===401||response.status===403){if(mounted)setPublishedDialogue(null);return;}
        if(!response.ok)return; // Transient outage: retain same-session LKG.
        const body=await response.json() as {data?:{configuration?:unknown}|null};
        const parsed=parseDialogueConfig(body.data?.configuration);
        if(mounted)setPublishedDialogue(parsed); // Null/invalid active config disables dialogue.
      }catch{
        // Keep last-known-good for transient network errors within this session/Center.
      }
    };
    void pull();
    const timer=window.setInterval(()=>void pull(),30000);
    return()=>{mounted=false;window.clearInterval(timer);};
  },[apiBase,centerId,runtimeSessionId]);
  useEffect(() => {
    if(!centerId)return;
    setPolicy(defaultSharedTvPolicy()); // Never carry a permissive Center policy across TV scopes.
    let mounted=true;
    const pull=async()=>{
      try{
        const response=await fetch(apiBase+"/policy",{cache:"no-store"});
        if(!response.ok)return;
        const body=await response.json() as {data?:unknown};
        const parsed=readSafeTvPolicy(body.data,centerId);
        if(mounted&&parsed)setPolicy(parsed);
      }catch{
        // Keep last-known-good; the initial default hides optional private fields.
      }
    };
    void pull();
    const timer=window.setInterval(()=>void pull(),30000);
    return()=>{mounted=false;window.clearInterval(timer)};
  },[apiBase,centerId]);
  const cursor = useRef(0);
  const presentedSequence = useRef(0);
  const wasConnected = useRef(false);
  const presentationBusy = useRef(false);
  const presentationGeneration = useRef(0);
  const presentationCenter = useRef("");
  const housePollInFlight = useRef(false);
  const houseSnapshotRefreshedAt = useRef(0);
  const houseGeneration = useRef(0);
  const stageRef = useRef<HTMLElement | null>(null);
  const [arrivalHandoffTarget, setArrivalHandoffTarget] = useState<{ left: string; top: string; width: string; height: string } | null>(null);
  const [departureOrigin, setDepartureOrigin] = useState<{ left: string; top: string; width: string; height: string } | null>(null);

  useEffect(() => {
    const query = fixedCenterId?.trim() || new URLSearchParams(location.search).get("centerId")?.trim() || "";
    const saved = fixedCenterId ? "" : localStorage.getItem(CENTER_STORAGE)?.trim() ?? "";
    const value = query || saved;
    if (!value) return;
    setCenterId(value);
    setDraft(value);
    if (query && !fixedCenterId) localStorage.setItem(CENTER_STORAGE, query);
  }, [fixedCenterId]);
  liveActorCountRef.current=inside.length+scenes.length+(presentation?1:0);
  // Device-authenticated read of Core published TV config. An outage or invalid
  // payload never replaces last-known-good. New geometry waits until House is empty.
  useEffect(()=>{
    if(!centerId){setSpatial({active:null,pending:null});return;}
    let cancelled=false;
    setSpatial({active:null,pending:null});
    async function pollSpatial(){
      try{
        const response=await fetch(`${apiBase}/spatial-config`,{cache:"no-store"});
        if(!response.ok)throw new Error("TV spatial config unavailable");
        const body=await response.json() as {data?:unknown};
        if(cancelled)return;
        const candidate=parsePublishedHouseSpatialConfig(body.data);
        if(candidate)setSpatial(previous=>reconcileHouseSpatialRefresh(previous,candidate,liveActorCountRef.current));
      }catch{/* Fails closed: keep saved/default or last-known-good revision. */}
    }
    void pollSpatial();
    const timer=window.setInterval(()=>void pollSpatial(),12000);
    return()=>{cancelled=true;window.clearInterval(timer);};
  },[centerId,apiBase]);
  useEffect(()=>{
    if(inside.length===0&&scenes.length===0&&!presentation)setSpatial(previous=>reconcileHouseSpatialRefresh(previous,null,0));
  },[inside.length,scenes.length,presentation]);
  const spatialGraph=useMemo<AmbientMotionGraph | undefined>(()=>{
    const current=spatial.active?.configuration;
    if(!current)return undefined;
    return {...(savedSpatialGraph as AmbientMotionGraph),canvas:current.canvas,
      horizontalLanes:current.graph.horizontalLanes,rawConnectors:current.graph.rawConnectors};
  },[spatial.active]);
  const configuredAreas=spatial.active?.configuration.areas ?? approvedHouseAreas;
  const pollHouse = useCallback(async () => {
    if (!centerId || housePollInFlight.current) return;
    housePollInFlight.current = true;
    const generation = houseGeneration.current;
    try {
      if (!wasConnected.current) {
        const response = await fetch(`${apiBase}/snapshot?centerId=${encodeURIComponent(centerId)}&t=${Date.now()}`, { cache: "no-store" });
        const json = await response.json() as { data?: unknown };
        if (!response.ok || !json.data) throw new Error("offline");
        const snapshot = parsePresenceSnapshot(json.data);
        if (generation !== houseGeneration.current) return;
        const advanced = advanceHouseSnapshotCursor(snapshot.cursor, cursor.current, presentedSequence.current);
        if (advanced.applySnapshot) {
          cursor.current = advanced.cursor;
          presentedSequence.current = advanced.presentedSequence;
          setInside(snapshot.actors);
          houseSnapshotRefreshedAt.current = Date.now();
          // Snapshot is reconnect truth. Never replay or resume a historical presence scene across reconnect.
          setScenes([]);
        }
        setConnected(true);
        wasConnected.current = true;
        return;
      }
      const response = await fetch(`${apiBase}/events?centerId=${encodeURIComponent(centerId)}&after=${cursor.current}&t=${Date.now()}`, { cache: "no-store" });
      const json = await response.json() as { data?: unknown };
      if (!response.ok || !json.data) throw new Error("offline");
      if (generation !== houseGeneration.current) return;
      const page = parsePresenceEventPage(json.data);
      if (page.cursor < cursor.current) {
        setConnected(true);
        return;
      }
      const unseen = selectUnseenHouseEvents(page.events, presentedSequence.current, page.cursor);
      if (unseen.hasGap) {
        setConnected(false);
        wasConnected.current = false;
        return;
      }
      cursor.current = Math.max(cursor.current, page.cursor);
      presentedSequence.current = Math.max(presentedSequence.current, unseen.lastSequence);
      if (unseen.events.some((event) => event.kind === "RECONCILE_REQUIRED")) {
        // Aggregate source transitions are snapshot-only: never flash a partial hero from the same page.
        setConnected(false);
        wasConnected.current = false;
        return;
      }
      if (unseen.events.length) {
        enqueuePresenceEvents(unseen.events.filter((event): event is PresenceEvent => event.kind === "PRESENCE_EVENT"));
      }
      if (Date.now() - houseSnapshotRefreshedAt.current >= 1500) {
        const snapshotResponse = await fetch(`${apiBase}/snapshot?centerId=${encodeURIComponent(centerId)}&t=${Date.now()}`, { cache: "no-store" });
        const snapshotJson = await snapshotResponse.json() as { data?: unknown };
        if (!snapshotResponse.ok || !snapshotJson.data) throw new Error("offline");
        if (generation !== houseGeneration.current) return;
        const snapshot = parsePresenceSnapshot(snapshotJson.data);
        if (houseRefreshSnapshotIsCurrent(snapshot.cursor, cursor.current, presentedSequence.current)) {
          setInside(snapshot.actors);
          setScenes((queue) => queue.filter((queued) => queued.kind !== "arrival"
            || snapshot.actors.some((actor) => actor.pinoriaSelfId === queued.pinoriaSelfId
              && actorHasSource(actor, queued.sourceType, queued.sourceId))));
        }
        houseSnapshotRefreshedAt.current = Date.now();
      }
      setConnected(true);
    } catch {
      if (generation === houseGeneration.current) {
        setConnected(false);
        wasConnected.current = false;
      }
    } finally {
      if (generation === houseGeneration.current) housePollInFlight.current = false;
    }
  }, [apiBase, centerId, policy]);
  function enqueuePresenceEvents(events: PresenceEvent[]) {
    setScenes((queue) => [
      ...queue,
      ...events.filter(event=>eligibleTvEvent(policy,event.type,event.occurredAt,new Date())).map((event) => ({
        id: `${event.sequence}`,
        kind: event.type === "ARRIVAL" ? "arrival" as const : "departure" as const,
        name: displayNameForSharedTv(policy,event.payload.displayName),
        occurredAt: event.occurredAt,
        config: event.payload.character ?? {},
        actorType: event.actorType,
        pinoriaSelfId: event.pinoriaSelfId,
        sourceType: event.sourceType,
        sourceId: event.sourceId,
        phase: event.type === "DEPARTURE" ? "transition" as const : "performance" as const,
      })),
    ]);
    setInside((current) => {
      const next = new Map(current.map((item) => [item.pinoriaSelfId, item]));
      for (const event of events) {
        if (event.type === "ARRIVAL") next.set(event.pinoriaSelfId, actorFromArrival(event));
      }
      return [...next.values()];
    });
  }

  useEffect(() => {
    if (!centerId) return;
    houseGeneration.current += 1;
    const generation = houseGeneration.current;
    housePollInFlight.current = false;
    wasConnected.current = false;
    void pollHouse();
    const timer = window.setInterval(() => void pollHouse(), 750);
    return () => {
      window.clearInterval(timer);
      if (houseGeneration.current === generation) houseGeneration.current += 1;
      housePollInFlight.current = false;
    };
  }, [centerId, pollHouse]);
  const pollOnboardingPreview = useCallback(async () => {
    if (!centerId) return;
    try {
      const response = await fetch(`${apiBase}/onboarding-preview?centerId=${encodeURIComponent(centerId)}&t=${Date.now()}`, { cache: "no-store" });
      const json = await response.json() as { data?: OnboardingPreview | null };
      if (!response.ok) throw new Error("preview unavailable");
      const next = json.data ?? null;
      setOnboardingPreview(eligibleTvEvent(policy,"ONBOARDING_CEREMONY",new Date().toISOString(),new Date()) && next ? {...next,displayName:displayNameForSharedTv(policy,next.displayName)} : null);
      if (next && eligibleTvEvent(policy,"ONBOARDING_CEREMONY",new Date().toISOString(),new Date())) setScenes([]);
    } catch {
      setOnboardingPreview(null);
    }
  }, [apiBase, centerId, policy]);

  useEffect(() => {
    if (!centerId) return;
    void pollOnboardingPreview();
    const timer = window.setInterval(() => void pollOnboardingPreview(), 750);
    return () => window.clearInterval(timer);
  }, [centerId, pollOnboardingPreview]);

  // Observe Core release while a scene is displayed. Never claim a new event for status.
  useEffect(() => {
    if (!centerId || !presentation) return;
    let disposed = false;
    let inFlight = false;
    const currentId = presentation.id;
    const check = async () => {
      if (inFlight || disposed) return;
      inFlight = true;
      try {
        const activeId = await presentationStatus(centerId, apiBase);
        if (!disposed && shouldReleaseTvScene(currentId, activeId)) {
          setPresentation((value) => value?.id === currentId ? null : value);
        }
      } catch {
        // Unknown status: keep the current scene, never interpret an outage as release.
      } finally {
        inFlight = false;
      }
    };
    const timer = window.setInterval(() => void check(), 1500);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [apiBase, centerId, presentation]);
  // The TV runtime cookie is HttpOnly. Never fall back to the shared center-only relay.
  useEffect(() => {
    const scope=runtimeDisplayId&&runtimeSessionId?`${centerId}:${runtimeDisplayId}:${runtimeSessionId}`:"";
    replayScope.current=scope;
    replayLastRevision.current=0;
    replayLoadedCommand.current="";
    replayBusy.current=false;
    setReplaySceneKey("");
    setReplayedPresentationId("");
    setReplayFrame(null);
    if(!scope||!centerId)return;
    let disposed=false;
    const check=async()=>{
      if(disposed||replayBusy.current)return;
      replayBusy.current=true;
      try{
        const command=await pollPendingReplay(apiBase);
        if(disposed||replayScope.current!==scope||!command||replayLoadedCommand.current===command.id)return;
        if(!activePresentationIdRef.current||!acceptsTvReplayInstruction({
          centerId,displayId:runtimeDisplayId,sessionId:runtimeSessionId,
          revision:replayLastRevision.current,activePresentationId:activePresentationIdRef.current,
        },{...command,activePresentationId:command.presentationId}))return;
        const loaded=await loadReplayProjection(apiBase,command);
        if(disposed||replayScope.current!==scope||activePresentationIdRef.current!==loaded.presentation.id)return;
        // Same presentation, new React key: forces effects/animation to begin at frame zero.
        replayLoadedCommand.current=command.id;
        setReplaySceneKey(command.id);
        setReplayedPresentationId(command.presentationId);
        setPresentation({...loaded.presentation});
        setReplayFrame({command,generation:Date.now()});
      }catch{
        // Unavailable/replaced runtime must never replay or acknowledge a command.
      }finally{replayBusy.current=false;}
    };
    const timer=window.setInterval(()=>void check(),1200);
    void check();
    return()=>{disposed=true;window.clearInterval(timer);};
  },[apiBase,centerId,runtimeDisplayId,runtimeSessionId]);

  // Passive effect runs only AFTER the keyed scene has committed to React.
  // Two paint frames further prevent acknowledging a command only staged in state.
  useEffect(()=>{
    if(!replayFrame||!runtimeDisplayId||!runtimeSessionId||presentation?.id!==replayFrame.command.presentationId)return;
    const scope=`${centerId}:${runtimeDisplayId}:${runtimeSessionId}`;
    const {command,generation}=replayFrame;
    if(replayScope.current!==scope||generation<=0)return;
    let disposed=false,first=0,second=0,retry=0;
    const ack=async()=>{
      if(disposed||replayScope.current!==scope)return;
      try{
        await acknowledgeRenderedReplay(apiBase,command);
        if(disposed||replayScope.current!==scope)return;
        replayLastRevision.current=Math.max(replayLastRevision.current,command.revision);
        setReplayFrame(current=>current?.command.id===command.id?null:current);
      }catch{
        if(!disposed)retry=window.setTimeout(()=>void ack(),1500);
      }
    };
    first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>void ack());});
    return()=>{disposed=true;cancelAnimationFrame(first);cancelAnimationFrame(second);window.clearTimeout(retry);};
  },[apiBase,centerId,presentation?.id,replayFrame,runtimeDisplayId,runtimeSessionId]);
  const pollPresentation = useCallback(async () => {
    if (!centerId || presentationBusy.current || presentation || onboardingPreview || scenes.length > 0) return;
    presentationBusy.current = true;
    const requestedGeneration = presentationGeneration.current;
    try {
      const claimed = await claimPresentation(centerId, apiBase);
      if (claimed && isCurrentTvPresentationClaim(centerId, requestedGeneration, presentationCenter.current, presentationGeneration.current)) {
        if (eligibleTvEvent(policy, claimed.kind, claimed.claimedAt, new Date()) && (policy.visibleContext.companion || (claimed.kind !== "EGG_HATCH" && claimed.kind !== "COMPANION_RITUAL"))) {
          setPresentation(redactTvPresentationName(policy, claimed));
        } else {
          await completePresentation(centerId, claimed.id, apiBase); // Presentation receipt only; never domain reward.
        }
      }
    } catch {
      // House presence remains usable if the Wish relay is temporarily unavailable.
    } finally {
      if (requestedGeneration === presentationGeneration.current) presentationBusy.current = false;
    }
  }, [apiBase, centerId, onboardingPreview, scenes.length, presentation, policy]);

  // Only a Center transition invalidates a pending claim. Callback changes caused by
  // house scenes/re-renders must not release the in-flight lock and double-claim Core.
  useEffect(() => {
    presentationGeneration.current += 1;
    presentationCenter.current = centerId;
    presentationBusy.current = false;
    return () => {
      presentationGeneration.current += 1;
      presentationBusy.current = false;
    };
  }, [centerId]);

  useEffect(() => {
    if (!centerId) return;
    void pollPresentation();
    const timer = window.setInterval(() => void pollPresentation(), 1000);
    return () => window.clearInterval(timer);
  }, [centerId, pollPresentation]);

  const scene = scenes[0] ?? null;
  const sceneActor = scene ? inside.find((actor) => actor.pinoriaSelfId === scene.pinoriaSelfId) ?? null : null;
  const sceneHasMatchingSource = Boolean(scene && sceneActor && actorHasSource(sceneActor, scene.sourceType, scene.sourceId));
  const arrivalCompanion = policy.visibleContext.companion && scene?.kind === "arrival" && sceneHasMatchingSource ? sceneActor?.experience?.companion ?? null : null;
  const arrivalPath = policy.visibleContext.path && scene?.kind === "arrival" && sceneHasMatchingSource ? sceneActor?.experience?.path ?? null : null;
  // Departure context only comes from the matching canonical presence source and policy.
  const departurePath = policy.visibleContext.path && scene?.kind === "departure" && sceneHasMatchingSource ? sceneActor?.experience?.path ?? null : null;
  const departureCompanion = policy.visibleContext.companion && scene?.kind === "departure" && sceneHasMatchingSource ? sceneActor?.experience?.companion ?? null : null;
  const arrivalCompanionAsset = arrivalCompanion ? pinoriaAssetUrl(arrivalCompanion.species.assetKey) : null;
  const arrivalCompanionIdentity = arrivalCompanionAsset && scene ? `${scene.id}:${scene.pinoriaSelfId}:${scene.sourceType}:${scene.sourceId}:${arrivalCompanion?.id}:${arrivalCompanionAsset}` : null;
  const [failedArrivalCompanionIdentity, setFailedArrivalCompanionIdentity] = useState<string | null>(null);
  const visibleArrivalCompanionAsset = arrivalCompanionIdentity !== failedArrivalCompanionIdentity ? arrivalCompanionAsset : null;
  // If the learner has re-entered via another presence source, discard the stale farewell.
  const sceneIsCurrent = !scene || (scene.kind === "departure" && sceneActor && !sceneHasMatchingSource ? false : housePresenceSceneIsCurrent(scene.kind, Boolean(sceneActor), sceneHasMatchingSource));

  useEffect(() => {
    if (!scene || presentation) return;
    if (!sceneIsCurrent) {
      setScenes((queue) => queue[0]?.id === scene.id ? queue.slice(1) : queue);
      return;
    }
    const duration = scene.kind === "arrival"
      ? scene.phase === "performance" ? ARRIVAL_PERFORMANCE_MS : ARRIVAL_HANDOFF_MS
      : scene.phase === "transition" ? DEPARTURE_TRANSITION_MS : DEPARTURE_PERFORMANCE_MS;
    const timer = window.setTimeout(() => {
      if (scene.kind === "arrival" && scene.phase === "performance") {
        setScenes((queue) => queue[0]?.id === scene.id
          ? [{ ...queue[0], phase: "handoff" }, ...queue.slice(1)]
          : queue);
        return;
      }
      if (scene.kind === "departure" && scene.phase === "transition") {
        setScenes((queue) => queue[0]?.id === scene.id
          ? [{ ...queue[0], phase: "performance" }, ...queue.slice(1)]
          : queue);
        return;
      }
      if (scene.kind === "departure") {
        setInside((current) => current.filter((actor) => actor.pinoriaSelfId !== scene.pinoriaSelfId
          || !actorHasSource(actor, scene.sourceType, scene.sourceId)));
      }
      setScenes((queue) => queue[0]?.id === scene.id ? queue.slice(1) : queue);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [presentation, scene, sceneIsCurrent]);

  useLayoutEffect(() => {
    if (!scene || scene.kind !== "departure") { setDepartureOrigin(null); return; }
    if (scene.phase !== "transition") return;
    if (!sceneHasMatchingSource) { setDepartureOrigin(null); return; }
    const stage = stageRef.current;
    const target = Array.from(stage?.querySelectorAll<HTMLElement>("[data-ambient-runtime-character]") ?? [])
      .find((element) => element.dataset.ambientRuntimeSelf === scene.pinoriaSelfId);
    if (!stage || !target) { setDepartureOrigin(null); return; }
    const bounds = stage.getBoundingClientRect(), actor = target.getBoundingClientRect();
    if (!bounds.width || !bounds.height || !actor.width || !actor.height) { setDepartureOrigin(null); return; }
    setDepartureOrigin({
      left: `${((actor.left + actor.width / 2 - bounds.left) / bounds.width) * 100}%`,
      top: `${((actor.top + actor.height / 2 - bounds.top) / bounds.height) * 100}%`,
      width: `${actor.width}px`, height: `${actor.height}px`,
    });
  }, [scene, sceneHasMatchingSource]);
  useLayoutEffect(() => {
    if (!scene || scene.kind !== "arrival" || scene.phase !== "handoff") {
      setArrivalHandoffTarget(null);
      return;
    }
    const stage = stageRef.current;
    if (!stage) return;
    const target = Array.from(stage.querySelectorAll<HTMLElement>("[data-ambient-runtime-character]"))
      .find((element) => element.dataset.ambientRuntimeSelf === scene.pinoriaSelfId);
    if (!target) {
      setScenes((queue) => queue[0]?.id === scene.id ? queue.slice(1) : queue);
      return;
    }
    const stageRect = stage.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    if (!stageRect.width || !stageRect.height || !targetRect.width || !targetRect.height) return;
    setArrivalHandoffTarget({
      left: `${((targetRect.left + targetRect.width / 2 - stageRect.left) / stageRect.width) * 100}%`,
      top: `${((targetRect.top + targetRect.height / 2 - stageRect.top) / stageRect.height) * 100}%`,
      width: `${targetRect.width}px`,
      height: `${targetRect.height}px`,
    });
  }, [scene]);
  useEffect(() => {
    if (!presentation || !centerId) return;
    const presentationId = presentation.id;
    let cancelled = false;
    let timer = 0;

    const finish = async () => {
      if (cancelled) return;
      try {
        await completePresentation(centerId, presentationId, apiBase);
        if (!cancelled) {
          setPresentation((current) => current?.id === presentationId ? null : current);
        }
      } catch {
        if (cancelled) return;
        // An operator can close the singleton while the TV completion is in flight.
        // Before retrying a stale complete, inspect Core state without re-claiming.
        try {
          const released = await completionAlreadyReleased(centerId, presentationId, apiBase);
          if (cancelled) return;
          if (released) {
            setPresentation((current) => current?.id === presentationId ? null : current);
            return;
          }
        } catch {
          // Core status unavailable: preserve the scene and retry safely.
        }
        if (!cancelled) timer = window.setTimeout(() => void finish(), 1500);
      }
    };

    const duration = presentation.kind === "WISH_REVEAL"
      ? wishRevealSceneMs(presentation.projection)
      : presentation.kind === "EGG_HATCH"
        ? EGG_HATCH_SCENE_MS
        : presentation.kind === "ONBOARDING_CEREMONY"
          ? ONBOARDING_CEREMONY_SCENE_MS
          : COMPANION_RITUAL_SCENE_MS;
    timer = window.setTimeout(() => void finish(), duration);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [apiBase, centerId, presentation]);

  function saveCenter() {
    const value = draft.trim();
    if (!value) return;
    localStorage.setItem(CENTER_STORAGE, value);
    houseGeneration.current += 1;
    presentationGeneration.current += 1;
    presentationCenter.current = value;
    housePollInFlight.current = false;
    cursor.current = 0;
    presentedSequence.current = 0;
    wasConnected.current = false;
    houseSnapshotRefreshedAt.current = 0;
    setInside([]);
    setScenes([]);
    setPresentation(null);
    setOnboardingPreview(null);
    setPolicy(defaultSharedTvPolicy());
    setCenterId(value);
  }

  function resetCenter() {
    localStorage.removeItem(CENTER_STORAGE);
    presentationGeneration.current += 1;
    presentationCenter.current = "";
    houseGeneration.current += 1;
    housePollInFlight.current = false;
    cursor.current = 0;
    presentedSequence.current = 0;
    wasConnected.current = false;
    houseSnapshotRefreshedAt.current = 0;
    setInside([]);
    setScenes([]);
    setPresentation(null);
    setOnboardingPreview(null);
    setPolicy(defaultSharedTvPolicy());
    setCenterId("");
  }
  const ambientActors = useMemo(() => inside.map((actor) => ({ id: actor.pinoriaSelfId, actorType: actor.actorType, name: displayNameForSharedTv(policy,actor.displayName), config: actor.character, wardRender: actor.wardRender, experience: actor.experience })), [inside,policy]);
  const wardLearner = useMemo(() => { const newest = [...inside].reverse(); return newest.find((actor) => actor.wardSession?.status === "OPEN") ?? newest.find((actor) => actor.wardSession) ?? null; }, [inside]);
  if (!centerId) {
    return <main className={styles.setup}>
      <div>
        <span>PINORIA · HOUSE TV</span>
        <h1>Kết nối màn hình</h1>
        <p>Nhập Center ID một lần cho TV.</p>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Center ID" />
        <button onClick={saveCenter}>Kết nối</button>
      </div>
    </main>;
  }

  const visualScene = !onboardingPreview && scene && eligibleTvEvent(policy,scene.kind==="arrival"?"ARRIVAL":"DEPARTURE",scene.occurredAt,new Date()) && (scene.phase === "performance" || (scene.kind === "arrival" && scene.phase === "handoff")) ? scene : null;
  const arrivalActorIds = scenes.filter((queued) => queued.kind === "arrival").map((queued) => queued.pinoriaSelfId);
  const departingId = scene?.kind === "departure" && scene.phase === "transition"
    && inside.some((actor) => actor.pinoriaSelfId === scene.pinoriaSelfId && actorHasSource(actor, scene.sourceType, scene.sourceId))
    ? scene.pinoriaSelfId
    : null;
  const isArrivalHandoff = visualScene?.kind === "arrival" && visualScene.phase === "handoff";
  const departureStyle = visualScene?.kind === "departure" && departureOrigin ? ({
    "--departure-from-left": departureOrigin.left, "--departure-from-top": departureOrigin.top,
    "--departure-from-width": departureOrigin.width, "--departure-from-height": departureOrigin.height,
  } as CSSProperties) : undefined;
  const handoffStyle = isArrivalHandoff && arrivalHandoffTarget ? ({
    "--arrival-target-left": arrivalHandoffTarget.left,
    "--arrival-target-top": arrivalHandoffTarget.top,
    "--arrival-target-width": arrivalHandoffTarget.width,
    "--arrival-target-height": arrivalHandoffTarget.height,
  } as CSSProperties) : undefined;
  const visiblePresentation = presentation && eligibleTvEvent(policy,presentation.kind,presentation.claimedAt,new Date()) ? presentation : null;
  const active = Boolean(visualScene || visiblePresentation || onboardingPreview);
  const arrivalActive = visualScene?.kind === "arrival";
  return <main ref={stageRef} onErrorCapture={(event) => { if (event.target instanceof HTMLImageElement || event.target instanceof HTMLVideoElement) setAssetEvidence(previous => recordAssetFailure(previous, "renderer-media")); }} data-tv-asset-evidence={observedAssetStatus} data-tv-build-manifest-provenance={manifestDigest ? "VALID" : "UNKNOWN"} className={`${styles.stage} ${active ? styles.active : ""} ${arrivalActive ? styles.arrivalActive : ""}`}>
    <div className={styles.sky} />
    <div className={styles.orbOne} />
    <div className={styles.orbTwo} />
    <header className={styles.status}>
      <div><b>PINORIA</b><span>HOUSE</span></div>
      <div className={styles.live}>
        <i className={connected ? styles.online : styles.offline} />
        {connected ? `${inside.length} Piner đang ở House` : "Đang reconcile…"}
      </div>
    </header>    <AmbientHouseRuntime actors={ambientActors} areas={configuredAreas} motionGraph={spatialGraph} emergencePins={spatial.active?.configuration.emergencePins} departingId={departingId} suppressedIds={arrivalActorIds} frozenIds={arrivalActorIds} publishedDialogue={publishedDialogue} />

    {visualScene ? <section
      key={visualScene.id}
      data-arrival-scene={visualScene.kind === "arrival" ? "true" : undefined}
      data-arrival-phase={visualScene.kind === "arrival" ? visualScene.phase : undefined}
      data-arrival-self={visualScene.kind === "arrival" ? visualScene.pinoriaSelfId : undefined}
      data-arrival-source-type={visualScene.kind === "arrival" ? visualScene.sourceType : undefined}
      data-arrival-source-id={visualScene.kind === "arrival" ? visualScene.sourceId : undefined}
      data-presence-actor-type={visualScene.actorType}
      className={`${styles.scene} ${visualScene.kind === "arrival" ? styles.arrivalScene : styles.departure} ${isArrivalHandoff ? styles.arrivalHandoff : ""}`}
      style={visualScene.kind === "departure" ? departureStyle : handoffStyle}
    >
      {visualScene.kind === "arrival" ? <div className={styles.arrivalBackdrop} aria-hidden="true"><div className={styles.arrivalHouseLayers}><span style={{ backgroundImage: `url("${HOUSE_ASSETS.back}")` }} /><span style={{ backgroundImage: `url("${HOUSE_ASSETS.mid}")` }} /><span style={{ backgroundImage: `url("${HOUSE_ASSETS.front}")` }} /></div></div> : null}
      <div className={styles.aura}><img src="https://assets.pinohouse.art/draft/AuraLv3.png" onError={() => setAssetEvidence(previous=>recordAssetFailure(previous,"scene-aura"))} alt="" /></div>
      {visualScene.kind === "arrival" ? <><div className={styles.heroLight} /><div className={styles.footShadow} /><div className={styles.contactShadow} /><div className={styles.radiance} /></> : null}
      <LayeredCharacter className={styles.character} config={visualScene.kind === "arrival" && sceneHasMatchingSource && sceneActor?.character ? sceneActor.character : visualScene.config} wardRender={visualScene.kind === "arrival" && sceneHasMatchingSource ? sceneActor?.wardRender ?? undefined : undefined} />
      {visibleArrivalCompanionAsset ? <><div className={styles.moriShadow} /><img className={styles.mori} src={visibleArrivalCompanionAsset} onError={() => { setFailedArrivalCompanionIdentity(arrivalCompanionIdentity);setAssetEvidence(previous=>recordAssetFailure(previous,"arrival-companion")); }} alt="" /></> : null}
      <div className={styles.copy}>
        <span>{visualScene.kind === "arrival" ? `CHÀO ĐẾN · ${displayNameForSharedTv(policy,visualScene.name).toUpperCase()}` : "HẸN GẶP LẠI"}</span>
        <h1>{visualScene.kind === "arrival" ? `Chào ${displayNameForSharedTv(policy,visualScene.name)} ✦` : displayNameForSharedTv(policy,visualScene.name)}</h1>
        {visualScene.kind === "arrival" && arrivalPath ? <div className={styles.arrivalPath} data-arrival-path={arrivalPath.code} aria-label={`Hành trình ${arrivalPath.displayName}`}>{arrivalPath.displayName}</div> : null}
        {visualScene.kind === "departure" && departurePath ? <div className={styles.arrivalPath} data-departure-path={departurePath.code}>{departurePath.displayName}</div> : null}
        {visualScene.kind === "departure" && departureCompanion ? <p data-departure-companion="canonical">{departureCompanion.species.displayName} đồng hành cùng bạn ✦</p> : null}
        <p>{visualScene.kind === "arrival" ? arrivalCompanion ? `Hôm nay ${arrivalCompanion.species.displayName} đi cùng mình!` : "Chào mừng bạn đến Pinoria!" : "Hẹn gặp lại trong chuyến phiêu lưu tiếp theo ✦"}</p>
      </div>
    </section> : null}
    {!scene && !presentation && !onboardingPreview ? <section className={styles.idle}>
      <div className={styles.sigil}>P</div>
      <span>PINORIA HOUSE IS ALIVE</span>
      <h1>Chào mừng đến PINO House</h1>
      <p>{inside.length ? `${inside.length} Piner đang khám phá cùng nhau.` : "Pinoria đang chờ Piner đầu tiên."}</p>
    </section> : null}

    {visiblePresentation?.kind === "WISH_REVEAL" ? <WishRevealScene key={replaySceneKey && replayedPresentationId === visiblePresentation.id ? replaySceneKey : visiblePresentation.id} reveal={visiblePresentation.projection} /> : null}
    {visiblePresentation?.kind === "EGG_HATCH" ? <EggHatchScene key={replaySceneKey && replayedPresentationId === visiblePresentation.id ? replaySceneKey : visiblePresentation.id} hatch={visiblePresentation.projection} /> : null}
    {visiblePresentation?.kind === "COMPANION_RITUAL" ? <CompanionRitualScene key={replaySceneKey && replayedPresentationId === visiblePresentation.id ? replaySceneKey : visiblePresentation.id} ritual={visiblePresentation.projection} /> : null}
    {visiblePresentation?.kind === "ONBOARDING_CEREMONY" ? <OnboardingCeremonyScene key={replaySceneKey && replayedPresentationId === visiblePresentation.id ? replaySceneKey : visiblePresentation.id} ceremony={visiblePresentation.projection} /> : null}
    {!presentation && onboardingPreview ? <OnboardingPreviewScene preview={onboardingPreview} /> : null}
    {!scene && !presentation && !onboardingPreview && wardLearner?.wardSession && eligibleTvEvent(policy,"QUICK_CHOICE",new Date().toISOString(),new Date()) ? <WardSessionTv learnerName={displayNameForSharedTv(policy,wardLearner.displayName)} session={wardLearner.wardSession} /> : null}

    <footer>
      <span>{new Date().toLocaleDateString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
      })}</span>
      <button onClick={resetCenter}>Center</button>
    </footer>
  </main>;
}
