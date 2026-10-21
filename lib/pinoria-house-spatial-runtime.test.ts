import assert from "node:assert/strict";
import {test} from "node:test";
import saved from "../app/pinoria-tv/ambient-house-motion-graph.saved.json";
import {parsePublishedHouseSpatialConfig,reconcileHouseSpatialRefresh} from "./pinoria-house-spatial-runtime";
const valid = () => ({
  appliedVersion:"0199e0f2-0ca0-7d88-9ff6-12ab553a1b30", scope:"CENTER:test",
  configuration:{
    schemaVersion:1, canvas:{width:1920,height:1080},
    graph:{horizontalLanes:saved.horizontalLanes,rawConnectors:saved.rawConnectors},
    areas:[{id:"art",laneIds:[saved.horizontalLanes[0]!.id],bounds:{x:0,y:0,width:1920,height:1080},pathCodes:["ARTCHITECT"]}],
    emergencePins:[],
  },
});
test("PAP-651 TV spatial decoder accepts versioned approved House graph",()=>{
  const cfg=parsePublishedHouseSpatialConfig(valid());
  assert.ok(cfg);assert.equal(cfg.configuration.graph.horizontalLanes.length,8);
  assert.equal(parsePublishedHouseSpatialConfig({...valid(),appliedRevision:2})?.appliedRevision,2);
  assert.equal(parsePublishedHouseSpatialConfig({...valid(),appliedRevision:0}),null);
  assert.equal(parsePublishedHouseSpatialConfig({...valid(),appliedRevision:"2"}),null);
});
test("PAP-651 TV runtime fails closed on invalid 16:9 canvas or ambiguous mapping",()=>{
  const bad=valid();bad.configuration.canvas.height=720;
  assert.equal(parsePublishedHouseSpatialConfig(bad),null);
  const duplicate=valid();duplicate.configuration.areas.push({id:"piano",laneIds:[saved.horizontalLanes[1]!.id],bounds:{x:0,y:0,width:1920,height:1080},pathCodes:["ARTCHITECT"]});
  assert.equal(parsePublishedHouseSpatialConfig(duplicate),null);
});
test("PAP-651 never switches spatial graph while any TV actor is alive",()=>{
  const cfg=parsePublishedHouseSpatialConfig(valid())!;
  const original={active:null,pending:null};
  const held=reconcileHouseSpatialRefresh(original,cfg,42);
  assert.equal(held.active,null);assert.equal(held.pending?.appliedVersion,cfg.appliedVersion);
  const applied=reconcileHouseSpatialRefresh(held,null,0);
  assert.equal(applied.active?.appliedVersion,cfg.appliedVersion);assert.equal(applied.pending,null);
});
test("PAP-651 keeps last-known-good when remote config is unavailable",()=>{
  const cfg=parsePublishedHouseSpatialConfig(valid())!;
  const previous={active:cfg,pending:null};
  const next=reconcileHouseSpatialRefresh(previous,null,15);
  assert.equal(next.active,cfg);assert.equal(next.pending,null);
});
test("PAP-651 newer revisions are held until House becomes empty",()=>{
  const a=parsePublishedHouseSpatialConfig(valid())!;
  const b={...a,appliedVersion:"new-version"};
  const pending=reconcileHouseSpatialRefresh({active:a,pending:null},b,1);
  assert.equal(pending.active?.appliedVersion,a.appliedVersion);
  assert.equal(reconcileHouseSpatialRefresh(pending,null,0).active?.appliedVersion,b.appliedVersion);
});
