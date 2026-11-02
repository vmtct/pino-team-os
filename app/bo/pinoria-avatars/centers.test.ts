import test from "node:test";
import assert from "node:assert/strict";
import { loadAuthorizedDirectoryCenters } from "./centers";
const uuid="01900000-0000-7000-8000-000000000001";
const center={id:uuid,displayName:"PINO Center"};
const signal=()=>new AbortController().signal;
function fake(responses:Record<string,{status:number;data?:unknown}>,calls:string[]):typeof fetch {
  return async(input)=>{
    const key=String(input);calls.push(key);
    const r=responses[key]??{status:404};
    return Response.json({data:r.data??null},{status:r.status});
  };
}
test("PAP-982 Center source stays on authorized /centers when available",async()=>{
  const calls:string[]=[];
  const choices=await loadAuthorizedDirectoryCenters(fake({"/api/bo/centers":{status:200,data:[center]}},calls),signal());
  assert.equal(choices.source,"centers");
  assert.deepEqual(choices.centers,[center]);
  assert.deepEqual(calls,["/api/bo/centers"]);
});
test("PAP-982 Manager with 403 /centers uses only Core-authorized workforce Center candidates",async()=>{
  const calls:string[]=[];
  const choices=await loadAuthorizedDirectoryCenters(fake({
    "/api/bo/centers":{status:403},
    "/api/bo/workforce/planning/bootstrap":{status:200,data:{centers:[{...center,status:"active"},{...center,id:"01900000-0000-7000-8000-000000000002",status:"inactive"}]}}
  },calls),signal());
  assert.equal(choices.source,"workforce/planning/bootstrap");
  assert.deepEqual(choices.centers,[center]);
  assert.deepEqual(calls,["/api/bo/centers","/api/bo/workforce/planning/bootstrap"]);
});
test("PAP-982 never falls back on unauthorized session, generic error or invalid Center response",async()=>{
  for(const status of [401,500]){
    const calls:string[]=[];
    await assert.rejects(loadAuthorizedDirectoryCenters(fake({"/api/bo/centers":{status}},calls),signal()));
    assert.deepEqual(calls,["/api/bo/centers"]);
  }
  for(const data of [[center,center],[{id:"not-uuid",displayName:"bad"}],{centers:[center]}]){
    const calls:string[]=[];
    await assert.rejects(loadAuthorizedDirectoryCenters(fake({"/api/bo/centers":{status:200,data}},calls),signal()));
    assert.deepEqual(calls,["/api/bo/centers"]);
  }
  await assert.rejects(loadAuthorizedDirectoryCenters(fake({"/api/bo/centers":{status:403},"/api/bo/workforce/planning/bootstrap":{status:403}},[]),signal()));
});
