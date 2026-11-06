/** PAP-1419 / PNR-TV (PAP-650): pure authenticated HO TV TDD provider tests. */
import assert from "node:assert/strict";
import test from "node:test";
import {tvDefinition,tvProvider,tvQuery} from "./schema";
import {safeHoReturnTo,HO_PAGE_PATHS} from "@/lib/ho-routes";

const centerId="019b1126-0001-7000-8000-000000000001";
const displayId="019b1126-0001-7000-8000-000000000002";
const deviceId="019b1126-0001-7000-8000-000000000003";
const sessionId="019b1126-0001-7000-8000-000000000004";
const display={id:displayId,key:"reception-pinoria",displayName:"Reception Pinoria",description:null,runtimeType:"PINORIA_HOUSE",scopeType:"CENTER",scopeId:centerId,centerName:"Cần Thơ",orientation:"LANDSCAPE",targetAspectRatio:"16:9",definitionVersion:3,status:"ACTIVE"};
const device={id:deviceId,key:"tv-ct",displayName:"Reception Node",centerId,centerName:"Cần Thơ",status:"ACTIVE",defaultDisplayId:displayId,defaultDisplayName:"Reception Pinoria",lastSeenAt:null,actualOrientation:null,viewportWidth:null,viewportHeight:null};
const session={sessionId,deviceId,displayId,lastSeenAt:"2026-11-06T00:00:00.000Z",expiresAt:"2026-11-06T12:00:00.000Z",definitionVersion:3,runtimeType:"PINORIA_HOUSE",heartbeatFresh:true,rendererAcknowledged:false,observationStatus:"FRESH",latestObservation:{assetStatus:"UNKNOWN",version:1}};
const makeFetch=(opts?:{sessions?:unknown[];denied?:number})=>{
 const calls:string[]=[];
 const fetcher:typeof fetch=async(input,init)=>{
  const path=String(input);calls.push(path);
  assert.equal(init?.method,"GET");assert.equal(init?.credentials,"same-origin");assert.equal(init?.cache,"no-store");
  if(opts?.denied)return Response.json({error:{code:"ACCESS_PERMISSION_DENIED"}},{status:opts.denied});
  if(path.endsWith("/displays"))return Response.json({data:[display]});
  if(path.endsWith("/devices"))return Response.json({data:[device]});
  if(path.endsWith("operator-health?centerId="+centerId))return Response.json({data:{centerId,deviceSessions:opts?.sessions??[session]}});
  throw Error("Unexpected request "+path);
 };
 return {fetcher,calls};
};
test("PAP-1419 HO directory uses one shared TDD shell with overview-first, history-last and NO Ads/write fields",()=>{
 assert.equal(tvDefinition.surface,"HO");
 assert.equal(tvDefinition.key,"tvs");
 assert.equal(tvDefinition.capabilities.read,"tv.view");
 assert.equal(tvDefinition.table.inlineEdit.enabled,false);
 assert.equal(tvDefinition.detail.businessTabs.length,0);
 assert.equal(tvDefinition.detail.overview.sections.length,2);
 assert.equal(tvDefinition.detail.history.kind,"unavailable");
 assert.equal(HO_PAGE_PATHS.tvs,"/ho/pinoria/tv");
 assert.equal(safeHoReturnTo("/ho/pinoria/tv"),"/ho/pinoria/tv");
 assert.equal(safeHoReturnTo("//host/ho/pinoria/tv"),null);
});
test("PAP-1419 Center-scoped current Core health stays explicit; no invented renderer ACK",async()=>{
 const {fetcher,calls}=makeFetch();
 const out=await tvProvider.list(tvQuery,{surface:"HO"},fetcher,new AbortController().signal);
 assert.equal(out.total,1);assert.equal(out.records.length,1);
 const row=out.records[0]!.row;
 assert.equal(row.id,displayId);assert.equal(row.name,"Reception Pinoria");
 assert.equal(row.center,"Cần Thơ");assert.equal(row.deviceCount,1);
 assert.equal(row.heartbeat,"Có tín hiệu");assert.equal(row.ack,"Chưa xác nhận");
 assert.equal(row.observation,"FRESH");assert.equal(row.lastSeen,session.lastSeenAt);
 assert.equal(calls.length,3);
 assert.deepEqual(calls.sort(),[
  "/api/ho/pinoria/tv-health/displays",
  "/api/ho/pinoria/tv-health/devices",
  "/api/ho/pinoria/tv-health/operator-health?centerId="+centerId,
 ].sort());
});
test("PAP-1419 absence of session remains NONE without synthetic online",async()=>{
 const {fetcher}=makeFetch({sessions:[]});
 const out=await tvProvider.list(tvQuery,{surface:"HO"},fetcher,new AbortController().signal);
 assert.equal(out.records[0]!.row.heartbeat,"Chưa ghi nhận");
 assert.equal(out.records[0]!.row.ack,"Chưa xác nhận");
 assert.equal(out.records[0]!.row.observation,"NONE");
 assert.equal(out.records[0]!.row.lastSeen,"—");
});
test("PAP-1419 403 fail closed, never silently show empty scope",async()=>{
 const {fetcher}=makeFetch({denied:403});
 await assert.rejects(tvProvider.list(tvQuery,{surface:"HO"},fetcher,new AbortController().signal));
});
test("PAP-1419 BO surface is denied before any network or HO access",async()=>{
 let called=0;
 const fetcher:typeof fetch=async()=>{called++;return Response.json({data:[]});};
 await assert.rejects(tvProvider.list(tvQuery,{surface:"BO",centerId},fetcher,new AbortController().signal));
 assert.equal(called,0);
});
