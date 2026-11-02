import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import graph from "../app/pinoria-tv/ambient-house-motion-graph.saved.json";
import areas from "../app/pinoria-tv/ambient-house-areas.prototype.json";
import emergence from "../app/pinoria-tv/ambient-house-emergence.prototype.json";
import { draftFromSavedGraph, type Lane, type Connector } from "./pinoria-tv-spatial-config-client";
import { prototypeSpatialDraft, boundsOfPoints } from "./pinoria-tv-mesh-geometry";
import { applyMeshDrag } from "./pinoria-tv-mesh-drag";

const seed = () => prototypeSpatialDraft(
  draftFromSavedGraph({horizontalLanes:graph.horizontalLanes as Lane[],rawConnectors:graph.rawConnectors as Connector[]}),
  areas, emergence,
);

test("PAP-1262 lane drag commits immutable geometry and moves its attached emergence pins", () => {
  const before = seed();
  const lane = before.graph.horizontalLanes.find(l => l.id === "lane-01")!;
  const next = applyMeshDrag(before, {kind:"lane",id:lane.id},{x:400,y:400},{x:400,y:410});
  assert.equal(next.graph.horizontalLanes.find(l => l.id === lane.id)!.y,lane.y+10);
  assert.equal(next.emergencePins[0]!.y,941);
  assert.equal(before.emergencePins[0]!.y,931);
  assert.equal(before.graph.horizontalLanes.find(l => l.id === lane.id)!.y,931);
});

test("PAP-1262 polygon drag and vertex drag preserve old state for Undo", () => {
  const before=seed();const area=before.areas.find(a => a.id === "artchitect")!;
  const moved=applyMeshDrag(before,{kind:"area",id:area.id},{x:600,y:850},{x:615,y:860});
  assert.deepEqual(moved.areas.find(a=>a.id===area.id)!.points![0],{x:503,y:733});
  const movedVertex=applyMeshDrag(moved,{kind:"area",id:area.id},{x:503,y:733},{x:530,y:735},0);
  assert.deepEqual(movedVertex.areas.find(a=>a.id===area.id)!.bounds,boundsOfPoints(movedVertex.areas.find(a=>a.id===area.id)!.points!));
  assert.deepEqual(before.areas.find(a=>a.id===area.id)!.points![0],{x:488,y:723});
});

test("PAP-1262 pin drag clamps to lane bounds and does not mutate source",()=>{
  const before=seed();const pin=before.emergencePins[0]!;
  const next=applyMeshDrag(before,{kind:"pin",id:pin.id},{x:170,y:931},{x:-500,y:931});
  assert.equal(next.emergencePins[0]!.x,126);
  assert.equal(before.emergencePins[0]!.x,170);
});

test("PAP-1262 connector pointer move is a no-op until explicit endpoint editing",()=>{
 const before=seed();
 const next=applyMeshDrag(before,{kind:"connector",id:"connector-01"},{x:604,y:785},{x:630,y:800});
 assert.deepEqual(next,before);
});

test("PAP-1262 React pointermove applies derived next state and pointercancel clears capture",()=>{
  const component=readFileSync(new URL("../app/bo/pinoria-tv-mesh/HouseMeshEditor.tsx",import.meta.url),"utf8");
  const move=component.slice(component.indexOf(" function move("),component.indexOf(" function up("));
  assert.match(move,/applyMeshDrag\(d\.origin/);
  assert.match(move,/setConfig\(next\)/);
  assert.match(move,/setDirty\(true\)/);
  assert.match(component,/onPointerCancel=\{up\}/);
});
