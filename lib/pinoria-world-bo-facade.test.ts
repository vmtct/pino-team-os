import assert from "node:assert/strict";
import test from "node:test";
import { isOperationalReadPath } from "./bo-read-handler";
import { handleBoWriteRequest, isAllowedPostPath, type BoWriteEnv } from "./bo-write-handler";
import { handleBoPinoriaWorldMediaUpload, PINORIA_WORLD_MEDIA_PATH, type BoPinoriaWorldMediaEnv } from "./bo-pinoria-world-media-handler";

const id="01999999-9999-7999-8999-999999999999",scene="01988888-8888-7888-8888-888888888888";

test("Pinoria World BO facade retains canonical read and route routing classification",()=>{
  for(const path of ["pinoria/worlds","pinoria/worlds/instances","pinoria/worlds/learners",`pinoria/worlds/learners/${id}`,`pinoria/worlds/instances/${id}`,`pinoria/worlds/students/${id}/live`]) assert.equal(isOperationalReadPath(path),true,path);
  for(const path of ["pinoria/worlds",`pinoria/worlds/${id}`,`pinoria/worlds/${id}/scenes`,`pinoria/worlds/scenes/${scene}`,`pinoria/worlds/scenes/${scene}/layers`,`pinoria/worlds/layers/${id}`,`pinoria/worlds/learners/${id}/instances`,`pinoria/worlds/instances/${id}/set-live`,`pinoria/worlds/instances/${id}/revoke`,`pinoria/worlds/instances/${id}/reactivate`,`pinoria/worlds/instances/${id}/scenes/${scene}`,`pinoria/worlds/instances/${id}/layers/${scene}`,PINORIA_WORLD_MEDIA_PATH]) assert.equal(isAllowedPostPath(path),true,path);
  assert.equal(isOperationalReadPath("pinoria/worlds/instances"),true);
  assert.equal(isAllowedPostPath(`pinoria/worlds/${id}/automation`),false);
  assert.equal(isAllowedPostPath(`pinoria/worlds/instances/${id}/keygate`),false);
});

test("Pinoria World facade rejects invalid method/path combinations before Core",async()=>{
  let called=false;const env={PINO_BO_CORE:{async executeWithStaffPassword(){called=true;throw new Error("unexpected")}}} as BoWriteEnv;
  for(const [method,path] of [["PUT","pinoria/worlds"],["DELETE",`pinoria/worlds/learners/${id}/instances`],["POST",`pinoria/worlds/${id}`]] as const){
    const request=new Request(`https://bo.pinohouse.art/api/bo/${path}`,{method,headers:{"content-type":"application/json"},body:JSON.stringify({})});
    const response=await handleBoWriteRequest(request,env,path);assert.equal(response.status,403,`${method} ${path}`);
  }
  assert.equal(called,false);
});

test("HO-only definition writes are denied before request parsing or Core; instance commands remain separately authorized",async()=>{
  let calls=0;const env={PINO_BO_CORE:{async executeWithStaffPassword(){calls++;throw Error("unexpected Core call")}}} as BoWriteEnv;
  for(const [method,path] of [["POST","pinoria/worlds"],["PATCH",`pinoria/worlds/${id}`],["DELETE",`pinoria/worlds/${id}`],["POST",`pinoria/worlds/${id}/scenes`],["PATCH",`pinoria/worlds/scenes/${scene}`],["POST",`pinoria/worlds/scenes/${scene}/layers`],["PATCH",`pinoria/worlds/layers/${id}`],["DELETE",`pinoria/worlds/layers/${id}`],["POST",PINORIA_WORLD_MEDIA_PATH]] as const){
    const r=new Request("https://bo.staging.pinohouse.art/api/bo/"+path,{method,headers:{"content-type":"application/json"},body:"not-json"});assert.equal((await handleBoWriteRequest(r,env,path)).status,403,path);assert.equal(r.bodyUsed,false,path);
  }
  assert.equal(calls,0);
  for(const [method,path] of [["POST",`pinoria/worlds/learners/${id}/instances`],["POST",`pinoria/worlds/instances/${id}/set-live`],["POST",`pinoria/worlds/instances/${id}/revoke`],["POST",`pinoria/worlds/instances/${id}/reactivate`],["PUT",`pinoria/worlds/instances/${id}/scenes/${scene}`],["PUT",`pinoria/worlds/instances/${id}/layers/${scene}`],["DELETE",`pinoria/worlds/instances/${id}`]] as const){
    const r=new Request("https://bo.staging.pinohouse.art/api/bo/"+path,{method,headers:{"content-type":"application/json"},body:"{}"});const result=await handleBoWriteRequest(r,env,path);assert.notEqual(result.status,403,path);
  }
  assert.equal(calls,0);
});
test("retired multipart media rejects before body or Core",async()=>{
  let calls=0;const env={PINO_BO_CORE:{async executeWithStaffPassword(){calls++;throw Error("unexpected Core call")}}} as BoPinoriaWorldMediaEnv;
  const form=new FormData();form.set("file",new File(["x"],"scene.png",{type:"image/png"}));
  const r=new Request("https://bo.staging.pinohouse.art/api/bo/pinoria/worlds/media",{method:"POST",headers:{cookie:"pino_staff_password_session=local-session","idempotency-key":"world-media-qa"},body:form});assert.equal((await handleBoPinoriaWorldMediaUpload(r,env)).status,403);assert.equal(r.bodyUsed,false);assert.equal(calls,0);
});

test("World Studio production page is Core-backed and preserves required Character semantics",async()=>{
  const fs=await import("node:fs/promises"),source=await fs.readFile(new URL("../app/bo/pinoria-world/PinoriaWorldManager.tsx",import.meta.url),"utf8");
  assert.match(source,/CORE BACKED/);assert.match(source,/pinoria\/worlds\/instances/);assert.match(source,/Required Character Layer/);const detail=await fs.readFile(new URL("../app/bo/pinoria-world/PinoriaInstanceDetail.tsx",import.meta.url),"utf8");assert.match(detail,/Character · always on/);assert.match(source,/<PinoriaInstanceDirectory\/>/);assert.doesNotMatch(source,/Legacy learner controls/);assert.match(source,/LayeredCharacter/);assert.match(source,/Character unavailable/);assert.doesNotMatch(source,/pinoria\/char-base\.png/);assert.match(source,/image\/png,video\/webm/);assert.match(source,/<option>DISABLED<\/option>/);assert.doesNotMatch(source,/setCatalog\(\[\]\);setInstances\(\[\]\)/);assert.match(source,/Write outcome uncertain; reload canonical state before editing/);assert.doesNotMatch(source,/attendance.*unlock/i);assert.doesNotMatch(source,/keygate.*set-live/i);
});
