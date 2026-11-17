// PAP-1847 PNR-AVATAR-CRUD: native BO Nickname field and independent Core readback.
import test from "node:test";
import assert from "node:assert/strict";
import {canEditNickname,nicknameInput,patchAvatarNickname,reloadAvatarAfterNickname} from "./avatar-nickname-client";
import type {AvatarRow} from "./avatar-dsa-data";
import {BoApiError} from "@/lib/bo-api-error";

const centerId="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const personId="01a194f0-9bd0-7896-89a0-677a620e3ecd";
const selfId="01a194f0-9bd0-7896-89a0-677a620e3ecf";
const learnerId="01a194f0-9bd0-7896-89a0-677a620e3ece";
const row:AvatarRow={id:"PERSON_"+personId,name:"An",nickname:"Mây",pinoriaSelfId:selfId,
 selfStatus:"ACTIVE",selfVersion:3};
const grants=new Set(["pinoria.avatar.directory.view","pinoria.self.nickname.manage"]);
test("PAP-1847 Nickname canonical field only editable with grant, active Self and Core version",()=>{
 assert.equal(canEditNickname(row,grants),true);
 assert.equal(canEditNickname({...row,selfStatus:"ARCHIVED"},grants),false);
 assert.equal(canEditNickname({...row,selfVersion:null},grants),false);
 assert.equal(canEditNickname({...row,pinoriaSelfId:null},grants),false);
 assert.equal(canEditNickname(row,new Set(["pinoria.avatar.directory.view"])),false);
});
test("PAP-1847 nullable clear and NFC normalization, strict 40 codepoints and controls",()=>{
 assert.equal(nicknameInput(" Ma\u0302y "),"Mây");
 assert.equal(nicknameInput("   "),null);
 assert.equal([...nicknameInput("🌱".repeat(40))!].length,40);
 for(const bad of [null,123,"n".repeat(41),"X\nY"]){
  assert.throws(()=>nicknameInput(bad as never),BoApiError);
 }
});
test("PAP-1847 PATCH only selected Center+version; independent GET drives new CAS version",async()=>{
 const original=globalThis.fetch,seen:Array<{url:string;method:string;body?:unknown}>=[];
 const coreRow={rowKey:"PERSON:"+personId,displayName:"An",nickname:"Mây mới",
  personId,pinoriaSelfId:selfId,subjectTypes:["LEARNER"],studentProfileId:learnerId,staffMemberId:null,
  selfVersion:4,selfStatus:"ACTIVE",avatarStatus:"READY",subjectStatus:"ACTIVE",
  ownedCount:0,createdAt:"2026-11-10T10:00:00Z",createdBy:"PINO",
  updatedAt:"2026-11-12T10:00:00Z",updatedBy:"PINO",loadoutVersion:1,equippedCount:0};
 try{
  globalThis.fetch=async(input,init)=>{
   const url=String(input),method=init?.method??"GET";
   seen.push({url,method,body:init?.body?JSON.parse(String(init.body)):undefined});
   return method==="PATCH"?Response.json({data:{selfVersion:4,nickname:"Mây mới"}},{status:200}):
    Response.json({data:{items:[coreRow],nextCursor:null}},{status:200});
  };
  await patchAvatarNickname(centerId,row,"Mây mới",new AbortController().signal);
  const current=await reloadAvatarAfterNickname(centerId,row,new AbortController().signal);
  assert.equal(current.nickname,"Mây mới");assert.equal(current.selfVersion,4);
  assert.equal(seen.length,2);
  assert.equal(seen[0]?.method,"PATCH");
  assert.deepEqual(seen[0]?.body,{nickname:"Mây mới",expectedSelfVersion:3});
  assert.ok(seen[0]?.url.includes("centerId="+centerId));
  assert.equal(seen[1]?.method,"GET");
 }finally{globalThis.fetch=original;}
});
test("PAP-1847 upstream stale 409 must not fabricate CAS success",async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;return Response.json({error:{code:"VERSION_CONFLICT"}},{status:409});};
  await assert.rejects(patchAvatarNickname(centerId,row,"New",new AbortController().signal),(e:unknown)=>e instanceof BoApiError&&e.status===409);
  assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
});
