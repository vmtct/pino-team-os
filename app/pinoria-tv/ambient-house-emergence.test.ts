import assert from "node:assert/strict";
import {test} from "node:test";
import graphData from "./ambient-house-motion-graph.saved.json";
import {reconcileAmbientAgents,ambientMinimumVisibleSeparation,type AmbientMotionGraph} from "./ambient-house-motion";
const house=graphData as AmbientMotionGraph;
const lane=house.horizontalLanes[0]!;
const x=Math.round((lane.x1+lane.x2)/2);
test("PAP-651 emergence pin is honored at vacant approved position",()=>{
 const chosen=new Map<string,readonly string[]>([["actor-a",[lane.id]]]);
 const pins=new Map<string,readonly {laneId:string;x:number}[]>([["actor-a",[{laneId:lane.id,x}]]]);
 const actor=reconcileAmbientAgents([],["actor-a"],house,chosen,pins)[0]!;
 assert.equal(actor.laneId,lane.id);
 assert.equal(actor.x,x);
});
test("PAP-651 duplicate pin placement respects 72px collision clearance",()=>{
 const ids=["actor-a","actor-b"];
 const chosen=new Map(ids.map(id=>[id,[lane.id]] as const));
 const pins=new Map(ids.map(id=>[id,[{laneId:lane.id,x}]] as const));
 const actors=reconcileAmbientAgents([],ids,house,chosen,pins);
 assert.equal(actors.length,2);
 assert.ok(ambientMinimumVisibleSeparation(actors)>=72);
});
