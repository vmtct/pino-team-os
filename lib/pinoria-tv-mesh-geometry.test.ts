import assert from "node:assert/strict";
import {test} from "node:test";
import graph from "../app/pinoria-tv/ambient-house-motion-graph.saved.json";
import areas from "../app/pinoria-tv/ambient-house-areas.prototype.json";
import emergence from "../app/pinoria-tv/ambient-house-emergence.prototype.json";
import {draftFromSavedGraph,configIssues,type Lane,type Connector} from "./pinoria-tv-spatial-config-client";
import {prototypeSpatialDraft,pointInsidePolygon,translatePolygon,validPolygon,boundsOfPoints} from "./pinoria-tv-mesh-geometry";
const seeded=()=>prototypeSpatialDraft(draftFromSavedGraph({horizontalLanes:graph.horizontalLanes as Lane[],rawConnectors:graph.rawConnectors as Connector[]}),areas,emergence);

test("PAP-656 seeds exact four Founder-approved 16:9 Area polygons with no guessed semantic Path codes",()=>{
 const s=seeded();
 assert.deepEqual(s.areas.map(a=>a.id),["reception","artchitect","little-piner","pianohouse"]);
 assert.deepEqual(s.areas.map(a=>a.points?.length),[5,4,5,4]);
 assert.deepEqual(s.areas.map(a=>a.pathCodes),[[],[],[],[]]);
 assert.deepEqual(s.areas.map(a=>a.learningSpaceCodes),[[],[],[],[]]);
 assert.equal(s.graph.horizontalLanes.length,8);
 assert.equal(s.graph.rawConnectors.length,12);
 assert.equal(s.emergencePins[0]?.areaId,undefined);
 assert.deepEqual({x:s.emergencePins[0]?.x,y:s.emergencePins[0]?.y},{x:170,y:931});
 assert.equal(configIssues(s).length,0);
});
test("PAP-656 polygon editing can translate and preserve bounded shape",()=>{
 const a=seeded().areas[0]!;
 assert.ok(a.points&&validPolygon(a.points));
 const shifted=translatePolygon(a.points!,50,20);
 assert.ok(validPolygon(shifted));
 assert.deepEqual(boundsOfPoints(shifted),{...a.bounds,x:a.bounds.x+50,y:a.bounds.y+20});
 const movedEdge=translatePolygon(a.points!,5000,5000);
 assert.ok(movedEdge.every(p=>p.x<=1920&&p.y<=1080));
});
test("PAP-656 geometric preview uses polygon occupancy rather than bounding rectangle",()=>{
 const a=seeded().areas[1]!;
 assert.equal(pointInsidePolygon({x:700,y:850},a.points!),true);
 assert.equal(pointInsidePolygon({x:300,y:850},a.points!),false);
});
