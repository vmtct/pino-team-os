import test from "node:test";
import assert from "node:assert/strict";
import {checkReceipt} from "./pap1074-g4-attestation.mjs";

const sha = "dab64285902ba7efd78faca4301591cc30b8187b";
const runs = [
 {name:"PR Validation",head_sha:sha,status:"completed",conclusion:"success",id:40804972701},
 {name:"Team Staging CD (Guarded)",head_sha:sha,status:"completed",conclusion:"success",id:40805363876}
];
const deployments = [{
 annotations:{"workers/message":"team-cd-guarded staging sha="+sha+" run=40805363876"},
 versions:[{percentage:100}]
}];
const input = () => ({sha, mainSha:sha, localSha:sha, runs:structuredClone(runs),deployments:structuredClone(deployments)});
test("matching protected Main CI, guarded CD and exact 100 percent Cloudflare deployment PASS",()=>{
 assert.deepEqual(checkReceipt(input()),{sha,mainCI:40804972701,stagingCD:40805363876});
});
test("stale main refused",()=>{
 const p=input();p.mainSha="a".repeat(40);
 assert.throws(()=>checkReceipt(p),/MAIN_SHA_MISMATCH/);
});
test("stale checked out source refused",()=>{
 const p=input();p.localSha="b".repeat(40);
 assert.throws(()=>checkReceipt(p),/MAIN_SHA_MISMATCH/);
});
test("invented CI run refused",()=>{
 const p=input();p.runs[0].conclusion="failure";
 assert.throws(()=>checkReceipt(p),/CI_OR_CD_NOT_SUCCESS/);
});
test("CD run of another SHA refused",()=>{
 const p=input();p.runs[1].head_sha="c".repeat(40);
 assert.throws(()=>checkReceipt(p),/CI_OR_CD_NOT_SUCCESS/);
});
test("Cloudflare wrong Worker SHA refused",()=>{
 const p=input();p.deployments[0].annotations["workers/message"]="team-cd-guarded staging sha="+"f".repeat(40)+" run=40805363876";
 assert.throws(()=>checkReceipt(p),/WORKER_NOT_100_PERCENT/);
});
test("Cloudflare partial traffic refused",()=>{
 const p=input();p.deployments[0].versions[0].percentage=90;
 assert.throws(()=>checkReceipt(p),/WORKER_NOT_100_PERCENT/);
});
test("Cloudflare wrong CD run refused",()=>{
 const p=input();p.deployments[0].annotations["workers/message"]="team-cd-guarded staging sha="+sha+" run=40805363877";
 assert.throws(()=>checkReceipt(p),/WORKER_NOT_100_PERCENT/);
});
