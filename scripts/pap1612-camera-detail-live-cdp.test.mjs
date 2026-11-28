import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {audit} from "./pap1912-detail-parity.mjs";
test("PAP-1612 registered exact Detail tabs reject drift",()=>{
 const file="app/bo/workforce/timekeeping/BoCheckInEvidence.tsx",source=readFileSync(file,"utf8");
 assert.ok(audit(process.cwd(),{overrides:{[file]:source.replace('id:"photo"','id:"wrong"')}}).some(x=>x.includes(file)&&x.includes("business tab IDs/labels drift")));
});
test("PAP-1612 live detail runner is not authorized by CI or missing opt-in",()=>{
 const result=spawnSync(process.execPath,["scripts/pap1612-camera-detail-live-cdp.mjs"],{encoding:"utf8",env:{...process.env,CI:"1",PAP1912_DETAIL_G4:"0"},timeout:15000});
 assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/PAP1612_LIVE_G4_NOT_AUTHORIZED/);
});
