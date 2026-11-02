import assert from "node:assert/strict";
import {test} from "node:test";
import graph from "../app/pinoria-tv/ambient-house-motion-graph.saved.json";
import {configIssues,draftFromSavedGraph,spatialConfigReadPath,type Lane,type Connector} from "./pinoria-tv-spatial-config-client";
import {isOperationalReadPath,readQueryBody} from "./bo-read-handler";
import {isAllowedPostPath} from "./bo-write-handler";

test("PAP-656 BO config reads are explicitly allowlisted",()=>{
  for(const path of ["head","versions","version","active"])assert.equal(isOperationalReadPath("pinoria/tv-config/spatial/"+path),true);
  for(const path of ["drafts","publish","revert"])assert.equal(isAllowedPostPath("pinoria/tv-config/spatial/"+path),true);
  assert.equal(isOperationalReadPath("pinoria/tv-config/spatial/drafts"),false);
  assert.equal(isAllowedPostPath("pinoria/tv-config/spatial/version"),false);
});
test("PAP-656 config query is scoped to a Center or DEFAULT, never body on GET",()=>{
  const centerId="0199f8e7-7c07-7c26-b673-595ba51ef1d1";
  assert.equal(spatialConfigReadPath("head",{kind:"DEFAULT"}),"/api/bo/pinoria/tv-config/spatial/head?scope=DEFAULT");
  assert.ok(spatialConfigReadPath("versions",{kind:"CENTER",centerId}).includes("centerId="+centerId));
  assert.ok(spatialConfigReadPath("version",{kind:"CENTER",centerId},"test-version").includes("versionId=test-version"));
  assert.ok(spatialConfigReadPath("active",{kind:"CENTER",centerId}).endsWith("?centerId="+centerId));
  assert.throws(()=>spatialConfigReadPath("active",{kind:"DEFAULT"}));
});
test("PAP-656 seed reuses saved 16:9 House graph and validates missing area lanes",()=>{
  const seeded=draftFromSavedGraph({horizontalLanes:graph.horizontalLanes as Lane[],rawConnectors:graph.rawConnectors as Connector[]});
  assert.deepEqual(seeded.canvas,{width:1920,height:1080});
  assert.equal(seeded.graph.horizontalLanes.length,8);
  assert.equal(seeded.graph.rawConnectors.length,12);
  assert.deepEqual(configIssues(seeded),[]);
  seeded.areas.push({id:"area-a",bounds:{x:0,y:0,width:500,height:500},laneIds:["missing"],pathCodes:["ARTCHITECT"]});
  assert.ok(configIssues(seeded).some(e=>e.includes("missing lane")));
});

test("PAP-656 GET facade serializes scope without browser GET bodies",()=>{
  const centerId="0199f8e7-7c07-7c26-b673-595ba51ef1d1";
  const base="https://team.test/api/bo/pinoria/tv-config/spatial/";
  assert.deepEqual(readQueryBody("pinoria/tv-config/spatial/head",new URL(base+"head?scope=DEFAULT")),{scope:{kind:"DEFAULT"}});
  assert.deepEqual(readQueryBody("pinoria/tv-config/spatial/versions",new URL(base+"versions?scope=CENTER&centerId="+centerId)),{scope:{kind:"CENTER",centerId}});
  assert.deepEqual(readQueryBody("pinoria/tv-config/spatial/active",new URL(base+"active?centerId="+centerId)),{centerId});
  assert.throws(()=>readQueryBody("pinoria/tv-config/spatial/head",new URL(base+"head?scope=DEFAULT&centerId="+centerId)),RangeError);
  assert.throws(()=>readQueryBody("pinoria/tv-config/spatial/version",new URL(base+"version?scope=DEFAULT")),RangeError);
});