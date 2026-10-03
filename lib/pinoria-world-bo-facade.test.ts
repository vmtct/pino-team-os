import assert from "node:assert/strict";
import test from "node:test";
import { isOperationalReadPath } from "./bo-read-handler";
import { handleBoWriteRequest, isAllowedPostPath, type BoWriteEnv } from "./bo-write-handler";
import { handleBoPinoriaWorldMediaUpload, PINORIA_WORLD_MEDIA_PATH, type BoPinoriaWorldMediaEnv } from "./bo-pinoria-world-media-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const id="01999999-9999-7999-8999-999999999999",scene="01988888-8888-7888-8888-888888888888";

test("Pinoria World BO facade exposes bounded canonical read and mutation paths",()=>{
  for(const path of ["pinoria/worlds","pinoria/worlds/learners",`pinoria/worlds/learners/${id}`,`pinoria/worlds/instances/${id}`,`pinoria/worlds/students/${id}/live`]) assert.equal(isOperationalReadPath(path),true,path);
  for(const path of ["pinoria/worlds",`pinoria/worlds/${id}`,`pinoria/worlds/${id}/scenes`,`pinoria/worlds/scenes/${scene}`,`pinoria/worlds/scenes/${scene}/layers`,`pinoria/worlds/layers/${id}`,`pinoria/worlds/learners/${id}/instances`,`pinoria/worlds/instances/${id}/set-live`,`pinoria/worlds/instances/${id}/revoke`,`pinoria/worlds/instances/${id}/reactivate`,`pinoria/worlds/instances/${id}/scenes/${scene}`,`pinoria/worlds/instances/${id}/layers/${scene}`,PINORIA_WORLD_MEDIA_PATH]) assert.equal(isAllowedPostPath(path),true,path);
  assert.equal(isOperationalReadPath("pinoria/worlds/instances"),false);
  assert.equal(isAllowedPostPath(`pinoria/worlds/${id}/automation`),false);
  assert.equal(isAllowedPostPath(`pinoria/worlds/instances/${id}/keygate`),false);
});

test("Pinoria World facade rejects invalid method/path combinations before Core",async()=>{
  let called=false;const env={PINO_BO_CORE:{async executeWithStaffPassword(){called=true;throw new Error("unexpected")}}} as BoWriteEnv;
  for(const [method,path] of [["PUT","pinoria/worlds"],["DELETE",`pinoria/worlds/learners/${id}/instances`],["POST",`pinoria/worlds/${id}`]] as const){
    const request=new Request(`https://bo.pinohouse.art/api/bo/${path}`,{method,headers:{"content-type":"application/json"},body:JSON.stringify({})});
    const response=await handleBoWriteRequest(request,env,path);assert.equal(response.status,405,`${method} ${path}`);
  }
  assert.equal(called,false);
});

test("World media upload forwards only bounded PNG/WEBM bytes through local-password Core binding",async()=>{
  const forwarded:Array<{request:BoAccessRequest;credential:string}>=[];
  const binding:BoAccessCoreBinding={async executeWithStaffPassword(request,credential){forwarded.push({request,credential});return{status:201,body:{data:{objectKey:"pinoria/world/uploads/a.png",mediaType:"PNG"}},requestId:"world-media"};}};
  const env={PINO_BO_CORE:binding} as BoPinoriaWorldMediaEnv;
  const form=new FormData();form.set("file",new File([new Uint8Array([1,2,3])],"scene.png",{type:"image/png"}));
  const request=new Request("https://bo.pinohouse.art/api/bo/pinoria/worlds/media",{method:"POST",headers:{cookie:"pino_staff_password_session=local-session","idempotency-key":"world-media-1"},body:form});
  const response=await handleBoPinoriaWorldMediaUpload(request,env);assert.equal(response.status,201);assert.equal(response.headers.get("x-request-id"),"world-media");
  assert.equal(forwarded.length,1);assert.equal(forwarded[0]!.credential,"local-session");assert.equal(forwarded[0]!.request.method,"POST");assert.equal(forwarded[0]!.request.path,PINORIA_WORLD_MEDIA_PATH);assert.equal(forwarded[0]!.request.idempotencyKey,"world-media-1");
  const body=forwarded[0]!.request.body as {fileName:string;mimeType:string;bytes:ArrayBuffer};assert.equal(body.fileName,"scene.png");assert.equal(body.mimeType,"image/png");assert.equal(body.bytes.byteLength,3);
});

test("World media upload rejects unsupported types before Core",async()=>{
  let called=false;const env={PINO_BO_CORE:{async executeWithStaffPassword(){called=true;throw new Error("unexpected")}}} as BoPinoriaWorldMediaEnv;
  const form=new FormData();form.set("file",new File(["x"],"bad.jpg",{type:"image/jpeg"}));
  const request=new Request("https://bo.pinohouse.art/api/bo/pinoria/worlds/media",{method:"POST",headers:{cookie:"pino_staff_password_session=local-session","idempotency-key":"world-media-bad"},body:form});
  assert.equal((await handleBoPinoriaWorldMediaUpload(request,env)).status,400);assert.equal(called,false);
});

test("World Studio production page is Core-backed and preserves required Character semantics",async()=>{
  const fs=await import("node:fs/promises"),source=await fs.readFile(new URL("../app/bo/pinoria-world/PinoriaWorldManager.tsx",import.meta.url),"utf8");
  assert.match(source,/CORE BACKED/);assert.match(source,/pinoria\/worlds\/instances/);assert.match(source,/Required Character Layer/);assert.match(source,/ALWAYS ON/);assert.match(source,/LayeredCharacter/);assert.match(source,/Character unavailable/);assert.doesNotMatch(source,/pinoria\/char-base\.png/);assert.match(source,/image\/png,video\/webm/);assert.match(source,/<option>DISABLED<\/option>/);assert.match(source,/setCatalog\(\[\]\);setInstances\(\[\]\)/);assert.match(source,/Canonical state unavailable; reload required/);assert.doesNotMatch(source,/attendance.*unlock/i);assert.doesNotMatch(source,/keygate.*set-live/i);
});
